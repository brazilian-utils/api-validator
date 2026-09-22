import { execFileSync } from "node:child_process";
import type { AdapterContext, LanguageAdapter } from "../languages/types.js";
import { runConformance, type Bound } from "./conformance.js";
import { validateLibAgainstContract } from "./libs.js";
import { isIgnored, resolve, suggestFunctions, suggestSymbols, SymbolIndex } from "./match.js";
import type {
  ApiSurface,
  Contract,
  ContractTest,
  FunctionReport,
  LibConfig,
  LibReport,
  LibSummary,
  NativeSymbol
} from "./model.js";
import { bestOverload } from "./signature.js";
import { which } from "./shell.js";

export function gitRevision(root: string): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return undefined;
  }
}

export async function extractSurface(adapter: LanguageAdapter, ctx: AdapterContext): Promise<ApiSurface> {
  const { symbols, warnings } = await adapter.extract(ctx);
  symbols.sort((a, b) => a.name.localeCompare(b.name) || a.params.length - b.params.length);
  return { library: ctx.lib.name, language: adapter.id, revision: gitRevision(ctx.root), symbols, warnings };
}

export interface AnalyzeOptions {
  contract: Contract;
  adapter: LanguageAdapter;
  ctx: AdapterContext;
  surface: ApiSurface;
  runTests: boolean;
  testFilter?: (test: ContractTest) => boolean;
  /** Also run tests of functions that call remote services. */
  network?: boolean;
}

export interface Binding {
  index: SymbolIndex;
  functions: FunctionReport[];
  mappedTargets: Set<string>;
  /** Contract functions with a compatible implementation (status ok), with the symbol to call. */
  bound: Bound[];
  boundById: Map<string, NativeSymbol>;
}

/** Match every contract function to the lib's symbols and check signatures (no tests). */
export function bindLib(contract: Contract, adapter: LanguageAdapter, lib: LibConfig, surface: ApiSurface): Binding {
  const index = new SymbolIndex(surface.symbols);
  const functions: FunctionReport[] = [];
  const mappedTargets = new Set<string>();
  const bound: Bound[] = [];
  const boundById = new Map<string, NativeSymbol>();

  for (const fn of [...contract.functions.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const res = resolve(fn, lib, adapter, index);
    const waiver = lib.waivers[fn.id];
    const report: FunctionReport = { id: fn.id, level: fn.level, status: "missing", issues: [...res.issues], tests: [], suggestions: [] };

    if (res.overloads.length === 0) {
      if (waiver) {
        report.status = "waived";
        report.waiver = waiver;
      }
      functions.push(report);
      continue;
    }

    for (const o of res.overloads) mappedTargets.add(index.target(o));
    const best = bestOverload(fn, res.overloads, adapter);
    report.symbol = best.symbol.name;
    report.matchedBy = "matchedBy" in res ? res.matchedBy : undefined;
    report.location = index.definition(best.symbol).location ?? best.symbol.location;
    report.issues.push(...best.issues);
    if (best.symbol.deprecated && !report.issues.some((i) => i.code === "deprecated-only")) {
      report.issues.push({ severity: "warning", code: "deprecated", message: `${best.symbol.name} is deprecated` });
    }
    if (waiver) {
      report.issues.push({ severity: "info", code: "stale-waiver", message: `waived ("${waiver}") but implemented — remove the waiver` });
    }
    report.status = report.issues.some((i) => i.severity === "error") ? "signature" : "ok";
    functions.push(report);
    if (report.status === "ok") {
      bound.push({ fn, symbol: best.symbol });
      boundById.set(fn.id, best.symbol);
    }
  }
  return { index, functions, mappedTargets, bound, boundById };
}

export async function analyzeLib(opts: AnalyzeOptions): Promise<LibReport> {
  const { contract, adapter, ctx, surface } = opts;
  const lib = ctx.lib;
  const { index, functions, mappedTargets, bound, boundById } = bindLib(contract, adapter, lib, surface);

  // Tests: only for functions whose signature is compatible (calling the others is meaningless).
  let testsRan = false;
  let runnerNote: string | undefined;
  if (opts.runTests) {
    if (!adapter.runner) runnerNote = `no conformance runner for ${adapter.displayName} yet`;
    else {
      const missing = adapter.runner.requires.filter((bin) => !which(bin));
      if (missing.length > 0) runnerNote = `runner needs ${missing.join(", ")} on PATH`;
      else {
        const runnable = bound.filter((b) => opts.network || !b.fn.network);
        const results = await runConformance(runnable, boundById, lib, adapter, ctx, opts.testFilter);
        testsRan = true;
        for (const report of functions) {
          const outcomes = results.get(report.id);
          if (!outcomes) continue;
          report.tests = outcomes;
          if (report.status === "ok" && outcomes.some((o) => o.status === "fail")) report.status = "failing";
          const fixedKnown = outcomes.filter((o) => o.status === "pass" && lib.knownFailures[o.id]);
          for (const o of fixedKnown) {
            report.issues.push({ severity: "info", code: "stale-known-failure", message: `${o.id} passes now — remove it from knownFailures` });
          }
        }
      }
    }
  }

  // Public symbols not bound to any contract function.
  const allFns = [...contract.functions.values()];
  const unmappedSymbols = surface.symbols.filter(
    (s) => !s.deprecated && !mappedTargets.has(index.target(s)) && !isIgnored(lib, s.name)
  );
  const seenTargets = new Set<string>();
  const unmapped = unmappedSymbols
    .filter((s) => {
      // Report each implementation once (a facade alias and its module function are one thing).
      const t = index.target(s);
      if (seenTargets.has(t)) return false;
      seenTargets.add(t);
      return true;
    })
    .map((s) => ({
      symbol: s.name,
      location: index.definition(s).location ?? s.location,
      suggestions: suggestFunctions(
        s.name,
        allFns.filter((fn) => functions.find((r) => r.id === fn.id)?.status === "missing")
      )
    }));

  for (const report of functions) {
    if (report.status !== "missing") continue;
    report.suggestions = suggestSymbols(contract.functions.get(report.id)!, unmappedSymbols);
  }

  return {
    library: lib.name,
    language: adapter.id,
    revision: surface.revision,
    functions,
    unmapped,
    configIssues: validateLibAgainstContract(lib, contract),
    testsRan,
    runnerNote,
    summary: summarize(functions)
  };
}

export function summarize(functions: FunctionReport[]): LibSummary {
  const count = (pred: (f: FunctionReport) => boolean) => functions.filter(pred).length;
  const tests = functions.flatMap((f) => f.tests);
  const relevant = functions.filter((f) => f.status !== "waived");
  const core = relevant.filter((f) => f.level === "core");
  const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 1000) / 10);
  return {
    total: functions.length,
    ok: count((f) => f.status === "ok"),
    signature: count((f) => f.status === "signature"),
    failing: count((f) => f.status === "failing"),
    missing: count((f) => f.status === "missing"),
    missingCore: count((f) => f.status === "missing" && f.level === "core"),
    waived: count((f) => f.status === "waived"),
    testsPassed: tests.filter((t) => t.status === "pass").length,
    testsFailed: tests.filter((t) => t.status === "fail").length,
    testsSkipped: tests.filter((t) => t.status === "skip").length,
    coverage: pct(relevant.filter((f) => f.status === "ok").length, relevant.length),
    coreCoverage: pct(core.filter((f) => f.status === "ok").length, core.length)
  };
}
