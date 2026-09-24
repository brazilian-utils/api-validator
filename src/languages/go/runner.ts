/**
 * Go conformance runner. Go is statically typed, so instead of a dynamic harness we
 * generate a Go program with one function per call (arguments rendered as typed Go
 * literals from the extracted parameter types), build it inside a go.work workspace that
 * `use`s the lib checkout (no changes to the lib, its go.sum is honoured), run it and read
 * the JSON results.
 *
 * Calls whose arguments cannot be expressed, or that fail to compile, are reported as
 * unsupported (skipped) instead of breaking the whole batch.
 */
import fs from "node:fs";
import path from "node:path";
import type { NativeSymbol, RunnerCall, RunnerResult, TypeNode } from "../../core/model.js";
import { parseJsonOutput, run, runOrThrow } from "../../core/shell.js";
import type { AdapterContext } from "../types.js";

const INTS = new Set(["int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32", "uint64", "byte", "uintptr"]);
const FLOATS = new Set(["float32", "float64"]);

/** A value or call the Go literal builders cannot write. */
export class Unsupported extends Error {}

export interface Meta {
  importPath: string;
  package: string;
  func: string;
}

/** Go source for a type of the lib's package `self` (imported as `alias`). */
function goType(t: TypeNode, alias: string, self: string): string {
  switch (t.kind) {
    case "ref":
      return `*${goType(t.of, alias, self)}`;
    case "list":
      return `[]${goType(t.of, alias, self)}`;
    case "name":
      if (t.name === "map" && t.args?.length === 2) return `map[${goType(t.args[0], alias, self)}]${goType(t.args[1], alias, self)}`;
      if (!t.pkg) return t.name; // predeclared: string, int, error, any...
      if (t.pkg === self) return `${alias}.${t.name}`;
      throw new Unsupported(`type ${t.name} from another package`);
    default:
      throw new Unsupported(`cannot write a ${t.kind} type`);
  }
}

/** Render a JSON value as a Go expression of type `t` (types of package `self` via `alias`). */
export function goLiteral(t: TypeNode, value: unknown, alias: string, self: string): string {
  if (value === null) {
    if (t.kind === "ref" || t.kind === "list" || (t.kind === "name" && ["map", "any", "error"].includes(t.name) && !t.pkg)) return "nil";
    throw new Unsupported(`null for non-nillable ${t.kind === "name" ? t.name : t.kind}`);
  }
  if (t.kind === "ref") return `ptr(${goLiteral(t.of, value, alias, self)})`;
  if (t.kind === "list") {
    if (!Array.isArray(value)) throw new Unsupported("expected an array");
    return `${goType(t, alias, self)}{${value.map((v) => goLiteral(t.of, v, alias, self)).join(", ")}}`;
  }
  if (t.kind !== "name") throw new Unsupported(`cannot build a ${t.kind} argument`);
  if (!t.pkg) {
    if (t.name === "string") {
      if (typeof value !== "string") throw new Unsupported(`expected string, got ${JSON.stringify(value)}`);
      return JSON.stringify(value);
    }
    if (t.name === "bool") {
      if (typeof value !== "boolean") throw new Unsupported(`expected bool, got ${JSON.stringify(value)}`);
      return String(value);
    }
    if (INTS.has(t.name)) {
      if (typeof value !== "number" || !Number.isInteger(value)) throw new Unsupported(`expected integer for ${t.name}`);
      return `${t.name}(${value})`;
    }
    if (FLOATS.has(t.name)) {
      if (typeof value !== "number") throw new Unsupported(`expected number for ${t.name}`);
      return `${t.name}(${value})`;
    }
    if (t.name === "any" && ["string", "number", "boolean"].includes(typeof value)) return JSON.stringify(value);
    throw new Unsupported(`cannot build a ${t.name} argument`);
  }
  // A named type of the lib's own package with a primitive underlying type: Go conversion
  // (if the underlying type does not fit, the call fails to compile and is skipped).
  if (t.pkg === self && ["string", "number", "boolean"].includes(typeof value)) return `${alias}.${t.name}(${JSON.stringify(value)})`;
  throw new Unsupported(`cannot build a ${t.name} argument`);
}

/**
 * Body of a `func() (any, error)` calling `symbol` with `args` (JSON values), mapping its
 * results like the doc does: `(T, error)` err -> error, `(T, bool)` false -> nil.
 * `literal` renders one argument (default: the typed Go literal of the JSON value).
 */
function callBody(
  symbol: NativeSymbol,
  meta: Meta,
  args: unknown[],
  alias: string,
  literal: (t: TypeNode, value: unknown) => string = (t, v) => goLiteral(t, v, alias, meta.importPath)
): string {
  const params = symbol.params;
  const rendered: string[] = [];
  params.forEach((p, i) => {
    if (!p.typeNode) throw new Unsupported(`no type for parameter ${p.name}`);
    if (p.rest) {
      for (const v of args.slice(i)) rendered.push(literal(p.typeNode, v));
    } else {
      if (i >= args.length) throw new Unsupported(`missing argument ${i + 1} (Go has no optional parameters)`);
      rendered.push(literal(p.typeNode, args[i]));
    }
  });
  if (!params.some((p) => p.rest) && args.length > params.length) throw new Unsupported(`${args.length} args for ${params.length} params`);
  const call = `${alias}.${meta.func}(${rendered.join(", ")})`;
  const r = symbol.returnsNode;
  const rs: TypeNode[] = !r ? [] : r.kind === "tuple" ? r.of : [r];
  const isErr = (n: TypeNode) => n.kind === "name" && n.name === "error" && !n.pkg;
  const errIdx = rs.length > 0 && isErr(rs[rs.length - 1]) ? rs.length - 1 : -1;
  const values = rs.filter((_, i) => i !== errIdx);
  const vars = rs.map((_, i) => (i === errIdx ? "err" : `v${i}`));
  if (rs.length === 0) return `${call}\n\treturn nil, nil`;
  const assign = `${vars.join(", ")} := ${call}`;
  const errCheck = errIdx >= 0 ? `\n\tif err != nil { return nil, err }` : "";
  const isBool = (n: TypeNode) => n.kind === "name" && n.name === "bool" && !n.pkg;
  if (values.length === 0) return `${assign}${errCheck}\n\treturn nil, nil`;
  if (values.length === 1) return `${assign}${errCheck}\n\treturn v0, nil`;
  if (values.length === 2 && isBool(rs[1])) return `${assign}${errCheck}\n\tif !v1 { return nil, nil }\n\treturn v0, nil`;
  return `${assign}${errCheck}\n\treturn []any{${vars.filter((v) => v !== "err").join(", ")}}, nil`;
}

function program(calls: Array<{ id: string; meta: Meta; body: string }>): { code: string; lines: Map<number, string> } {
  const imports = [...new Set(calls.map((c) => c.meta.importPath))];
  const aliasOf = new Map(imports.map((p, i) => [p, `p${i}`]));
  const head = [
    "package main",
    "",
    "import (",
    '\t"encoding/json"',
    '\t"fmt"',
    '\t"os"',
    ...imports.map((p) => `\t${aliasOf.get(p)} ${JSON.stringify(p)}`),
    ")",
    "",
    "func ptr[T any](v T) *T { return &v }",
    "",
    "func run(id string, f func() (any, error)) (r map[string]any) {",
    '\tr = map[string]any{"id": id}',
    '\tdefer func() { if e := recover(); e != nil { r["ok"] = false; r["error"] = fmt.Sprintf("panic: %v", e) } }()',
    "\tv, err := f()",
    '\tif err != nil { r["ok"] = false; r["error"] = err.Error(); return }',
    '\tif _, jerr := json.Marshal(v); jerr != nil { r["ok"] = false; r["unsupported"] = true; r["error"] = "result not JSON-serializable: " + jerr.Error(); return }',
    '\tr["ok"] = true; r["value"] = v; return',
    "}",
    ""
  ];
  const lines = new Map<number, string>();
  const body: string[] = [];
  calls.forEach((c, i) => {
    const alias = aliasOf.get(c.meta.importPath)!;
    const fnLines = [`func c${i}() (any, error) {`, `\t${c.body.replaceAll("__ALIAS__", alias)}`, "}", ""].join("\n").split("\n");
    const start = head.length + body.length + 1;
    fnLines.forEach((_, k) => lines.set(start + k, c.id));
    body.push(...fnLines);
  });
  const main = [
    "func main() {",
    "\tresults := []map[string]any{}",
    ...calls.map((c, i) => `\tresults = append(results, run(${JSON.stringify(c.id)}, c${i}))`),
    '\tos.Stdout.WriteString("\\x00JSON\\x00")',
    "\tjson.NewEncoder(os.Stdout).Encode(results)",
    "}"
  ];
  return { code: [...head, ...body, ...main].join("\n") + "\n", lines };
}

function goVersion(root: string): string {
  // `go mod edit -json`: the go command's own reading of go.mod.
  const mod = parseJsonOutput<{ Go?: string }>(runOrThrow("go", ["mod", "edit", "-json"], { cwd: root }), "go mod edit");
  return mod.Go ?? "1.21";
}

export async function runGo(ctx: AdapterContext, calls: RunnerCall[]): Promise<RunnerResult[]> {
  const results = new Map<string, RunnerResult>();
  let pending: Array<{ id: string; meta: Meta; body: string }> = [];
  for (const c of calls) {
    const meta = c.symbol.meta as unknown as Meta | undefined;
    if (!meta?.importPath) {
      results.set(c.id, { id: c.id, ok: false, error: "symbol has no Go metadata", unsupported: true });
      continue;
    }
    try {
      pending.push({ id: c.id, meta, body: callBody(c.symbol, meta, c.args, "__ALIAS__") });
    } catch (e) {
      if (!(e instanceof Unsupported)) throw e;
      results.set(c.id, { id: c.id, ok: false, error: `unsupported by Go runner: ${e.message}`, unsupported: true });
    }
  }

  const dir = path.join(ctx.workDir, "go-runner");
  fs.mkdirSync(dir, { recursive: true });
  const version = goVersion(ctx.root);
  fs.writeFileSync(path.join(dir, "go.mod"), `module apivalidator_runner\n\ngo ${version}\n`);
  fs.writeFileSync(path.join(dir, "go.work"), `go ${version}\n\nuse (\n\t.\n\t${JSON.stringify(ctx.root)}\n)\n`);
  const env = { ...process.env, GOWORK: path.join(dir, "go.work"), GOTOOLCHAIN: "local", GOFLAGS: "" };

  // Build, dropping calls that do not compile, until it builds (bounded).
  for (let attempt = 0; attempt < 8 && pending.length > 0; attempt++) {
    const { code, lines } = program(pending);
    fs.writeFileSync(path.join(dir, "main.go"), code);
    const build = run("go", ["build", "-o", "runner", "."], { cwd: dir, env });
    if (build.status === 0) {
      const exec = run(path.join(dir, "runner"), [], { cwd: ctx.root, timeoutMs: 5 * 60 * 1000 });
      if (!exec.stdout.includes("\u0000JSON\u0000")) {
        const error = `runner crashed: ${(exec.stderr || exec.stdout).trim().split("\n").slice(-10).join("\n")}`;
        for (const c of pending) results.set(c.id, { id: c.id, ok: false, error, unsupported: true });
      } else {
        for (const r of parseJsonOutput<RunnerResult[]>(exec.stdout, "go runner")) results.set(r.id, r);
      }
      pending = [];
      break;
    }
    const failing = new Map<string, string>();
    for (const m of build.stderr.matchAll(/main\.go:(\d+):\d+: (.*)/g)) {
      const id = lines.get(Number(m[1]));
      if (id && !failing.has(id)) failing.set(id, m[2]);
    }
    if (failing.size === 0) {
      const error = `go build failed: ${build.stderr.trim().split("\n").slice(0, 10).join("\n")}`;
      for (const c of pending) results.set(c.id, { id: c.id, ok: false, error, unsupported: true });
      pending = [];
      break;
    }
    for (const [id, msg] of failing) results.set(id, { id, ok: false, error: `does not compile: ${msg}`, unsupported: true });
    pending = pending.filter((c) => !failing.has(c.id));
  }
  for (const c of pending) results.set(c.id, { id: c.id, ok: false, error: "gave up compiling", unsupported: true });
  return calls.map((c) => results.get(c.id) ?? { id: c.id, ok: false, error: "no result", unsupported: true });
}
