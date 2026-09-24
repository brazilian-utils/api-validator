/**
 * Differential testing: run the same inputs through every implementation and compare.
 *
 * Hand-written contract tests only cover what someone thought of. Here inputs are mined
 * automatically per domain, so divergences surface on their own:
 *   - args of every contract test of the domain (a cpf.isValid vector also feeds cpf.format)
 *   - fresh values from the domain's `generate` in the reference lib, their formatted and
 *     parsed versions, a copy with a corrupted last digit, and a same-length
 *     repeated-digit value (the classic "00000000000" trap)
 *   - generic edge cases: "", whitespace, letters, a lowercase/uppercase variant
 * Results are clustered per input; any input where libs disagree is reported, and
 * `--propose` turns the majority answer into contract test proposals for human review.
 */
import type { AdapterContext, LanguageAdapter } from "../languages/types.js";
import { valuesEqual } from "./conformance.js";
import { bindLib } from "./analyze.js";
import type { ApiSurface, Contract, ContractFunction, NativeSymbol, RunnerCall } from "./model.js";
import { flat } from "./naming.js";
import { parseCType, type CType } from "./ctype.js";
import { shortName } from "../../site/src/lib/usage-format.mjs";

export interface DiffLib {
  name: string;
  adapter: LanguageAdapter;
  ctx: AdapterContext;
  surface: ApiSurface;
}

export interface DiffRow {
  fn: string;
  args: unknown[];
  /** answer key -> libs giving it */
  answers: Array<{ answer: string; value: unknown; error?: string; libs: string[] }>;
  agree: boolean;
}

const GENERIC_EDGE = ["", "   ", "abc"];

function acceptsString(t: CType): boolean {
  if (t.k === "string" || t.k === "any") return true;
  return t.k === "union" && t.of.some(acceptsString);
}

/** An answer compared by value: object keys normalized (`zip_code` = `zipCode`), null fields dropped; any error is one answer. */
export function answerKey(r: { ok: boolean; value?: unknown; error?: string }): string {
  if (!r.ok) return "<error>";
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v)
          .filter(([, x]) => x !== null && x !== undefined)
          .map(([k, x]) => [flat(k), norm(x)])
          .sort(([a], [b]) => String(a).localeCompare(String(b)))
      );
    }
    // Numbers equal within 1e-9 are one answer (0.1 + 0.2 = 0.3); -0 is 0.
    if (typeof v === "number" && Number.isFinite(v) && !Number.isInteger(v)) return Number(v.toFixed(9)) + 0;
    if (typeof v === "number" && v === 0) return 0;
    return v === undefined ? null : v;
  };
  return JSON.stringify(norm(r.value));
}

const bindings = new WeakMap<DiffLib, Map<string, NativeSymbol>>();

/**
 * The symbol `check` would call for `fn` (same binding: `bindLib`), or undefined when the
 * function is missing or its signature does not match (calling it would be meaningless).
 */
function bind(contract: Contract, lib: DiffLib, fn: ContractFunction): NativeSymbol | undefined {
  let bound = bindings.get(lib);
  if (!bound) bindings.set(lib, (bound = bindLib(contract, lib.adapter, lib.ctx.lib, lib.surface).boundById));
  return bound.get(fn.id);
}

type Outcome = { ok: boolean; value?: unknown; error?: string };  // absent results arrive as { ok: true, value: null }

/** Run many (symbol, args) calls against one lib in a single runner invocation. */
async function runBatch(lib: DiffLib, items: Array<{ symbol: NativeSymbol; args: unknown[] }>): Promise<Outcome[]> {
  if (items.length === 0) return [];
  const calls: RunnerCall[] = items.map((it, i) => ({ id: `d${i}`, symbol: it.symbol, args: it.args }));
  const byId = new Map((await lib.adapter.runner!.run(lib.ctx, calls)).map((r) => [r.id, r]));
  return calls.map((c) => {
    const r = byId.get(c.id);
    if (!r) return { ok: false, error: "unsupported:no result" };
    if (!r.ok && r.absent) return { ok: true, value: null };
    return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.unsupported ? `unsupported:${r.error}` : r.error };
  });
}

/** Mined values per domain (baselines/_corpus.json): the ones that came out of the reference lib's
 *  `generate`, `format` and `parse`, which are random. Kept on file so every run compares the same
 *  inputs, and `--fail-on-new` never fails on a split that only a fresh random value shows; new
 *  values enter the corpus only through `diff --baseline`. */
export type Corpus = Record<string, string[]>;

/** Build the input corpus of every domain: the contract's own test arguments, the stored corpus,
 *  fresh values from the reference lib when `mine` (two batched calls), and the generic edges. */
export async function corpora(contract: Contract, domains: string[], reference: DiffLib | undefined, stored: Corpus = {}, mine = true): Promise<Map<string, string[]>> {
  const values = new Map(domains.map((d) => [d, new Set<string>()]));
  for (const fn of contract.functions.values()) {
    const set = values.get(fn.domain);
    if (set) for (const t of fn.tests) for (const a of t.args) if (typeof a === "string") set.add(a);
  }
  for (const [d, set] of values) for (const v of stored[d] ?? []) set.add(v);
  if (reference && mine) {
    const gens: Array<{ domain: string; symbol: NativeSymbol; args: unknown[] }> = [];
    for (const d of domains) {
      const gen = contract.functions.get(`${d}.generate`);
      const sym = gen && gen.params.every((p) => p.optional) ? bind(contract, reference, gen) : undefined;
      if (sym) for (let i = 0; i < 3; i++) gens.push({ domain: d, symbol: sym, args: [] });
    }
    const generated = (await runBatch(reference, gens)).map((r, i) => ({ domain: gens[i].domain, value: r.ok && typeof r.value === "string" ? r.value : undefined }));
    const follow: Array<{ domain: string; symbol: NativeSymbol; args: unknown[] }> = [];
    for (const { domain, value: g } of generated) {
      if (!g) continue;
      const set = values.get(domain)!;
      set.add(g);
      const lastDigit = g.search(/\d(?!.*\d)/);
      if (lastDigit >= 0) set.add(g.slice(0, lastDigit) + ((Number(g[lastDigit]) + 1) % 10) + g.slice(lastDigit + 1));
      if (/^\d+$/.test(g)) set.add("0".repeat(g.length));
      if (/[a-z]/i.test(g)) set.add(g === g.toLowerCase() ? g.toUpperCase() : g.toLowerCase());
      for (const op of ["format", "parse"]) {
        const f = contract.functions.get(`${domain}.${op}`);
        const sym = f ? bind(contract, reference, f) : undefined;
        if (sym) follow.push({ domain, symbol: sym, args: [g] });
      }
    }
    (await runBatch(reference, follow)).forEach((r, i) => {
      if (r.ok && typeof r.value === "string") values.get(follow[i].domain)!.add(r.value);
    });
  }
  for (const set of values.values()) for (const e of GENERIC_EDGE) set.add(e);
  return new Map([...values].map(([d, s]) => [d, [...s]]));
}

/** What a corpus adds beyond the contract's test arguments and the generic edges: the part worth storing. */
export function minedValues(contract: Contract, corpus: Map<string, string[]>): Corpus {
  const own = new Map<string, Set<string>>();
  for (const fn of contract.functions.values()) {
    const set = own.get(fn.domain) ?? new Set<string>();
    for (const t of fn.tests) for (const a of t.args) if (typeof a === "string") set.add(a);
    own.set(fn.domain, set);
  }
  const out: Corpus = {};
  for (const [d, vals] of [...corpus].sort(([a], [b]) => a.localeCompare(b))) {
    const kept = vals.filter((v) => !own.get(d)?.has(v) && !GENERIC_EDGE.includes(v)).sort();
    if (kept.length) out[d] = kept;
  }
  return out;
}

export async function differential(
  contract: Contract,
  fns: ContractFunction[],
  libs: DiffLib[],
  referenceName: string,
  corpus?: Map<string, string[]>
): Promise<DiffRow[]> {
  const runnable = libs.filter((l) => l.adapter.runner);
  const reference = runnable.find((l) => l.name === referenceName) ?? runnable[0];
  corpus ??= await corpora(contract, [...new Set(fns.map((f) => f.domain))], reference);

  // Plan: every (fn, args) pair.
  const plan: Array<{ fn: ContractFunction; args: unknown[] }> = [];
  for (const fn of fns) {
    const required = fn.params.filter((p) => !p.optional);
    // Only deterministic tests: generators (`satisfies`/`matches`) differ by design.
    const inputs: unknown[][] = fn.tests.filter((t) => t.expect.kind === "returns" || t.expect.kind === "throws").map((t) => t.args);
    if (required.length === 1 && acceptsString(parseCType(required[0].type))) {
      for (const v of corpus.get(fn.domain) ?? []) inputs.push([v]);
    } else if (required.length === 0 && !/generate/i.test(fn.operation) && fn.domain !== "date") {
      // A no-argument call is only comparable when its answer is fixed: generators are random,
      // and a `date` function called without a date answers about today (date.isHoliday()),
      // so libs run at different moments (or time zones) would diverge for no reason.
      inputs.push([]);
    }
    for (const args of new Map(inputs.map((a) => [JSON.stringify(a), a])).values()) plan.push({ fn, args });
  }

  // One batch per lib.
  const answers = new Map<string, Array<Outcome | undefined>>();
  for (const lib of runnable) {
    const symbols = new Map(fns.map((fn) => [fn.id, bind(contract, lib, fn)]));
    const items = plan.map((p) => ({ p, symbol: symbols.get(p.fn.id) }));
    const runnableItems = items.filter((x): x is { p: (typeof plan)[number]; symbol: NativeSymbol } => !!x.symbol);
    const results = await runBatch(lib, runnableItems.map((x) => ({ symbol: x.symbol, args: x.p.args })));
    const byPlan = new Map(runnableItems.map((x, i) => [x.p, results[i]]));
    answers.set(lib.name, plan.map((p) => byPlan.get(p)));
  }

  const rows: DiffRow[] = [];
  plan.forEach((p, i) => {
    const groups = new Map<string, { value: unknown; error?: string; libs: string[] }>();
    for (const [lib, results] of answers) {
      const r = results[i];
      if (!r || (!r.ok && r.error?.startsWith("unsupported:"))) continue;
      const key = answerKey(r);
      const g = groups.get(key) ?? { value: r.value, error: r.ok ? undefined : r.error, libs: [] };
      g.libs.push(lib);
      groups.set(key, g);
    }
    if ([...groups.values()].reduce((n, g) => n + g.libs.length, 0) < 2) return;
    const ref = reference?.name ?? "";
    const sorted = [...groups.entries()]
      .map(([answer, g]) => ({ answer, ...g }))
      .sort((a, b) => b.libs.length - a.libs.length || Number(b.libs.includes(ref)) - Number(a.libs.includes(ref)));
    rows.push({ fn: p.fn.id, args: p.args, answers: sorted, agree: sorted.length === 1 });
  });
  return rows;
}

/** Majority answer (ties broken by the reference lib), as a contract test proposal. */
export function proposal(
  row: DiffRow,
  reference: string,
  existing: ContractFunction,
  opts: { unanimous?: boolean; minLibs?: number } = {}
): Record<string, unknown> | undefined {
  const top = row.answers[0];
  if (opts.unanimous && !row.agree) return undefined;
  if (top.libs.length < (opts.minLibs ?? 2)) return undefined;
  if (row.answers.length > 1 && row.answers[1].libs.length === top.libs.length && !top.libs.includes(reference)) return undefined;
  if (existing.tests.some((t) => valuesEqual(t.args, row.args))) return undefined;
  const others = row.answers.slice(1).map((a) => `${a.libs.join(", ")} → ${a.answer}`);
  const note = row.agree
    ? `consensus of ${top.libs.length} libs (${top.libs.map(shortName).join(", ")})`
    : `majority: ${top.libs.map(shortName).join(", ")}; differs: ${others.map((o) => o.replaceAll("brazilian-utils-", "")).join(" | ")}`;
  return top.answer === "<error>" ? { args: row.args, throws: true, note } : { args: row.args, returns: top.value ?? null, note };
}

/**
 * How libs split on a divergent input, independent of the input and of the answers:
 * `"go,rust | javascript,python,ruby"`. The same bug shows the same split on every input
 * that triggers it, so the split (not the input, which may be randomly generated) is what
 * the divergence baseline records.
 */
export function partition(row: DiffRow): string {
  return row.answers
    .map((a) => a.libs.map(shortName).sort().join(","))
    .sort()
    .join(" | ");
}

/** Known splits per function: `diff --fail-on-new` fails only on a split not listed here. */
export type DivergenceBaseline = Record<string, string[]>;

export function divergenceBaseline(rows: DiffRow[]): DivergenceBaseline {
  const out: DivergenceBaseline = {};
  for (const r of rows) if (!r.agree) out[r.fn] = [...new Set([...(out[r.fn] ?? []), partition(r)])].sort();
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export interface DivergenceDiff {
  /** Divergent rows whose split is not in the baseline for their function. */
  fresh: Array<{ row: DiffRow; split: string }>;
  /** Baseline splits not seen in this run (fixed, or not triggered by this run's inputs). */
  gone: Array<{ fn: string; split: string }>;
}

export function diffDivergences(rows: DiffRow[], baseline: DivergenceBaseline, fns: string[]): DivergenceDiff {
  const now = divergenceBaseline(rows);
  const fresh: DivergenceDiff["fresh"] = [];
  const reported = new Set<string>();
  for (const r of rows) {
    if (r.agree) continue;
    const split = partition(r);
    if ((baseline[r.fn] ?? []).includes(split) || reported.has(`${r.fn}|${split}`)) continue;
    reported.add(`${r.fn}|${split}`);
    fresh.push({ row: r, split });
  }
  const gone = fns.flatMap((fn) => (baseline[fn] ?? []).filter((s) => !(now[fn] ?? []).includes(s)).map((split) => ({ fn, split })));
  return { fresh, gone };
}
