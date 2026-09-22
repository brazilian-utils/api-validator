/**
 * Contract tests as a Cargo integration test (`tests/api_contract.rs`, run by `cargo test`).
 * Arguments and expected values are typed Rust literals built by the conformance runner's
 * own builders, and the conventions match it: `Result` Err (or a panic) = throws, `Option`
 * None = null, floats compared with the validator's 1e-9 tolerance. One `mod` per contract
 * function, one `#[test]` per contract test.
 */
import type { ExportCase, ExportGroup, Rendered, Unexpressible } from "../../core/testgen.js";
import type { NativeSymbol, TypeNode } from "../../core/model.js";
import { snake } from "../../core/naming.js";
import type { AdapterContext, TestGenerator } from "../types.js";
import { crateInfo } from "./cargo.js";
import { isResultType, last, rustArgs, rustLiteral, rustPathOf, Unsupported } from "./runner.js";
import { isStringTrait } from "./traits.js";

const KEYWORDS = new Set(
  (
    "as break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self " +
    "static struct super trait true type unsafe use where while async await dyn abstract become box do final macro override priv " +
    "typeof unsized virtual yield try gen union"
  ).split(" ")
);

/** Helpers the generated file may define (emitted only when used). */
const HELPERS = {
  panics: [
    "/// `throws`: the call panics.",
    "fn panics<T>(call: impl FnOnce() -> T + std::panic::UnwindSafe) -> bool {",
    "    std::panic::catch_unwind(call).is_err()",
    "}"
  ],
  fails: [
    "/// `throws` for a `Result`: the call returns `Err` (or panics).",
    "fn fails<T, E>(call: impl FnOnce() -> Result<T, E> + std::panic::UnwindSafe) -> bool {",
    "    std::panic::catch_unwind(call).map_or(true, |r| r.is_err())",
    "}"
  ],
  assert_close: [
    "/// Numbers compare like the api-validator: within 1e-9 (relative above 1).",
    "fn assert_close(actual: f64, expected: f64) {",
    "    let tolerance = 1e-9 * expected.abs().max(1.0);",
    '    assert!((actual - expected).abs() <= tolerance, "expected {expected}, got {actual}");',
    "}"
  ]
} as const;
type Helper = keyof typeof HELPERS;

const nameOf = (t: TypeNode | undefined, ...names: string[]) => t?.kind === "name" && names.includes(last(t.name));
const argOf = (t: TypeNode | undefined) => (t?.kind === "name" ? t.args?.[0] : undefined);
const isUnit = (t: TypeNode | undefined) => !t || nameOf(t, "()") || (t.kind === "tuple" && t.of.length === 0);
const isStrRef = (t: TypeNode | undefined) => t?.kind === "ref" && nameOf(t.of, "str");
const isFloat = (t: TypeNode | undefined) => nameOf(t, "f32", "f64");

function hasFloat(t: TypeNode | undefined): boolean {
  if (!t) return false;
  if (isFloat(t)) return true;
  if (t.kind === "name") return (t.args ?? []).some(hasFloat);
  if (t.kind === "ref" || t.kind === "list") return hasFloat(t.of);
  if (t.kind === "tuple" || t.kind === "union") return t.of.some(hasFloat);
  return false;
}

/** `(5u32)` -> `5u32` outside string/char literals (the runner's literals are parenthesised for method calls). */
export function tidy(code: string): string {
  let out = "";
  for (let i = 0; i < code.length; ) {
    const ch = code[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) j += code[j] === "\\" ? 2 : 1;
      out += code.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    // Not a call's or macro's own parentheses: `f(2u8)` stays, `f((2u8))` loses the inner pair.
    const m = ch === "(" && !/[\w!\])>]$/.test(out.trimEnd()) ? /^\((-?\d[\d.]*(?:e[+-]?\d+)?(?:[iu](?:8|16|32|64|128|size)|f32|f64))\)/.exec(code.slice(i)) : null;
    if (m) {
      out += m[1];
      i += m[0].length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

const str = (s: string) => rustLiteral({ kind: "ref", op: "&", of: { kind: "name", name: "str" } }, s);

interface Body {
  lines: string[];
  helpers: Helper[];
  regex?: boolean;
  modules: string[];
}

/** `value` of a successful call: unwraps `Result` (Err = failure, like the validator). */
function unwrapped(call: string, ret: TypeNode | undefined): { expr: string; type: TypeNode | undefined } {
  if (isResultType(ret)) return { expr: `${call}.unwrap()`, type: argOf(ret) };
  return { expr: call, type: ret };
}

/** A string-typed value for `matches` / `satisfies` (None fails, as null is not a string). */
function stringValue(expr: string, t: TypeNode | undefined): { expr: string; type: TypeNode } | undefined {
  if (nameOf(t, "Option") && (nameOf(argOf(t), "String") || isStrRef(argOf(t)))) return { expr: `${expr}.expect("returned None")`, type: argOf(t)! };
  if (nameOf(t, "String") || isStrRef(t)) return { expr, type: t! };
  return undefined;
}

function returns(value: unknown, expr: string, t: TypeNode | undefined, helpers: Helper[]): string[] {
  if (isUnit(t)) {
    if (value !== null) throw new Unsupported(`returns ${JSON.stringify(value)} but the function returns ()`);
    return [`${expr};`];
  }
  if (nameOf(t, "bool") && typeof value === "boolean") return [`assert!(${value ? "" : "!"}${expr});`];
  if (isFloat(t)) {
    rustLiteral(t!, value);
    helpers.push("assert_close");
    return [`assert_close(${expr} as f64, ${Number.isInteger(value) ? `${value}.0` : String(value)});`];
  }
  if (hasFloat(t)) throw new Unsupported("floats inside a compound return value (the validator compares them with a tolerance)");
  if (nameOf(t, "String") && typeof value === "string") return [`assert_eq!(${expr}, ${str(value)});`];
  if (nameOf(t, "Option") && nameOf(argOf(t), "String") && (value === null || typeof value === "string")) {
    return [`assert_eq!(${expr}.as_deref(), ${value === null ? "None" : `Some(${str(value)})`});`];
  }
  return [`assert_eq!(${expr}, ${rustLiteral(t!, value)});`];
}

/** Argument of `target` built from the generated `value` of type `t`. */
function targetArg(target: NativeSymbol, t: TypeNode): string {
  if (target.params.length !== 1) throw new Unsupported(`${target.name} takes ${target.params.length} parameters`);
  const p = target.params[0].typeNode;
  const owned = nameOf(t, "String");
  if (isStrRef(p) && (owned || isStrRef(t))) return owned ? "&value" : "value";
  if ((nameOf(p, "String") || (nameOf(p, "impl") && p?.kind === "name" && (p.args ?? []).some(isStringTrait))) && (owned || isStrRef(t))) {
    return owned ? "value.clone()" : "value.to_string()";
  }
  if (JSON.stringify(p) === JSON.stringify(t)) return "value.clone()";
  if (p?.kind === "ref" && JSON.stringify(p.of) === JSON.stringify(t)) return "&value";
  throw new Unsupported(`cannot pass the generated value to ${target.name}`);
}

function body(c: ExportCase, deps: string[]): Body {
  const helpers: Helper[] = [];
  const path = rustPathOf(c.symbol);
  const modules = [path.split("::")[0]];
  const call = tidy(`${path}(${rustArgs(c.symbol, c.args).join(", ")})`);
  const ret = c.symbol.returnsNode;
  const e = c.expect;
  switch (e.kind) {
    case "returns": {
      const v = unwrapped(call, ret);
      return { lines: returns(e.value, v.expr, v.type, helpers).map(tidy), helpers, modules };
    }
    case "throws": {
      const helper: Helper = isResultType(ret) ? "fails" : "panics";
      return { lines: [`assert!(${helper}(|| ${call}));`], helpers: [helper], modules };
    }
    case "matches": {
      if (!deps.includes("regex")) throw new Unsupported("`matches` needs the regex crate, which the lib does not depend on");
      const v = unwrapped(call, ret);
      const s = stringValue(v.expr, v.type);
      if (!s) throw new Unsupported("`matches` on a non-string return value");
      const pattern = str(e.pattern);
      return {
        lines: [`let value = ${s.expr};`, `assert!(Regex::new(${pattern}).unwrap().is_match(&value), "{value:?} does not match {}", ${pattern});`],
        helpers,
        regex: true,
        modules
      };
    }
    case "satisfies": {
      const target = c.target!;
      const v = unwrapped(call, ret);
      // None has nothing to check (the validator cannot pass null on either).
      const s = nameOf(v.type, "Option") ? { expr: `${v.expr}.expect("returned None")`, type: argOf(v.type) } : v;
      if (!s.type || isUnit(s.type)) throw new Unsupported("the function returns nothing to check");
      const targetPath = rustPathOf(target);
      modules.push(targetPath.split("::")[0]);
      const check = `${targetPath}(${targetArg(target, s.type)})`;
      const tr = target.returnsNode;
      const msg = `"{value:?} does not satisfy ${e.fn}"`;
      const assertion = nameOf(tr, "bool")
        ? `assert!(${check}, ${msg});`
        : isResultType(tr) && nameOf(argOf(tr), "bool")
          ? `assert_eq!(${check}.ok(), Some(true), ${msg});`
          : nameOf(tr, "Option") && nameOf(argOf(tr), "bool")
            ? `assert_eq!(${check}, Some(true), ${msg});`
            : undefined;
      if (!assertion) throw new Unsupported(`${target.name} does not return a boolean`);
      return { lines: [`let value = ${s.expr};`, assertion], helpers, modules };
    }
  }
}

/** A valid, unique Rust identifier for a test. */
function testName(slug: string[], taken: Set<string>): string {
  let name = snake(slug.join(" ")) || "empty";
  if (/^\d/.test(name) || KEYWORDS.has(name) || name in HELPERS) name = `case_${name}`;
  let unique = name;
  for (let n = 2; taken.has(unique); n++) unique = `${name}_${n}`;
  taken.add(unique);
  return unique;
}

function allSymbols(groups: ExportGroup[]): NativeSymbol[] {
  const out: NativeSymbol[] = [];
  for (const c of groups.flatMap((g) => g.cases)) {
    for (const x of [c.symbol, c.target]) {
      if (!x) continue;
      try {
        rustPathOf(x);
        out.push(x);
      } catch {
        // reported per case
      }
    }
  }
  return out;
}

/** One comment line: notes are reflowed, ids kept verbatim (only line breaks escaped). */
const comment = (s: string) => s.replace(/\s+/g, " ").trim();
const idComment = (id: string) => id.replace(/\r?\n/g, "\\n");

function render(ctx: AdapterContext, groups: ExportGroup[], header: string[]): Rendered {
  const { lib: crate, testDeps } = crateInfo(ctx.root);
  const unexpressible: Unexpressible[] = [];
  const used = new Set<Helper>();
  const modules = new Set<string>();
  let regex = false;
  const mods: string[][] = [];
  // Test modules are named after the contract function; never shadow a lib module we `use`.
  const libModules = new Set(allSymbols(groups).map((x) => rustPathOf(x).split("::")[0]));
  const modName = (fnId: string) => (libModules.has(snake(fnId)) ? `${snake(fnId)}_contract` : snake(fnId));

  for (const g of groups) {
    const tests: string[] = [];
    const taken = new Set<string>();
    let anyTest = false;
    for (const c of g.cases) {
      let b: Body;
      try {
        b = body(c, testDeps);
      } catch (err) {
        if (!(err instanceof Unsupported)) throw err;
        const reason = `not expressible in Rust: ${err.message}`;
        unexpressible.push({ id: c.id, reason });
        tests.push("", `    // ${idComment(c.id)}`, `    // ${comment(reason)}`);
        continue;
      }
      anyTest = true;
      b.helpers.forEach((h) => used.add(h));
      b.modules.forEach((m) => modules.add(m));
      regex ||= !!b.regex;
      tests.push("", `    // ${idComment(c.id)}`);
      if (c.note) tests.push(`    // ${comment(c.note)}`);
      tests.push("    #[test]");
      if (c.skip) tests.push(`    #[ignore = ${str(c.skip)}]`);
      tests.push(`    fn ${testName(c.slug, taken)}() {`);
      if (c.repeat > 1) tests.push(`        for _ in 0..${c.repeat} {`, ...b.lines.map((l) => `            ${l}`), "        }");
      else tests.push(...b.lines.map((l) => `        ${l}`));
      tests.push("    }");
    }
    const native = (g.symbol.meta as { rustPath?: string } | undefined)?.rustPath ?? g.symbol.name;
    const head = [`/// ${g.fnId} -> \`${crate}::${native}\``, `mod ${modName(g.fnId)} {`];
    if (anyTest) head.push("    use super::*;");
    mods.push([...head, ...(anyTest ? tests : tests.slice(1)), "}"]);
  }

  const out: string[] = [...header.map((h) => `// ${h}`.trimEnd()), ""];
  if (regex) out.push("use regex::Regex;");
  const imports = [...modules].sort();
  if (imports.length) out.push(imports.length === 1 ? `use ${crate}::${imports[0]};` : `use ${crate}::{${imports.join(", ")}};`);
  for (const h of Object.keys(HELPERS) as Helper[]) if (used.has(h)) out.push("", ...HELPERS[h]);
  const content = [...out, ...mods.flatMap((m) => ["", ...m])].join("\n") + "\n";
  return { content, unexpressible };
}

export const rustTestgen: TestGenerator = {
  framework: "cargo test",
  path: () => "tests/api_contract.rs",
  command: () => "cargo test --test api_contract",
  render,
  // rustfmt with the crate's edition (and its rustfmt.toml, found from the file's directory).
  format: (ctx) => [["rustfmt", "--edition", crateInfo(ctx.root).edition, "{file}"]]
};
