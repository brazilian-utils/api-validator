import type { LanguageAdapter } from "../languages/types.js";
import type { ContractFunction, Issue, LibConfig, NativeSymbol } from "./model.js";
import { globMatch, lookupKey, similarity, tokens, words } from "./naming.js";

export class SymbolIndex {
  private readonly byKey = new Map<string, NativeSymbol[]>();

  constructor(readonly symbols: NativeSymbol[]) {
    for (const s of symbols) {
      const key = lookupKey(s.name);
      const list = this.byKey.get(key) ?? [];
      list.push(s);
      this.byKey.set(key, list);
    }
  }

  /** All overloads for a name (case/separator-insensitive). Exact-case matches first. */
  get(name: string): NativeSymbol[] {
    const found = this.byKey.get(lookupKey(name)) ?? [];
    return [...found].sort((a, b) => Number(b.name === name) - Number(a.name === name));
  }

  /** The definition a (possibly re-exported) symbol ultimately refers to. */
  definition(symbol: NativeSymbol): NativeSymbol {
    let current = symbol;
    const seen = new Set<string>();
    while (current.aliasOf && !seen.has(current.aliasOf)) {
      seen.add(current.aliasOf);
      const next = this.get(current.aliasOf)[0];
      if (!next) break;
      current = next;
    }
    return current;
  }

  /** The symbol a name ultimately refers to (follows re-export aliases). */
  target(symbol: NativeSymbol): string {
    let current = symbol;
    const seen = new Set<string>();
    while (current.aliasOf && !seen.has(current.aliasOf)) {
      seen.add(current.aliasOf);
      const next = this.get(current.aliasOf)[0];
      if (!next) return lookupKey(current.aliasOf);
      current = next;
    }
    return lookupKey(current.name);
  }
}

export interface Resolution {
  overloads: NativeSymbol[];
  matchedBy: "binding" | "convention";
  issues: Issue[];
}

/** Find the native symbol(s) implementing a contract function. */
export function resolve(
  fn: ContractFunction,
  lib: LibConfig,
  adapter: LanguageAdapter,
  index: SymbolIndex
): Resolution | { overloads: []; issues: Issue[] } {
  const issues: Issue[] = [];
  const binding = lib.bindings[fn.id];
  if (binding !== undefined) {
    const names = Array.isArray(binding) ? binding : [binding];
    for (const name of names) {
      const overloads = index.get(name);
      if (overloads.length > 0) return { overloads, matchedBy: "binding", issues };
    }
    issues.push({
      severity: "error",
      code: "binding-broken",
      message: `binding points to ${names.map((n) => `"${n}"`).join(", ")} but no such public symbol exists`
    });
    return { overloads: [], issues };
  }

  let deprecatedHit: NativeSymbol[] | undefined;
  const names = fn.spellings.flatMap((sp) => adapter.candidates({ ...fn, ...sp }, lib));
  for (const name of [...new Set(names)]) {
    const overloads = index.get(name);
    if (overloads.length === 0) continue;
    if (overloads.every((s) => s.deprecated)) {
      deprecatedHit ??= overloads;
      continue;
    }
    return { overloads: overloads.filter((s) => !s.deprecated), matchedBy: "convention", issues };
  }
  if (deprecatedHit) {
    issues.push({ severity: "warning", code: "deprecated-only", message: `only a deprecated symbol implements this (${deprecatedHit[0].name})` });
    return { overloads: deprecatedHit, matchedBy: "convention", issues };
  }
  return { overloads: [], issues };
}

export function isIgnored(lib: LibConfig, symbol: string): boolean {
  return lib.ignore.some((pattern) => globMatch(pattern, symbol));
}

/** The operation tokens of a contract function, without its domain tokens. */
function operationTokens(fn: ContractFunction): Set<string> {
  const domain = tokens(fn.domain);
  return new Set([...tokens(`${fn.operation} ${fn.flatName}`)].filter((t) => !domain.has(t)));
}

const DIRECTION = new Set(["by", "from", "to"]);

/**
 * The (result, input) halves of a directional name: `getCodeByName` and `code_from_name` give
 * ({get, code}, {name}), `name_to_code` gives ({code}, {name}). Only the last name segment.
 */
function direction(name: string, drop: Set<string>): { out: Set<string>; in: Set<string> } | undefined {
  const ws = words(name.split(".").pop() ?? name);
  const i = ws.findIndex((w) => DIRECTION.has(w));
  if (i <= 0 || i === ws.length - 1) return undefined;
  const part = (xs: string[]) => new Set([...tokens(xs.join(" "))].filter((t) => !drop.has(t)));
  const [before, after] = [part(ws.slice(0, i)), part(ws.slice(i + 1))];
  return ws[i] === "to" ? { out: after, in: before } : { out: before, in: after };
}

const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((t) => b.has(t)).length;

/**
 * Rank how likely `symbol` implements `fn`. Token similarity of the operation (the domain
 * tokens are left out, and the operation must share at least one token), with a bonus when
 * the domain is present (a CPF function almost never implements a CNPJ contract). Directional
 * names must point the same way: `getCodeByName` is not `name_from_code`.
 */
export function score(fn: ContractFunction, symbol: string): number {
  const domainTokens = tokens(fn.domain);
  const s = tokens(symbol);
  const op = operationTokens(fn);
  const symOp = new Set([...s].filter((t) => !domainTokens.has(t)));
  if (overlap(op, symOp) === 0) return 0;
  const fd = direction(fn.operation, domainTokens);
  const sd = direction(symbol, domainTokens);
  if (fd && sd && overlap(fd.out, sd.in) + overlap(fd.in, sd.out) > overlap(fd.out, sd.out) + overlap(fd.in, sd.in)) return 0;
  let value = similarity(op, symOp);
  const hasDomain = [...domainTokens].every((t) => s.has(t));
  value = hasDomain ? Math.min(1, value + 0.15) : value * 0.6;
  return Math.round(value * 100) / 100;
}

const SUGGESTION_THRESHOLD = 0.55;

/** Whether a symbol could implement a function (its best overload has no signature error). */
export type Compatible = (fn: ContractFunction, symbol: string) => boolean;

/** Symbols that may implement a missing function: one entry per name (overloads are one symbol). */
export function suggestSymbols(fn: ContractFunction, candidates: NativeSymbol[], limit = 3, compatible?: Compatible) {
  return [...new Set(candidates.map((s) => s.name))]
    .map((name) => ({ symbol: name, score: score(fn, name) }))
    .filter((s) => s.score >= SUGGESTION_THRESHOLD && (!compatible || compatible(fn, s.symbol)))
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}

export function suggestFunctions(symbol: string, fns: ContractFunction[], limit = 3, compatible?: Compatible) {
  return fns
    .map((fn) => ({ id: fn.id, score: score(fn, symbol), fn }))
    .filter((s) => s.score >= SUGGESTION_THRESHOLD && (!compatible || compatible(s.fn, symbol)))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ id, score }) => ({ id, score }));
}

/**
 * Proposed lib-config `bindings` from the unmapped symbols' suggestions: a symbol whose two best
 * suggestions tie is ambiguous and left out; when several symbols point at the same function,
 * the best one wins, and a tie between them leaves the function out.
 */
export function proposeBindings(unmapped: Array<{ symbol: string; suggestions: Array<{ id: string; score: number }> }>): Record<string, string> {
  const best = new Map<string, { symbol: string; score: number; tied: boolean }>();
  for (const u of unmapped) {
    const [top, next] = u.suggestions;
    if (!top || (next && next.score === top.score)) continue;
    const seen = best.get(top.id);
    if (!seen || top.score > seen.score) best.set(top.id, { symbol: u.symbol, score: top.score, tied: false });
    else if (top.score === seen.score && seen.symbol !== u.symbol) seen.tied = true;
  }
  return Object.fromEntries([...best].filter(([, b]) => !b.tied).sort(([a], [b]) => a.localeCompare(b)).map(([id, b]) => [id, b.symbol]));
}
