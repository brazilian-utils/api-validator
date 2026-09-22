import type { LanguageAdapter } from "../languages/types.js";
import type { ContractFunction, Issue, LibConfig, NativeSymbol } from "./model.js";
import { globMatch, lookupKey, similarity, tokens } from "./naming.js";

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

function fnTokens(fn: ContractFunction): Set<string> {
  return tokens(`${fn.domain} ${fn.operation} ${fn.flatName}`);
}

/**
 * Rank how likely `symbol` implements `fn`. Token similarity, with a bonus when the domain
 * is present (a CPF function almost never implements a CNPJ contract).
 */
export function score(fn: ContractFunction, symbol: string): number {
  const f = fnTokens(fn);
  const s = tokens(symbol);
  let value = similarity(f, s);
  const domainTokens = tokens(fn.domain);
  const hasDomain = [...domainTokens].every((t) => s.has(t));
  value = hasDomain ? Math.min(1, value + 0.15) : value * 0.6;
  return Math.round(value * 100) / 100;
}

export const SUGGESTION_THRESHOLD = 0.55;

export function suggestSymbols(fn: ContractFunction, candidates: NativeSymbol[], limit = 3) {
  return candidates
    .map((s) => ({ symbol: s.name, score: score(fn, s.name) }))
    .filter((s) => s.score >= SUGGESTION_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}

export function suggestFunctions(symbol: string, fns: ContractFunction[], limit = 3) {
  return fns
    .map((fn) => ({ id: fn.id, score: score(fn, symbol) }))
    .filter((s) => s.score >= SUGGESTION_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}
