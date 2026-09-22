/**
 * Contract tests as an xUnit module in the lib's F# test project (the framework its own
 * tests use), registered with a `<Compile Include>` in the .fsproj (F# compiles files in
 * the listed order). Calls and literals come from the conformance runner (`callExpr`,
 * `fsharpLiteral`), and results are read the way the runner reads them: `Error` of an F#
 * `Result` or an exception is a throw, `None`/`null` is null, `Some v`/`Ok v` is `v`; so
 * the file passes exactly when `check --tests` does.
 */
import fs from "node:fs";
import path from "node:path";
import type { ExportCase, ExportGroup, Rendered, Unexpressible } from "../../core/testgen.js";
import type { NativeSymbol, TypeNode } from "../../core/model.js";
import { pascal } from "../../core/naming.js";
import type { AdapterContext, TestGenerator } from "../types.js";
import { applyExpr, callExpr, fsharpLiteral, Unsupported } from "./runner.js";

const FILE = "ApiContractTests.fs";

// ---------------------------------------------------------------------------
// Where: the lib's F# test project

function walk(dir: string, found: string[] = []): string[] {
  if (!fs.existsSync(dir)) return found;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name.endsWith(".fsproj")) found.push(p);
    else if (e.isDirectory() && !/^(bin|obj|node_modules|artifacts)$|^\./.test(e.name)) walk(p, found);
  }
  return found;
}

const isTestProject = (proj: string) => /test/i.test(path.basename(proj)) || /<PackageReference\s+Include="(xunit|Microsoft\.NET\.Test\.Sdk)"/i.test(fs.readFileSync(proj, "utf8"));

/** The lib's F# test project (relative to the root), shallowest first. */
export function findTestProject(root: string): string | undefined {
  const tests = walk(root).filter(isTestProject);
  tests.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length || a.localeCompare(b));
  return tests[0] && path.relative(root, tests[0]);
}

/** The .fsproj whose directory holds `file` (both relative to the root). */
function owningProject(root: string, file: string): string | undefined {
  const abs = path.resolve(root, file);
  return walk(root)
    .filter((p) => abs.startsWith(path.dirname(p) + path.sep))
    .sort((a, b) => b.length - a.length)
    .map((p) => path.relative(root, p))[0];
}

const posix = (p: string) => p.split(path.sep).join("/");

/** `<Compile Include>` for `file` in its project: before the entry file (F# needs it last), else after the last one. */
export function wireFsproj(project: string, include: string): string | undefined {
  const norm = (s: string) => s.replace(/\\/g, "/").toLowerCase();
  const compiles = [...project.matchAll(/^([ \t]*)<Compile\s+Include="([^"]*)"[^>]*?(?:\/>|>[\s\S]*?<\/Compile>)[ \t]*\r?\n?/gm)];
  if (compiles.some((m) => norm(m[2]) === norm(include))) return undefined;
  const eol = project.includes("\r\n") ? "\r\n" : "\n";
  if (compiles.length === 0) {
    const close = project.lastIndexOf("</Project>");
    if (close < 0) return undefined;
    return `${project.slice(0, close)}  <ItemGroup>${eol}    <Compile Include="${include}" />${eol}  </ItemGroup>${eol}${eol}${project.slice(close)}`;
  }
  const entry = compiles.find((m) => /(^|[\\/])(Program|Main|EntryPoint)\.fs$/i.test(m[2]));
  const anchor = entry ?? compiles[compiles.length - 1];
  const line = `${anchor[1]}<Compile Include="${include}" />${eol}`;
  const at = entry ? anchor.index! : anchor.index! + anchor[0].length;
  const prefix = !entry && !anchor[0].endsWith("\n") ? eol : "";
  return project.slice(0, at) + prefix + line + project.slice(at);
}

function moduleName(ctx: AdapterContext, file: string): string {
  const project = owningProject(ctx.root, file);
  const base = path.basename(file).replace(/\.fs$/, "");
  const ns = project ? path.basename(project).replace(/\.fsproj$/, "") : undefined;
  return ns ? `${ns}.${base}` : base;
}

// ---------------------------------------------------------------------------
// What: a value of the declared return type, read like the runner reads it

const named = (t: TypeNode | undefined, ...names: string[]): boolean => t?.kind === "name" && names.includes(t.name);
/** First type argument of a named generic type. */
const arg0 = (t: TypeNode | undefined) => (t?.kind === "name" ? t.args?.[0] : undefined);

/** The declared return type, `Result<T, _>` peeled (its `Error` is a throw, like in the runner). */
function returnShape(s: NativeSymbol): { type?: TypeNode; result: boolean; void: boolean } {
  const t = s.returnsNode;
  if (named(t, "FSharpResult", "Result") && arg0(t)) return { type: arg0(t), result: true, void: false };
  return { type: t, result: false, void: !t || named(t, "unit", "void") };
}

/** The type under a nullable wrapper (`option`, `voption`, C# `T?`, `Nullable<T>`), and which. */
function nullable(t: TypeNode | undefined): { inner?: TypeNode; wrap?: "option" | "voption" | "null" | "Nullable" } {
  if (named(t, "option")) return { inner: arg0(t), wrap: "option" };
  if (named(t, "voption")) return { inner: arg0(t), wrap: "voption" };
  if (named(t, "Nullable")) return { inner: arg0(t), wrap: "Nullable" };
  if (t?.kind === "union") {
    const rest = t.of.filter((x) => !named(x, "null"));
    if (rest.length === 1 && rest.length < t.of.length) return { inner: rest[0], wrap: "null" };
  }
  return { inner: t };
}

const LISTS = ["list", "seq", "IEnumerable", "IList", "List", "IReadOnlyList", "ICollection"];
const OPAQUE = new Set(["obj", "object", "Object", "Task", "ValueTask", "Async", "unknown"]);
function opaque(t: TypeNode | undefined): string | undefined {
  if (!t) return "the return type is unknown";
  if (t.kind === "name" && OPAQUE.has(t.name)) return `results of type ${t.name} are not compared natively`;
  if (t.kind === "tuple" || t.kind === "object" || t.kind === "function" || t.kind === "unknown") return `results of type ${t.kind} are not compared natively`;
  const n = nullable(t);
  if (n.inner !== t) return opaque(n.inner);
  if (t.kind === "list") return opaque(t.of);
  if (named(t, ...LISTS)) return opaque(arg0(t));
  return undefined;
}

const FLOAT = ["float", "float32", "double", "single", "Double", "Single"];
const NUMBER = [...FLOAT, "int", "int64", "int16", "byte", "sbyte", "uint32", "uint64", "decimal", "Int32", "Int64", "Decimal"];

/**
 * Throws when `value` can never be a literal of `t` (a string for an int, ...): the runner's
 * build drops such calls as unsupported, a test file would not compile at all.
 */
function checkLiteral(t: TypeNode | undefined, value: unknown): void {
  const n = nullable(t);
  if (value === null || value === undefined) {
    // F# lists and value types have no null.
    if (!n.wrap && named(n.inner, "list", "bool", "char", ...NUMBER)) throw new Unsupported(`null is not a ${n.inner?.kind === "name" ? n.inner.name : ""}`);
    return;
  }
  const inner = n.inner;
  if (!inner || (inner.kind !== "list" && inner.kind !== "name")) return;
  const kind = Array.isArray(value) ? "array" : typeof value;
  const want =
    inner.kind === "list" || named(inner, ...LISTS) ? "array" : named(inner, "string", "char") ? "string" : named(inner, "bool") ? "boolean" : named(inner, ...NUMBER) ? "number" : undefined;
  if (want && want !== kind) throw new Unsupported(`${JSON.stringify(value)} is not a ${inner.kind === "name" ? inner.name : "list"}`);
  if (want === "array") {
    const el = inner.kind === "list" ? inner.of : arg0(inner);
    for (const x of value as unknown[]) checkLiteral(el, x);
  }
}

const SCALARS = ["string", "bool", "char", "int", "int64", "int16", "byte", "float", "float32", "decimal"];

/** F# name of a sequence's element type, when it is a plain scalar (`Assert.Equal<int>`). */
function elementType(t: TypeNode | undefined): string | undefined {
  const el = t?.kind === "list" ? t.of : arg0(t);
  return el?.kind === "name" && !el.args && SCALARS.includes(el.name) ? el.name : undefined;
}

const verbatim = (s: string) => `@"${s.replace(/"/g, '""')}"`;
const fsString = (s: string) => JSON.stringify(s);

interface Body {
  lines: string[];
  helpers: Set<"ok" | "close">;
}

/** Test body lines (without the repeat loop), or throws Unsupported with the reason. */
function body(c: ExportCase): Body {
  const helpers = new Set<"ok" | "close">();
  const shape = returnShape(c.symbol);
  c.args.forEach((a, k) => checkLiteral(c.symbol.params[k]?.typeNode, a));
  const raw = callExpr(c);
  const call = shape.result ? (helpers.add("ok"), `ok (${raw})`) : raw;
  const e = c.expect;
  switch (e.kind) {
    case "throws":
      return { lines: [`Assert.ThrowsAny<exn>(fun () -> ${call} |> ignore) |> ignore`], helpers };
    case "returns": {
      const value = e.value ?? null;
      // None, null, ValueNone, an empty Nullable and unit all box to null (like the runner's JSON null).
      if (value === null) {
        if (named(shape.type, "voption")) return { lines: [`Assert.True((${call}).IsNone)`], helpers };
        return { lines: [`Assert.Null(box (${call}))`], helpers };
      }
      if (shape.void) throw new Unsupported("expects a value from a function that returns nothing");
      const why = opaque(shape.type);
      if (why) throw new Unsupported(why);
      if (typeof value === "object" && !Array.isArray(value)) throw new Unsupported("object results are compared field by field (case-insensitive keys), no F# literal");
      const n = nullable(shape.type);
      if (named(shape.type, "bool") && typeof value === "boolean") return { lines: [`Assert.${value === true ? "True" : "False"}(${call})`], helpers };
      if (!n.wrap && named(shape.type, ...FLOAT) && typeof value === "number") {
        helpers.add("close");
        return { lines: [`close ${fsharpLiteral({ kind: "name", name: "float" }, value)} (float (${call}))`], helpers };
      }
      checkLiteral(shape.type, value);
      const lit = fsharpLiteral(shape.type, value);
      if (shape.type?.kind === "list" || named(shape.type, ...LISTS)) {
        // Sequences: pick xUnit's IEnumerable<T> overload (F# cannot choose between it and Equal<T>).
        const el = elementType(shape.type);
        return { lines: [el ? `Assert.Equal<${el}>(${lit}, ${call})` : `Assert.Equal(box (${lit}), box (${call}))`], helpers };
      }
      return { lines: [`Assert.Equal(${n.wrap === "Nullable" ? `System.Nullable(${lit})` : lit}, ${call})`], helpers };
    }
    case "matches": {
      const n = nullable(shape.type);
      const text = named(n.inner, "string")
        ? n.wrap === "option"
          ? `Option.toObj (${call})`
          : n.wrap === "voption"
            ? `ValueOption.toObj (${call})`
            : call
        : named(n.inner, "char") && !n.wrap
          ? `string (${call})`
          : undefined;
      if (!text) throw new Unsupported(`matches needs a string result, ${c.symbol.name} returns ${c.symbol.returns ?? "nothing"}`);
      return { lines: [`Assert.Matches(${verbatim(e.pattern)}, ${text})`], helpers };
    }
    case "satisfies": {
      const target = c.target!;
      if (target.params.length !== 1) throw new Unsupported(`${target.name} does not take exactly one argument`);
      const arg = convert(shape.type, target.params[0].typeNode);
      if (!arg) throw new Unsupported(`cannot pass ${c.symbol.returns ?? "nothing"} to ${target.name}(${target.params[0].type ?? "?"})`);
      const tshape = returnShape(target);
      if (!named(tshape.type, "bool")) throw new Unsupported(`${target.name} does not return bool`);
      let check = applyExpr(target, [() => arg]);
      if (tshape.result) {
        helpers.add("ok");
        check = `ok (${check})`;
      }
      return { lines: [`let value = ${call}`, `Assert.True(${check}, sprintf "%A" value)`], helpers };
    }
  }
}

/** F# expression turning `value` (of type `from`) into an argument of type `to`, as the runner's JSON round trip does. */
function convert(from: TypeNode | undefined, to: TypeNode | undefined): string | undefined {
  const a = nullable(from);
  const b = nullable(to);
  if (!a.inner || !b.inner || JSON.stringify(a.inner) !== JSON.stringify(b.inner)) return undefined;
  if (a.wrap === b.wrap || (!a.wrap && b.wrap === "null") || (a.wrap === "null" && !b.wrap)) return "value";
  const ref = named(a.inner, "string");
  if (!a.wrap && b.wrap === "option") return "(Some value)";
  if (!a.wrap && b.wrap === "voption") return "(ValueSome value)";
  if (a.wrap === "option" && ref && (!b.wrap || b.wrap === "null")) return "(Option.toObj value)";
  if (a.wrap === "voption" && ref && (!b.wrap || b.wrap === "null")) return "(ValueOption.toObj value)";
  return undefined;
}

// ---------------------------------------------------------------------------

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function render(ctx: AdapterContext, groups: ExportGroup[], header: string[]): Rendered {
  const unexpressible: Unexpressible[] = [];
  const file = typeof ctx.lib.options.testFile === "string" ? ctx.lib.options.testFile : testgenPath(ctx);
  const tests: string[] = [];
  const helpers = new Set<string>();
  const modules = new Map<string, number>();
  for (const g of groups) {
    let mod = pascal(g.fnId.replace(/\./g, " "));
    const n = modules.get(mod) ?? 0;
    modules.set(mod, n + 1);
    if (n > 0) mod += String(n + 1);
    const lines: string[] = [];
    let expressed = 0;
    for (const c of g.cases) {
      lines.push("");
      let b: Body;
      try {
        b = body(c);
      } catch (err) {
        if (!(err instanceof Unsupported)) throw err;
        unexpressible.push({ id: c.id, reason: err.message });
        lines.push(`    // ${c.id}`, `    // not expressible in F#: ${oneLine(err.message)}`);
        if (c.note) lines.push(`    // ${oneLine(c.note)}`);
        continue;
      }
      expressed++;
      for (const h of b.helpers) helpers.add(h);
      lines.push(c.skip ? `    [<Fact(Skip = ${fsString(c.skip)})>]` : "    [<Fact>]", `    let \`\`${c.slug.join(" ")}\`\` () =`, `        // ${c.id}`);
      if (c.note) lines.push(`        // ${oneLine(c.note)}`);
      if (c.repeat > 1) lines.push(`        for _ in 1 .. ${c.repeat} do`, ...b.lines.map((l) => `            ${l}`));
      else lines.push(...b.lines.map((l) => `        ${l}`));
    }
    // A module needs at least one definition: with none, only the comments remain.
    tests.push("", `/// ${g.fnId} -> ${g.symbol.name}`);
    if (expressed) tests.push(`module ${mod} =`, ...lines);
    else tests.push(...lines.filter((l) => l).map((l) => l.trim()));
  }
  const prelude: string[] = [];
  if (helpers.has("ok")) {
    prelude.push("", "/// `Ok v` is `v`; `Error e` fails the call, like an exception.", "let private ok (r: Result<'T, 'E>) : 'T =", "    match r with", "    | Ok v -> v", '    | Error e -> failwithf "Error %A" e');
  }
  if (helpers.has("close")) {
    prelude.push(
      "",
      "/// Numbers are equal within 1e-9 (relative), like the api-validator compares them.",
      "let private close (expected: float) (actual: float) =",
      '    Assert.True(abs (expected - actual) <= 1e-9 * max 1.0 (abs expected), sprintf "expected %g, got %g" expected actual)'
    );
  }
  const out = [...header.map((h) => `// ${h}`.trimEnd()), "", `module ${moduleName(ctx, file)}`, "", "open Xunit", ...prelude, ...tests];
  return { content: out.join("\n") + "\n", unexpressible };
}

function testgenPath(ctx: AdapterContext): string {
  const project = findTestProject(ctx.root);
  return posix(project ? path.join(path.dirname(project), FILE) : path.join("tests", FILE));
}

export const dotnetTestgen: TestGenerator = {
  framework: "xUnit",
  path: testgenPath,
  command(ctx) {
    const file = typeof ctx.lib.options.testFile === "string" ? ctx.lib.options.testFile : testgenPath(ctx);
    const project = owningProject(ctx.root, file);
    return `dotnet test${project ? ` ${posix(project)}` : ""} --filter FullyQualifiedName~${moduleName(ctx, file)}`;
  },
  render,
  wire(ctx, file) {
    const project = owningProject(ctx.root, file);
    if (!project) return [];
    const include = path.relative(path.dirname(path.resolve(ctx.root, project)), path.resolve(ctx.root, file)).split(path.sep).join("\\");
    const content = wireFsproj(fs.readFileSync(path.join(ctx.root, project), "utf8"), include);
    return content === undefined ? [] : [{ path: project, content }];
  }
};
