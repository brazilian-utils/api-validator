/**
 * Baselines make the validator adoptable today: a lib's CI fails only when something that
 * used to conform stops conforming (a regression), not because of the long tail of
 * functions it never implemented. The baseline ratchets up with `api-validator baseline`.
 */
import fs from "node:fs";
import path from "node:path";
import type { LibReport } from "./model.js";

export interface Baseline {
  library: string;
  /** Contract functions with status ok. */
  ok: string[];
  /** Conformance tests that passed (only recorded when tests ran). */
  tests: string[];
  /**
   * Public symbols outside the contract that were already there. Any *new* one is a
   * regression: public API must enter through the contract first, so every lib hears of it.
   */
  unmapped?: string[];
}

export function baselinePath(dir: string, lib: string): string {
  return path.join(dir, `${lib}.json`);
}

export function loadBaseline(dir: string, lib: string): Baseline | undefined {
  const file = baselinePath(dir, lib);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Baseline;
}

export function baselineFrom(report: LibReport, previous?: Baseline): Baseline {
  const tests = report.testsRan
    ? report.functions.flatMap((f) => f.tests.filter((t) => t.status === "pass").map((t) => t.id))
    : previous?.tests ?? [];
  return {
    library: report.library,
    ok: report.functions.filter((f) => f.status === "ok").map((f) => f.id).sort(),
    tests: [...new Set(tests)].sort(),
    unmapped: report.unmapped.map((u) => u.symbol).sort()
  };
}

export function writeBaseline(dir: string, baseline: Baseline): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(baselinePath(dir, baseline.library), `${JSON.stringify(baseline, null, 2)}\n`);
}

export interface Regression {
  id: string;
  kind: "function" | "test" | "surface";
  now: string;
  detail?: string;
}

export interface BaselineDiff {
  regressions: Regression[];
  /** Functions/tests that pass now but are not in the baseline: run `baseline` to lock them in. */
  improvements: string[];
}

export function diffBaseline(report: LibReport, baseline: Baseline | undefined): BaselineDiff {
  if (!baseline) return { regressions: [], improvements: [] };
  const regressions: Regression[] = [];
  const improvements: string[] = [];
  const byId = new Map(report.functions.map((f) => [f.id, f]));
  const okNow = new Set(report.functions.filter((f) => f.status === "ok").map((f) => f.id));
  for (const id of baseline.ok) {
    const f = byId.get(id);
    if (!f) continue; // removed from the contract
    if (f.status === "waived") continue;
    // Test failures are reported per test below.
    if (f.status !== "ok" && f.status !== "failing") {
      const detail = f.issues.find((i) => i.severity === "error")?.message;
      regressions.push({ id, kind: "function", now: f.status, detail });
    }
  }
  for (const id of okNow) if (!baseline.ok.includes(id)) improvements.push(id);
  if (baseline.unmapped) {
    const known = new Set(baseline.unmapped);
    for (const u of report.unmapped) {
      if (known.has(u.symbol)) continue;
      const hint = u.suggestions[0] ? ` (looks like ${u.suggestions[0].id}: add a binding)` : " (propose it in the contract, or add it to `ignore`)";
      regressions.push({ id: u.symbol, kind: "surface", now: "public but not in the contract", detail: hint.trim() });
    }
  }
  if (report.testsRan) {
    const outcomes = new Map(report.functions.flatMap((f) => f.tests.map((t) => [t.id, t] as const)));
    const passedBefore = new Set(baseline.tests);
    for (const id of passedBefore) {
      const t = outcomes.get(id);
      if (t && t.status === "fail") regressions.push({ id, kind: "test", now: "fail", detail: t.message });
    }
    for (const [id, t] of outcomes) if (t.status === "pass" && !passedBefore.has(id)) improvements.push(id);
  }
  return { regressions, improvements: [...new Set(improvements)].sort() };
}
