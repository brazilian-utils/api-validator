/**
 * What changed in the contract between two git refs: functions added/removed/changed
 * (signature, level, deprecation) and test vectors added/removed/changed. This is the
 * "what every lib must now do" list of a contract PR or release, computed, not written.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadContract } from "./contract.js";
import type { Contract, ContractFunction, ContractTest } from "./model.js";
import { runOrThrow } from "./shell.js";

/** Load the contract as it was at a git ref (`WORKTREE` = files on disk). */
export function contractAt(repo: string, dir: string, ref: string): Contract {
  if (ref === "WORKTREE") return loadContract(dir);
  const rel = path.relative(repo, dir);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "api-validator-contract-"));
  try {
    const files = runOrThrow("git", ["ls-tree", "--name-only", `${ref}:${rel}`], { cwd: repo }).split("\n").filter((f) => f.endsWith(".json"));
    for (const f of files) fs.writeFileSync(path.join(tmp, f), runOrThrow("git", ["show", `${ref}:${rel}/${f}`], { cwd: repo }));
    return loadContract(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export interface FunctionChange {
  id: string;
  changes: string[];
  testsAdded: ContractTest[];
  testsRemoved: ContractTest[];
  testsChanged: Array<{ before: ContractTest; after: ContractTest }>;
}

export interface ContractChangelog {
  added: ContractFunction[];
  removed: ContractFunction[];
  changed: FunctionChange[];
}

const signature = (f: ContractFunction) =>
  `(${f.params.map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.type}`).join(", ")}) -> ${f.returns}`;
const expectation = (t: ContractTest) => JSON.stringify([t.expect, t.repeat]);

export function changelog(before: Contract, after: Contract): ContractChangelog {
  const added = [...after.functions.values()].filter((f) => !before.functions.has(f.id));
  const removed = [...before.functions.values()].filter((f) => !after.functions.has(f.id));
  const changed: FunctionChange[] = [];
  for (const a of after.functions.values()) {
    const b = before.functions.get(a.id);
    if (!b) continue;
    const changes: string[] = [];
    if (signature(a) !== signature(b)) changes.push(`signature: \`${signature(b)}\` → \`${signature(a)}\``);
    if (a.level !== b.level) changes.push(`level: ${b.level} → ${a.level}`);
    if (!!a.deprecated !== !!b.deprecated) changes.push(a.deprecated ? "deprecated" : "no longer deprecated");
    if (a.flatName !== b.flatName) changes.push(`flat name: ${b.flatName} → ${a.flatName}`);
    const bt = new Map(b.tests.map((t) => [t.id, t]));
    const at = new Map(a.tests.map((t) => [t.id, t]));
    const testsAdded = a.tests.filter((t) => !bt.has(t.id));
    const testsRemoved = b.tests.filter((t) => !at.has(t.id));
    const testsChanged = a.tests.filter((t) => bt.has(t.id) && expectation(bt.get(t.id)!) !== expectation(t)).map((t) => ({ before: bt.get(t.id)!, after: t }));
    if (changes.length || testsAdded.length || testsRemoved.length || testsChanged.length) {
      changed.push({ id: a.id, changes, testsAdded, testsRemoved, testsChanged });
    }
  }
  const byId = (x: { id: string }, y: { id: string }) => x.id.localeCompare(y.id);
  return { added: added.sort(byId), removed: removed.sort(byId), changed: changed.sort(byId) };
}

const showExpect = (t: ContractTest) => {
  const e = t.expect;
  const rhs = e.kind === "returns" ? JSON.stringify(e.value) : e.kind === "throws" ? "throws" : e.kind === "matches" ? `matches /${e.pattern}/` : `satisfies ${e.fn}`;
  return `\`${JSON.stringify(t.args)}\` → ${rhs}`;
};

export function changelogMarkdown(log: ContractChangelog, from: string, to: string): string {
  const out = [`# Contract changes ${from} → ${to}`, ""];
  if (!log.added.length && !log.removed.length && !log.changed.length) return `${out.join("\n")}No changes.\n`;
  const breaking = log.removed.length + log.changed.filter((c) => c.changes.some((x) => x.startsWith("signature"))).length;
  const tests = log.changed.reduce((n, c) => n + c.testsAdded.length + c.testsChanged.length, 0) + log.added.reduce((n, f) => n + f.tests.length, 0);
  out.push(
    `**${log.added.length}** new functions · **${log.removed.length}** removed · **${log.changed.length}** changed · **${tests}** new or changed test vectors${breaking ? ` · ⚠️ ${breaking} breaking` : ""}`,
    ""
  );
  if (log.added.length) {
    out.push("## New functions (every lib must implement)", "");
    for (const f of log.added) out.push(`- \`${f.id}\` ${f.level === "core" ? "**core**" : "extended"} \`${signature(f)}\`${f.summary ? ` — ${f.summary}` : ""} (${f.tests.length} tests)`);
    out.push("");
  }
  if (log.removed.length) {
    out.push("## Removed functions", "");
    for (const f of log.removed) out.push(`- \`${f.id}\``);
    out.push("");
  }
  if (log.changed.length) {
    out.push("## Changed functions", "");
    for (const c of log.changed) {
      out.push(`### \`${c.id}\``, "");
      for (const x of c.changes) out.push(`- ${x}`);
      for (const t of c.testsAdded) out.push(`- ➕ ${showExpect(t)}${t.note ? ` — ${t.note}` : ""}`);
      for (const t of c.testsChanged) out.push(`- ✏️ ${showExpect(t.before)} ⇒ ${showExpect(t.after)}`);
      for (const t of c.testsRemoved) out.push(`- ➖ ${showExpect(t)}`);
      out.push("");
    }
  }
  return out.join("\n");
}
