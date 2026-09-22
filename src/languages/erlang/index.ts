/**
 * Erlang adapter. The lib is compiled with `erlc +debug_info` into the work dir and the API is
 * read from the compiled modules (tool.escript): exports as the runtime reports them, `-spec`
 * types, `-type` aliases (local `cpf()` and remote `brutils_cpf:cpf()` resolved) and
 * deprecations from the abstract code. Without an Erlang toolchain a source scanner is used
 * as a fallback, with a warning. `{ok, T} | {error, _}` maps to `T?`:
 * the error tuple is the idiomatic "no result", like Python's None or Rust's None.
 */
import fs from "node:fs";
import path from "node:path";
import { T, type CType } from "../../core/ctype.js";
import type { NativeParam, NativeSymbol } from "../../core/model.js";
import { snake } from "../../core/naming.js";
import { clean, readSource, lineAt, matchBracket, splitTopLevel } from "../shared/scanner.js";
import { makeTypeMapper } from "../shared/typemap.js";
import type { TypeNode } from "../shared/typeparse.js";
import type { AdapterContext, Extraction, LanguageAdapter } from "../types.js";
import { extractFromBeams, runErlang } from "./runner.js";
import { which } from "../../core/shell.js";

const CLEAN = { line: ["%"], strings: ['"'], chars: false };

/** Module name -> type name -> definition text. Filled by extract, read by mapType. */
const typeDefs = new Map<string, Map<string, string>>();

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ["test", "_build", ".git", "deps"].includes(e.name) ? [] : walk(p);
    return e.name.endsWith(".erl") ? [p] : [];
  });
}

/** Attribute bodies `-name(...).` in cleaned source, with their offsets. */
function attributes(cleaned: string, name: string): Array<{ body: string; offset: number }> {
  const out: Array<{ body: string; offset: number }> = [];
  const re = new RegExp(`^-${name}\\s*`, "gm");
  for (const m of cleaned.matchAll(re)) {
    let i = m.index! + m[0].length;
    if (cleaned[i] === "(") {
      const end = matchBracket(cleaned, i);
      out.push({ body: cleaned.slice(i + 1, end - 1), offset: m.index! });
    } else {
      // -spec f(...) -> T.   (no outer parens): up to the terminating "." at line end
      const end = cleaned.slice(i).search(/\.\s*(\n|$)/);
      out.push({ body: cleaned.slice(i, end < 0 ? undefined : i + end), offset: m.index! });
    }
  }
  return out;
}

function parseModule(file: string, root: string): { module: string; symbols: NativeSymbol[] } | undefined {
  const text = readSource(file);
  const cleaned = clean(text, CLEAN);
  const moduleName = /^-module\s*\(\s*'?(\w+)'?\s*\)/m.exec(cleaned)?.[1];
  if (!moduleName) return undefined;

  const exports = new Set<string>();
  for (const a of attributes(cleaned, "export")) {
    for (const item of a.body.replace(/[[\]\s]/g, "").split(",")) if (item) exports.add(item);
  }
  const exportAll = /^-compile\s*\([^)]*export_all/m.test(cleaned);

  const deprecated = new Set<string>();
  for (const a of attributes(cleaned, "deprecated")) {
    for (const m of a.body.matchAll(/\{\s*'?(\w+)'?\s*,\s*('_'|_|\d+)/g)) deprecated.add(`${m[1]}/${m[2]}`);
  }

  const types = new Map<string, string>();
  for (const kind of ["type", "opaque"]) {
    for (const a of attributes(cleaned, kind)) {
      const m = /^\s*'?(\w+)'?\s*\(([^)]*)\)\s*::\s*([\s\S]*)$/.exec(a.body);
      if (m) types.set(m[1], m[3].trim());
    }
  }
  typeDefs.set(moduleName, types);

  const specs = new Map<string, { args: string[]; ret: string }>();
  for (const a of attributes(cleaned, "spec")) {
    const m = /^\s*(?:'?\w+'?:)?'?(\w+)'?\s*\(/.exec(a.body);
    if (!m) continue;
    const open = a.body.indexOf("(", m.index);
    const close = matchBracket(a.body, open);
    const args = splitTopLevel(a.body.slice(open + 1, close - 1));
    const rest = a.body.slice(close).split(/;\s*\(/)[0]; // first clause only
    const ret = /->\s*([\s\S]*?)(\bwhen\b[\s\S]*)?$/.exec(rest)?.[1]?.trim() ?? "";
    specs.set(`${m[1]}/${args.length}`, { args, ret });
  }

  const symbols: NativeSymbol[] = [];
  const seen = new Set<string>();
  for (const m of cleaned.matchAll(/^'?([a-z]\w*)'?\s*\(/gm)) {
    const name = m[1];
    const open = m.index! + m[0].length - 1;
    const close = matchBracket(cleaned, open);
    if (close < 0) continue;
    const after = cleaned.slice(close, close + 200);
    if (!/^\s*(when\b[\s\S]*?)?->/.test(after)) continue; // not a clause head
    const argText = cleaned.slice(open + 1, close - 1);
    const args = argText.trim() ? splitTopLevel(argText) : [];
    const key = `${name}/${args.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!exportAll && !exports.has(key)) continue;

    const spec = specs.get(key);
    const params: NativeParam[] = args.map((pattern, i) => {
      const specArg = spec?.args[i];
      const annotated = specArg ? /^([A-Z]\w*)\s*::\s*([\s\S]+)$/.exec(specArg) : null;
      const varName = /^([A-Z]\w*)$/.exec(pattern.trim())?.[1] ?? /=\s*([A-Z]\w*)\s*$/.exec(pattern)?.[1] ?? /^([A-Z]\w*)\s*=/.exec(pattern)?.[1];
      return {
        name: annotated ? snake(annotated[1]) : varName ? snake(varName) : `arg${i + 1}`,
        type: annotated?.[2] ?? specArg
      };
    });
    symbols.push({
      name: `${moduleName}.${name}`,
      params,
      returns: spec?.ret,
      deprecated: deprecated.has(key) || deprecated.has(`${name}/_`) || deprecated.has(`${name}/'_'`) || undefined,
      location: { file: path.relative(root, file), line: lineAt(text, m.index!) },
      meta: { module: moduleName, arity: args.length }
    });
  }
  return { module: moduleName, symbols };
}

/** Fallback when no Erlang toolchain is installed: parse the source text. */
export function extractFromSource(ctx: AdapterContext): Extraction {
  const dir = path.join(ctx.root, ctx.lib.entry === "." ? "src" : ctx.lib.entry);
  const files = walk(fs.existsSync(dir) ? dir : ctx.root);
  const symbols: NativeSymbol[] = [];
  const warnings: string[] = ["erlc not found: API read from source text (less precise than the compiled modules)"];
  for (const f of files) {
    const parsed = parseModule(f, ctx.root);
    if (!parsed) warnings.push(`${path.relative(ctx.root, f)}: no -module attribute`);
    else symbols.push(...parsed.symbols);
  }
  return { symbols, warnings };
}

async function extract(ctx: AdapterContext): Promise<Extraction> {
  if (!which("erlc") || !which("escript")) return extractFromSource(ctx);
  const modules = extractFromBeams(ctx);
  for (const m of modules) typeDefs.set(m.module, new Map(Object.entries(m.types)));
  return { symbols: modules.flatMap((m) => m.symbols), warnings: [] };
}

const isAtom = (n: TypeNode, atom: string) => n.kind === "name" && n.name === atom && !n.call;

function mapErlang(native: string | undefined, module: string): CType {
  const depth = { n: 0 };
  const mapper = makeTypeMapper({
    names: {
      binary: T.string,
      bitstring: T.string,
      string: T.string,
      nonempty_string: T.string,
      unicode_binary: T.string,
      iodata: T.string,
      iolist: T.string,
      "unicode:chardata": T.string,
      char: T.string,
      boolean: T.boolean,
      integer: T.integer,
      non_neg_integer: T.integer,
      pos_integer: T.integer,
      neg_integer: T.integer,
      number: T.number,
      float: T.number,
      term: T.any,
      any: T.any,
      atom: T.string,
      undefined: T.null,
      nil: T.null,
      ok: T.void,
      list: (args, map) => T.list(args[0] ? map(args[0]) : T.unknown),
      nonempty_list: (args, map) => T.list(args[0] ? map(args[0]) : T.unknown),
      map: T.object(),
      "calendar:date": T.date,
      "calendar:datetime": T.date
    },
    fallback(node) {
      const [mod, name] = node.name.includes(":") ? node.name.split(":") : [module, node.name];
      if (!node.call) return T.literal(node.name); // bare atom, e.g. mobile | landline
      const def = typeDefs.get(mod)?.get(name);
      if (def && depth.n < 8) {
        depth.n++;
        const t = mapErlang(def, mod);
        depth.n--;
        return t;
      }
      return T.unknown;
    },
    tuple(items, map) {
      if (items.length >= 1 && isAtom(items[0], "ok")) return items.length === 2 ? map(items[1]) : T.void;
      if (items.length >= 1 && isAtom(items[0], "error")) return T.null;
      return T.unknown;
    },
    literal: true
  });
  return mapper(native);
}

export const erlang: LanguageAdapter = {
  id: "erlang",
  aliases: ["erl"],
  displayName: "Erlang",
  candidates(fn, lib) {
    const app = typeof lib.options.app === "string" ? lib.options.app : "brutils";
    return [
      `${app}.${snake(fn.flatName)}`, // facade: brutils:is_valid_cpf
      `${app}_${snake(fn.domain)}.${snake(fn.operation)}`, // brutils_cpf:is_valid
      `${app}_${snake(fn.domain)}.${snake(fn.flatName)}`
    ];
  },
  extract,
  mapType(native, _position, symbol) {
    const module = (symbol.meta?.module as string | undefined) ?? "";
    if (!native) return T.unknown;
    // `Name :: type()` annotations
    const annotated = /^[A-Z]\w*\s*::\s*([\s\S]+)$/.exec(native.trim());
    return mapErlang(annotated ? annotated[1] : native, module);
  },
  runner: { requires: ["erlc", "escript"], run: runErlang }
};

