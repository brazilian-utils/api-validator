/**
 * Rust public API extraction without a nightly toolchain.
 *
 * Follows the module tree from the crate root (`mod x;` -> x.rs | x/mod.rs, inline
 * `mod x { }`), keeps only items reachable from outside the crate (`pub` all the way down,
 * `pub(crate)`/`pub(super)` excluded), skips `#[cfg(test)]` items, resolves `pub use`
 * re-exports (named, renamed, braced and glob) and records `#[deprecated]`.
 */
import fs from "node:fs";
import path from "node:path";
import type { NativeParam, NativeSymbol } from "../../core/model.js";
import { clean, readSource, lineAt, matchAngle, matchBracket, splitTopLevel } from "../shared/scanner.js";

interface FnItem {
  name: string;
  params: NativeParam[];
  paramTypes: string[];
  returns?: string;
  deprecated: boolean;
  file: string;
  line: number;
}

interface UseItem {
  path: string[]; // e.g. ["crate", "cpf", "is_valid"] or [..., "*"]
  as?: string;
}

interface Module {
  path: string[]; // [] = crate root
  public: boolean; // reachable from outside the crate
  fns: FnItem[];
  uses: UseItem[]; // pub use only
  children: Module[];
}

const CLEAN = { line: ["//"], block: [["/*", "*/"]] as Array<[string, string]>, nestedBlock: true, strings: ['"'], rustRaw: true, chars: true };

function parseParams(raw: string): { params: NativeParam[]; types: string[] } {
  const params: NativeParam[] = [];
  const types: string[] = [];
  for (const part of splitTopLevel(raw)) {
    if (/^(&\s*('\w+\s+)?)?(mut\s+)?self\b/.test(part)) continue;
    const colon = splitTopLevel(part, ":");
    const idx = part.indexOf(":");
    if (idx < 0 || colon.length < 2) continue;
    const name = part.slice(0, idx).replace(/\bmut\b/, "").trim();
    const type = part.slice(idx + 1).trim();
    params.push({ name: /^\w+$/.test(name) ? name : `arg${params.length}`, type });
    types.push(type);
  }
  return { params, types };
}

function parseUse(spec: string): UseItem[] {
  const s = spec.trim();
  const brace = s.indexOf("{");
  if (brace >= 0) {
    const prefix = s.slice(0, brace).replace(/\s+/g, "").replace(/::$/, "");
    const inner = s.slice(brace + 1, s.lastIndexOf("}"));
    return splitTopLevel(inner).flatMap((item) => parseUse(prefix ? `${prefix}::${item}` : item));
  }
  const m = /^([\s\S]*?)\s+as\s+(\w+)$/.exec(s);
  const p = (m ? m[1] : s).replace(/\s+/g, "");
  return [{ path: p.split("::").filter(Boolean), as: m?.[2] }];
}

function moduleFile(dir: string, name: string): string | undefined {
  for (const f of [path.join(dir, `${name}.rs`), path.join(dir, name, "mod.rs")]) if (fs.existsSync(f)) return f;
  return undefined;
}

function parseItems(text: string, cleanText: string, from: number, to: number, mod: Module, file: string, childDir: string, root: string, warnings: string[]) {
  let i = from;
  let attrs: string[] = [];
  while (i < to) {
    while (i < to && /\s/.test(cleanText[i])) i++;
    if (i >= to) break;
    if (cleanText[i] === "#" && (cleanText[i + 1] === "[" || (cleanText[i + 1] === "!" && cleanText[i + 2] === "["))) {
      const open = cleanText.indexOf("[", i);
      const end = matchBracket(cleanText, open);
      if (end < 0) break;
      if (cleanText[i + 1] !== "!") attrs.push(cleanText.slice(open + 1, end - 1));
      i = end;
      continue;
    }
    // Item header: up to `;` or `{` at paren/bracket depth 0. A `use` item has no body:
    // its braces (`use a::{b, c};`) are part of the path, so it always ends at `;`.
    const isUse = /^(pub(\s*\([^)]*\))?\s+)?use\s/.test(cleanText.slice(i, i + 40));
    let j = i;
    let depth = 0;
    while (j < to) {
      const c = cleanText[j];
      if (c === "(" || c === "[" || (isUse && c === "{")) depth++;
      else if (c === ")" || c === "]" || (isUse && c === "}")) depth--;
      else if (depth === 0 && (c === ";" || c === "{")) break;
      j++;
    }
    const header = cleanText.slice(i, j).trim();
    let bodyStart = -1;
    let next = j + 1;
    if (cleanText[j] === "{") {
      bodyStart = j + 1;
      const end = matchBracket(cleanText, j);
      next = end < 0 ? to : end;
    }
    const cfgTest = attrs.some((a) => /^cfg\s*\(\s*test\s*\)/.test(a.trim()));
    const deprecated = attrs.some((a) => /^deprecated\b/.test(a.trim()));
    attrs = [];
    const itemStart = i;
    i = next;
    if (cfgTest) continue;

    const vis = /^pub(\s*\(([^)]*)\))?\s+/.exec(header);
    const isPub = !!vis && !vis[2];
    const rest = vis ? header.slice(vis[0].length) : header;

    const modMatch = /^mod\s+(\w+)$/.exec(rest);
    if (modMatch) {
      const name = modMatch[1];
      const child: Module = { path: [...mod.path, name], public: mod.public && isPub, fns: [], uses: [], children: [] };
      mod.children.push(child);
      if (bodyStart >= 0) {
        parseItems(text, cleanText, bodyStart, next - 1, child, file, path.join(childDir, name), root, warnings);
      } else {
        const f = moduleFile(childDir, name);
        if (!f) warnings.push(`${path.relative(root, file)}: module "${name}" file not found`);
        else parseFile(f, child, root, warnings);
      }
      continue;
    }

    if (isPub && /^use\s/.test(rest)) {
      mod.uses.push(...parseUse(rest.replace(/^use\s+/, "")));
      continue;
    }

    const fnMatch = /^(?:const\s+|async\s+|unsafe\s+|extern\s+(?:"[^"]*"\s+)?)*fn\s+(\w+)\s*/.exec(rest);
    if (fnMatch && isPub) {
      const name = fnMatch[1];
      const headerOffset = cleanText.indexOf(rest, itemStart);
      let k = headerOffset + fnMatch[0].length;
      if (cleanText[k] === "<") k = matchAngle(cleanText, k);
      while (/\s/.test(cleanText[k])) k++;
      if (cleanText[k] !== "(") continue;
      const pEnd = matchBracket(cleanText, k);
      const { params, types } = parseParams(text.slice(k + 1, pEnd - 1));
      const tail = cleanText.slice(pEnd, j).trim();
      const ret = /^->\s*([\s\S]*?)(\bwhere\b[\s\S]*)?$/.exec(tail)?.[1]?.trim();
      mod.fns.push({
        name,
        params,
        paramTypes: types,
        returns: ret ? text.slice(pEnd, j).trim().replace(/^->\s*/, "").replace(/\bwhere\b[\s\S]*$/, "").trim() : undefined,
        deprecated,
        file: path.relative(root, file),
        line: lineAt(text, itemStart)
      });
    }
  }
}

function parseFile(file: string, mod: Module, root: string, warnings: string[]) {
  const text = readSource(file);
  const cleaned = clean(text, CLEAN);
  const base = path.basename(file);
  const childDir = ["lib.rs", "main.rs", "mod.rs"].includes(base) ? path.dirname(file) : path.join(path.dirname(file), base.replace(/\.rs$/, ""));
  parseItems(text, cleaned, 0, text.length, mod, file, childDir, root, warnings);
}

export function extractRust(root: string, entry: string): { symbols: NativeSymbol[]; warnings: string[] } {
  const warnings: string[] = [];
  const crateRoot: Module = { path: [], public: true, fns: [], uses: [], children: [] };
  const entryFile = path.join(root, entry);
  if (!fs.existsSync(entryFile)) throw new Error(`Rust entry not found: ${entryFile}`);
  parseFile(entryFile, crateRoot, root, warnings);

  const all: Module[] = [];
  const walk = (m: Module) => {
    all.push(m);
    m.children.forEach(walk);
  };
  walk(crateRoot);
  const byPath = new Map(all.map((m) => [m.path.join("::"), m]));

  const toSymbol = (m: Module, f: FnItem, name = f.name, aliasOf?: string): NativeSymbol => ({
    name: [...m.path, name].join("."),
    params: f.params,
    returns: f.returns,
    deprecated: f.deprecated || undefined,
    aliasOf,
    location: { file: f.file, line: f.line },
    meta: { rustPath: [...m.path, f.name].join("::"), paramTypes: f.paramTypes }
  });

  const symbols: NativeSymbol[] = [];
  for (const m of all) if (m.public) for (const f of m.fns) symbols.push(toSymbol(m, f));

  // Re-exports: resolve against module paths (crate::, self::, super::, or relative).
  for (const m of all) {
    if (!m.public) continue;
    for (const u of m.uses) {
      let parts = [...u.path];
      let base: string[];
      if (parts[0] === "crate") {
        base = [];
        parts = parts.slice(1);
      } else if (parts[0] === "self") {
        base = [...m.path];
        parts = parts.slice(1);
      } else {
        base = [...m.path];
        while (parts[0] === "super") {
          base.pop();
          parts = parts.slice(1);
        }
      }
      const item = parts.pop()!;
      const target = byPath.get([...base, ...parts].join("::")) ?? byPath.get(parts.join("::"));
      if (!target) continue; // external crate re-export
      const fns = item === "*" ? target.fns : target.fns.filter((f) => f.name === item);
      for (const f of fns) {
        const alias = item === "*" ? f.name : u.as ?? f.name;
        const s = toSymbol(target, f, alias);
        symbols.push({ ...s, name: [...m.path, alias].join("."), aliasOf: [...target.path, f.name].join(".") });
      }
    }
  }
  const seen = new Set<string>();
  return {
    symbols: symbols.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true))),
    warnings
  };
}
