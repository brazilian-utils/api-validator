/**
 * Shared conformance tests: the contract carries test vectors (args -> expected result),
 * every language adapter ships a thin runner that can call a native symbol with JSON args
 * and give back a JSON result. The same vectors therefore run, unchanged, against every lib.
 *
 * Expectations:
 *   returns   deep equality (object keys compared case/separator-insensitively, so
 *             `{zipCode}` == `{zip_code}`; numbers with 1e-9 tolerance)
 *   throws    the call fails (exception, error value, Err(...), {error, _})
 *   matches   result is a string matching the regex
 *   satisfies result, fed to another contract function of the same lib, returns true
 *             (e.g. every generated CPF must pass the lib's own cpf.isValid)
 */
import type { LanguageAdapter, AdapterContext } from "../languages/types.js";
import type { ContractFunction, ContractTest, LibConfig, NativeSymbol, RunnerCall, RunnerResult, TestOutcome } from "./model.js";
import { flat } from "./naming.js";

export function valuesEqual(expected: unknown, actual: unknown): boolean {
  if (expected === null || expected === undefined) return actual === null || actual === undefined;
  if (typeof expected === "number" && typeof actual === "number") {
    return Math.abs(expected - actual) <= 1e-9 * Math.max(1, Math.abs(expected));
  }
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((e, i) => valuesEqual(e, actual[i]));
  }
  if (typeof expected === "object") {
    if (typeof actual !== "object" || actual === null || Array.isArray(actual)) return false;
    const norm = (o: object) => new Map(Object.entries(o).map(([k, v]) => [flat(k), v]));
    const e = norm(expected);
    const a = norm(actual);
    // Absent and null are equivalent for object fields.
    const keys = new Set([...e.keys(), ...a.keys()]);
    for (const k of keys) if (!valuesEqual(e.get(k) ?? null, a.get(k) ?? null)) return false;
    return true;
  }
  return expected === actual;
}

export interface Bound {
  fn: ContractFunction;
  symbol: NativeSymbol;
}

interface Planned {
  test: ContractTest;
  fn: ContractFunction;
  callIds: string[];
}

function knownFailure(lib: LibConfig, test: ContractTest, fn: ContractFunction): string | undefined {
  return lib.knownFailures[test.id] ?? lib.knownFailures[fn.id];
}

const show = (v: unknown) => (v === undefined ? "undefined" : JSON.stringify(v));

/**
 * Run all tests of all bound functions in (at most) two batches:
 * batch 1 = every direct call, batch 2 = `satisfies` follow-up calls.
 */
export async function runConformance(
  bound: Bound[],
  boundById: Map<string, NativeSymbol>,
  lib: LibConfig,
  adapter: LanguageAdapter,
  ctx: AdapterContext,
  filter?: (test: ContractTest) => boolean
): Promise<Map<string, TestOutcome[]>> {
  const runner = adapter.runner!;
  const calls: RunnerCall[] = [];
  const planned: Planned[] = [];

  for (const { fn, symbol } of bound) {
    for (const test of fn.tests) {
      if (filter && !filter(test)) continue;
      const callIds: string[] = [];
      for (let r = 0; r < test.repeat; r++) {
        const id = `${test.id}@${r}`;
        calls.push({ id, symbol, args: test.args });
        callIds.push(id);
      }
      planned.push({ test, fn, callIds });
    }
  }

  const first = new Map((calls.length ? await runner.run(ctx, calls) : []).map((r) => [r.id, r]));

  // Follow-up calls for `satisfies`.
  const followCalls: RunnerCall[] = [];
  for (const p of planned) {
    if (p.test.expect.kind !== "satisfies") continue;
    const target = boundById.get(p.test.expect.fn);
    if (!target) continue;
    for (const id of p.callIds) {
      const r = first.get(id);
      if (r?.ok) followCalls.push({ id: `${id}>`, symbol: target, args: [r.value] });
    }
  }
  const second = new Map((followCalls.length ? await runner.run(ctx, followCalls) : []).map((r) => [r.id, r]));

  const out = new Map<string, TestOutcome[]>();
  for (const p of planned) {
    const outcome = evaluate(p, first, second, boundById);
    const known = knownFailure(lib, p.test, p.fn);
    if (known && outcome.status === "fail") {
      outcome.status = "known-failure";
      outcome.message = `${outcome.message} [known: ${known}]`;
    }
    const list = out.get(p.fn.id) ?? [];
    list.push(outcome);
    out.set(p.fn.id, list);
  }
  return out;
}

function evaluate(
  p: Planned,
  first: Map<string, RunnerResult>,
  second: Map<string, RunnerResult>,
  boundById: Map<string, NativeSymbol>
): TestOutcome {
  const { test } = p;
  const base = { id: test.id };
  for (const callId of p.callIds) {
    const r = first.get(callId);
    if (!r) return { ...base, status: "skip", message: "runner returned no result" };
    if (!r.ok && r.unsupported) return { ...base, status: "skip", message: r.error };

    const e = test.expect;
    switch (e.kind) {
      case "throws":
        if (r.ok) return { ...base, status: "fail", message: `expected an error, got ${show(r.value)}`, actual: r.value };
        break;
      case "returns":
        if (!r.ok) return { ...base, status: "fail", message: `expected ${show(e.value)}, threw: ${r.error}`, expected: e.value };
        if (!valuesEqual(e.value, r.value)) {
          return { ...base, status: "fail", message: `expected ${show(e.value)}, got ${show(r.value)}`, expected: e.value, actual: r.value };
        }
        break;
      case "matches":
        if (!r.ok) return { ...base, status: "fail", message: `expected /${e.pattern}/, threw: ${r.error}` };
        if (typeof r.value !== "string" || !new RegExp(e.pattern).test(r.value)) {
          return { ...base, status: "fail", message: `expected /${e.pattern}/, got ${show(r.value)}`, actual: r.value };
        }
        break;
      case "satisfies": {
        if (!boundById.has(e.fn)) return { ...base, status: "skip", message: `${e.fn} is not implemented by this lib` };
        if (!r.ok) return { ...base, status: "fail", message: `threw: ${r.error}` };
        const f = second.get(`${callId}>`);
        if (!f) return { ...base, status: "skip", message: "runner returned no result" };
        if (!f.ok && f.unsupported) return { ...base, status: "skip", message: f.error };
        if (!f.ok || f.value !== true) {
          return {
            ...base,
            status: "fail",
            message: `${show(r.value)} does not satisfy ${e.fn} (got ${f.ok ? show(f.value) : `error: ${f.error}`})`,
            actual: r.value
          };
        }
        break;
      }
    }
  }
  return { ...base, status: "pass" };
}
