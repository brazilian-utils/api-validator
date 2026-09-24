/**
 * One GitHub issue per contract function per lib, opened and closed by the pipeline:
 *
 *   implement:<fn>  the contract gained <fn> (a merged contract PR) and the lib does not have it
 *   fix:<fn>        new or changed cases of <fn> (a bug-fix vector) that the lib fails
 *
 * Planning is pure (this file); `docs issues --apply` executes the plan with `gh`.
 * Issues are found again by a hidden marker in their body, so every run is idempotent: it
 * refreshes the body of open ones, opens what is missing, and closes what the lib has done.
 */
import type { ContractChangelog } from "./changelog.js";
import type { Contract, FunctionReport, LibReport } from "./model.js";

export type IssueKind = "implement" | "fix";

export interface PlannedIssue {
  key: string; // `${kind}:${fnId}`
  kind: IssueKind;
  fn: string;
  title: string;
}

export interface Scope {
  /** Functions that entered the contract (open `implement` issues where missing). */
  added: Set<string>;
  /** Case ids added or changed (open `fix` issues where the lib now fails one). */
  cases: Set<string>;
}

export const LABEL = "api-contract";
export const marker = (key: string) => `<!-- api-contract:${key} -->`;
export const keyOf = (body: string): string | undefined => body.match(/<!-- api-contract:((?:implement|fix):[A-Za-z0-9.]+) -->/)?.[1];

export function scopeFrom(log: ContractChangelog): Scope {
  return {
    added: new Set(log.added.map((f) => f.id)),
    cases: new Set([
      ...log.added.flatMap((f) => f.tests.map((t) => t.id)),
      ...log.changed.flatMap((c) => [...c.testsAdded.map((t) => t.id), ...c.testsChanged.map((t) => t.after.id)])
    ])
  };
}

const implemented = (f?: FunctionReport) => f?.status === "ok" || f?.status === "failing";
const failingCases = (f?: FunctionReport) => (f?.tests ?? []).filter((t) => t.status === "fail");

/**
 * Issues that should be open for this lib. `backfill` opens them for everything already
 * missing or failing too ("core": core functions only), not just what `scope` introduced.
 */
export function wantedIssues(contract: Contract, report: LibReport, scope: Scope, backfill?: "core" | "all"): PlannedIssue[] {
  const byId = new Map(report.functions.map((f) => [f.id, f]));
  const out: PlannedIssue[] = [];
  for (const fn of [...contract.functions.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const f = byId.get(fn.id);
    if (f?.status === "waived") continue;
    const inBackfill = backfill === "all" || (backfill === "core" && fn.level === "core");
    // Missing (waived ones were skipped above; a signature mismatch is a different problem).
    if ((!f || f.status === "missing") && (scope.added.has(fn.id) || inBackfill)) {
      out.push({ key: `implement:${fn.id}`, kind: "implement", fn: fn.id, title: `[api-contract] Implement ${fn.id}` });
      continue;
    }
    const failing = failingCases(f);
    if (failing.length && (failing.some((t) => scope.cases.has(t.id)) || inBackfill)) {
      out.push({ key: `fix:${fn.id}`, kind: "fix", fn: fn.id, title: `[api-contract] Fix ${fn.id}: ${failing.length} failing case${failing.length === 1 ? "" : "s"}` });
    }
  }
  return out;
}

/** Why an open issue with this key can be closed now, or undefined to keep it open. */
export function closeReason(key: string, contract: Contract, report: LibReport): string | undefined {
  const [kind, fnId] = key.split(":") as [IssueKind, string];
  if (!contract.functions.has(fnId)) return `\`${fnId}\` is no longer in the contract.`;
  const f = report.functions.find((x) => x.id === fnId);
  if (f?.status === "waived") return `waived in the lib config: ${f.waiver}`;
  if (kind === "implement" && implemented(f)) return `implemented as \`${f!.symbol}\`${f!.status === "failing" ? " (some cases still fail)" : ", and every shared case passes"}.`;
  // A run whose tests did not run (no runner on PATH) reports no failing case; that says nothing.
  if (kind === "fix" && report.testsRan && implemented(f) && failingCases(f).length === 0) return "every shared case passes now.";
  return undefined;
}
