/**
 * .NET adapter (F# and C#), source-based.
 *
 * F#: public `let` bindings that take parameters, directly inside a module (top-level
 *     `module A.B` file or nested `module X =`, tracked by indentation). `private`/`internal`
 *     excluded, `[<Obsolete>]` = deprecated. Types only when annotated.
 * C#: `public static` methods of public classes, `[Obsolete]` = deprecated.
 */
import fs from "node:fs";
import path from "node:path";
import { T } from "../../core/ctype.js";
import type { NativeParam, NativeSymbol } from "../../core/model.js";
import { pascal } from "../../core/naming.js";
import { clean, readSource, lineAt, matchBracket, splitTopLevel } from "../shared/scanner.js";
import { firstArg, listOf, makeTypeMapper, nullableOf } from "../shared/typemap.js";
import type { AdapterContext, Extraction, LanguageAdapter } from "../types.js";

function walk(dir: string, exts: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return /^(bin|obj|\.git|tests?|.*\.Tests?)$/i.test(e.name) ? [] : walk(p, exts);
    return exts.includes(path.extname(e.name)) ? [p] : [];
  });
}

// ---------------------------------------------------------------------------
// F#
// ---------------------------------------------------------------------------

function fsharpParams(raw: string): NativeParam[] {
  const params: NativeParam[] = [];
  let i = 0;
  const s = raw.trim();
  while (i < s.length) {
    while (/\s/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] === "(") {
      const end = matchBracket(s, i);
      const inner = s.slice(i + 1, end - 1).trim();
      i = end;
      if (!inner) continue; // unit
      for (const part of splitTopLevel(inner)) {
        const [name, ...type] = part.split(":");
        params.push({ name: name.trim(), type: type.join(":").trim() || undefined });
      }
    } else {
      const m = /^[A-Za-z_][\w']*/.exec(s.slice(i));
      if (!m) break;
      params.push({ name: m[0] });
      i += m[0].length;
    }
  }
  return params;
}

function extractFSharp(file: string, root: string): NativeSymbol[] {
  const text = readSource(file);
  const cleaned = clean(text, { line: ["//"], block: [["(*", "*)"]], nestedBlock: true, strings: ['"'], verbatim: true });
  const lines = cleaned.split("\n");
  const symbols: NativeSymbol[] = [];
  // Open modules: declaration indent (-1 = file-level module, never closed by indentation)
  // and body indent (-1 until the first body line is seen).
  const stack: Array<{ name: string; indent: number; body: number }> = [];
  let pendingAttrs = "";
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop();
    const top = stack[stack.length - 1];
    if (top && top.body === -1) top.body = indent; // first line of a nested module body

    const fileModule = /^module\s+(?:(?:public|internal|private)\s+)?(?:rec\s+)?([\w.]+)\s*$/.exec(trimmed);
    if (fileModule && indent === 0) {
      stack.length = 0;
      stack.push({ name: fileModule[1].split(".").pop()!, indent: -1, body: 0 });
      continue;
    }
    const nested = /^module\s+(private\s+|internal\s+)?([\w]+)\s*=\s*$/.exec(trimmed);
    if (nested) {
      stack.push({ name: nested[1] ? "" : nested[2], indent, body: -1 });
      continue;
    }
    if (/^\[<.*>\]\s*$/.test(trimmed)) {
      pendingAttrs += trimmed;
      continue;
    }
    const attrs = pendingAttrs;
    pendingAttrs = "";
    const current = stack[stack.length - 1];
    if (!current || !current.name) continue;
    if (indent !== current.body) continue;
    const m = /^let\s+(?:inline\s+)?(?:(private|internal|public)\s+)?(?:rec\s+)?([A-Za-z_][\w']*)\b([\s\S]*)$/.exec(trimmed);
    if (!m || m[1] === "private" || m[1] === "internal" || m[2].startsWith("_")) continue;
    // Header up to the binding "=" at depth 0 (may span lines).
    let header = m[3];
    let k = n;
    while (!/(^|[^=<>!:])=($|[^=>])/.test(header.replace(/\([^()]*\)/g, "")) && k + 1 < lines.length) header += " " + lines[++k].trim();
    let depth = 0;
    let eq = -1;
    for (let c = 0; c < header.length; c++) {
      const ch = header[c];
      if (ch === "(" || ch === "[" || ch === "<") depth++;
      else if (ch === ")" || ch === "]" || (ch === ">" && header[c - 1] !== "-")) depth--;
      else if (ch === "=" && depth === 0 && header[c + 1] !== ">" ) {
        eq = c;
        break;
      }
    }
    const beforeEq = eq >= 0 ? header.slice(0, eq) : header;
    const afterEq = eq >= 0 ? header.slice(eq + 1).trim() : "";
    let colon = -1;
    depth = 0;
    for (let c = 0; c < beforeEq.length; c++) {
      const ch = beforeEq[c];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === ":" && depth === 0) {
        colon = c;
        break;
      }
    }
    const paramText = colon >= 0 ? beforeEq.slice(0, colon) : beforeEq;
    const returns = colon >= 0 ? beforeEq.slice(colon + 1).trim() : undefined;
    const isFunction = paramText.trim().length > 0 || /^fun\b/.test(afterEq);
    if (!isFunction) continue;
    symbols.push({
      name: `${current.name}.${m[2]}`,
      params: fsharpParams(paramText),
      returns: returns || undefined,
      deprecated: /Obsolete/.test(attrs) || undefined,
      location: { file: path.relative(root, file), line: n + 1 }
    });
  }
  return symbols;
}

// ---------------------------------------------------------------------------
// C#
// ---------------------------------------------------------------------------

function csharpParams(raw: string): NativeParam[] {
  return splitTopLevel(raw).map((part, i) => {
    let p = part.replace(/\[[^\]]*\]\s*/g, "").trim();
    const rest = /^params\s/.test(p);
    p = p.replace(/^(this|params|ref|out|in)\s+/, "");
    const [decl, def] = p.split("=");
    const m = /^([\s\S]+?)\s+(@?\w+)$/.exec(decl.trim());
    return { name: m?.[2] ?? `arg${i}`, type: m?.[1], optional: def !== undefined || rest || undefined, rest: rest || undefined };
  });
}

function extractCSharp(file: string, root: string): NativeSymbol[] {
  const text = readSource(file);
  const cleaned = clean(text, { line: ["//"], block: [["/*", "*/"]], strings: ['"'], chars: true, verbatim: true });
  const symbols: NativeSymbol[] = [];
  for (const cls of cleaned.matchAll(/\bpublic\s+(?:static\s+|sealed\s+|partial\s+|abstract\s+)*class\s+(\w+)[^{]*\{/g)) {
    const open = cls.index! + cls[0].length - 1;
    const close = matchBracket(cleaned, open);
    const body = cleaned.slice(open, close);
    for (const m of body.matchAll(/((?:\[[^\]]*\]\s*)*)public\s+static\s+(?:async\s+)?([\w<>,.?\[\]\s]+?)\s+(\w+)\s*(<[^>]*>)?\s*\(/g)) {
      const pOpen = m.index! + m[0].length - 1;
      const pClose = matchBracket(body, pOpen);
      symbols.push({
        name: `${cls[1]}.${m[3]}`,
        params: csharpParams(text.slice(open + pOpen + 1, open + pClose - 1)),
        returns: m[2].trim(),
        deprecated: /Obsolete/.test(m[1]) || undefined,
        location: { file: path.relative(root, file), line: lineAt(text, open + m.index!) }
      });
    }
  }
  return symbols;
}

async function extract(ctx: AdapterContext): Promise<Extraction> {
  const dir = path.join(ctx.root, ctx.lib.entry);
  const symbols = [
    ...walk(dir, [".fs"]).flatMap((f) => extractFSharp(f, ctx.root)),
    ...walk(dir, [".cs"]).flatMap((f) => extractCSharp(f, ctx.root))
  ];
  return { symbols, warnings: symbols.length ? [] : [`no public functions found under ${ctx.lib.entry}`] };
}

const int = T.integer;
const mapDotnet = makeTypeMapper({
  names: {
    string: T.string, String: T.string, char: T.string, Char: T.string,
    bool: T.boolean, Boolean: T.boolean,
    int: int, Int32: int, int64: int, Int64: int, long: int, short: int, byte: int, uint: int, ulong: int,
    float: T.number, double: T.number, Double: T.number, decimal: T.number, Decimal: T.number, single: T.number,
    unit: T.void, void: T.void,
    obj: T.any, object: T.any,
    DateTime: T.date, DateOnly: T.date, DateTimeOffset: T.date,
    option: nullableOf, Option: nullableOf, Nullable: nullableOf,
    list: listOf, List: listOf, IList: listOf, IEnumerable: listOf, IReadOnlyList: listOf, seq: listOf, array: listOf, ICollection: listOf,
    Task: firstArg, Async: firstArg, Result: firstArg
  }
});

export const dotnet: LanguageAdapter = {
  id: "dotnet",
  aliases: ["csharp", "fsharp", "c#", "f#"],
  displayName: ".NET",
  optionalParams: false,
  candidates: (fn) => {
    const mod = pascal(fn.domain);
    return [`${mod}.${pascal(fn.operation)}`, `${mod}.${pascal(fn.flatName)}`, `${mod}Utils.${pascal(fn.operation)}`];
  },
  extract,
  mapType(native, position) {
    if (!native) return T.unknown;
    // F# postfix generics: `string option`, `int list`
    const post = /^(.+?)\s+(option|list|seq|array)$/.exec(native.trim());
    if (post) return mapDotnet(`${post[2]}<${post[1]}>`);
    const t = mapDotnet(native);
    return position === "return" && t.k === "void" ? T.void : t;
  }
};
