/**
 * Canonical JSON for the files people edit by hand (contract/*.json, libs/*.json): a stable
 * key order, 2-space indent, and any object or array that fits on one line kept on one line,
 * so a test case reads as one row:
 *
 *   { "args": ["40364478081"], "returns": true, "note": "…" }
 *
 * `api-validator fmt` rewrites files in this form; CI runs `fmt --check`.
 */

const WIDTH = 120;
const ROW_MAX = 400;

/** Key order per object kind; keys not listed keep their relative order, after the listed ones. */
const KEY_ORDER = {
  domain: ["$schema", "domain", "title", "summary", "category", "order", "related", "aliases", "functions"],
  fn: ["summary", "label", "description", "references", "flatName", "aliases", "level", "network", "fallible", "deprecated", "params", "returns", "tests"],
  param: ["name", "type", "optional", "description"],
  test: ["name", "args", "returns", "throws", "matches", "satisfies", "repeat", "note"],
  lib: ["$schema", "name", "language", "notes", "repo", "branch", "entry", "options", "bindings", "ignore", "waivers", "knownFailures", "site"]
} as const;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function ordered(obj: { [k: string]: Json }, order: readonly string[]): { [k: string]: Json } {
  const keys = Object.keys(obj);
  const rank = (k: string) => {
    const i = order.indexOf(k);
    return i < 0 ? order.length + keys.indexOf(k) : i;
  };
  return Object.fromEntries(keys.sort((a, b) => rank(a) - rank(b)).map((k) => [k, obj[k]]));
}

/** Multi-line text (markdown) as an array of lines: readable in JSON, no `\n` soup. */
function lines(v: Json | undefined): Json | undefined {
  if (typeof v !== "string" || !v.includes("\n")) return v;
  return v.replace(/\n+$/, "").split("\n");
}

/** Put the keys of a contract domain file in canonical order. */
export function orderDomain(doc: { [k: string]: Json }): { [k: string]: Json } {
  const out = ordered(doc, KEY_ORDER.domain);
  const fns = out.functions as { [k: string]: { [k: string]: Json } } | undefined;
  if (fns && typeof fns === "object") {
    out.functions = Object.fromEntries(
      Object.entries(fns).map(([op, fn]) => {
        const f = ordered(fn, KEY_ORDER.fn);
        if (f.description !== undefined) f.description = lines(f.description)!;
        if (Array.isArray(f.params)) f.params = f.params.map((p) => ordered(p as { [k: string]: Json }, KEY_ORDER.param));
        if (Array.isArray(f.tests)) f.tests = f.tests.map((t) => ordered(t as { [k: string]: Json }, KEY_ORDER.test));
        return [op, f];
      })
    );
  }
  return out;
}

export function orderLib(doc: { [k: string]: Json }): { [k: string]: Json } {
  return ordered(doc, KEY_ORDER.lib);
}

function inline(v: Json): string {
  if (Array.isArray(v)) return `[${v.map(inline).join(", ")}]`;
  if (v !== null && typeof v === "object") {
    const entries = Object.entries(v);
    return entries.length ? `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")} }` : "{}";
  }
  return JSON.stringify(v);
}

/** Arrays whose items always stay on one line each, however long: one test case = one row. */
const ONE_ROW_ITEMS = new Set(["tests", "params"]);

function print(v: Json, indent: string, prefixLen: number, key?: string): string {
  const flat = inline(v);
  if (v === null || typeof v !== "object" || indent.length + prefixLen + flat.length <= WIDTH || flat.length <= 2) return flat;
  const inner = `${indent}  `;
  if (Array.isArray(v)) {
    // Rows stay on one line unless huge (a whole table as expected value): then they expand.
    const rows = key && ONE_ROW_ITEMS.has(key);
    return `[\n${v.map((x) => `${inner}${rows && inline(x).length <= ROW_MAX ? inline(x) : print(x, inner, 0)}`).join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(v).map(([k, x]) => {
    const prefix = `${JSON.stringify(k)}: `;
    return `${inner}${prefix}${print(x, inner, prefix.length, k)}`;
  });
  return `{\n${entries.join(",\n")}\n${indent}}`;
}

export function formatJson(value: unknown): string {
  return `${print(value as Json, "", 0)}\n`;
}
