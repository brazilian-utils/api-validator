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
import type { RunnerCall, RunnerResult } from "../../core/model.js";
import { parseJsonOutput, run } from "../../core/shell.js";
import type { AdapterContext } from "../types.js";

const INTS = new Set(["int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32", "uint64", "byte", "uintptr"]);
const FLOATS = new Set(["float32", "float64"]);
const BUILTIN = new Set([...INTS, ...FLOATS, "string", "bool", "rune", "error", "any"]);

class Unsupported extends Error {}

interface Meta {
  importPath: string;
  package: string;
  func: string;
  paramTypes: string[];
  results: string[];
}

/** Render a JSON value as a Go literal of type `type` (as written inside package `alias`). */
export function goLiteral(type: string, value: unknown, alias: string): string {
  const t = type.trim();
  if (value === null) {
    if (t.startsWith("*") || t.startsWith("[]") || t.startsWith("map[") || t === "any" || t === "interface{}" || t === "error") return "nil";
    throw new Unsupported(`null for non-nillable ${t}`);
  }
  if (t.startsWith("*")) return `ptr(${goLiteral(t.slice(1), value, alias)})`;
  if (t.startsWith("[]")) {
    if (!Array.isArray(value)) throw new Unsupported(`expected array for ${t}`);
    return `${qualify(t, alias)}{${value.map((v) => goLiteral(t.slice(2), v, alias)).join(", ")}}`;
  }
  if (t === "string") {
    if (typeof value !== "string") throw new Unsupported(`expected string for ${t}, got ${JSON.stringify(value)}`);
    return JSON.stringify(value);
  }
  if (t === "bool") {
    if (typeof value !== "boolean") throw new Unsupported(`expected bool, got ${JSON.stringify(value)}`);
    return String(value);
  }
  if (INTS.has(t)) {
    if (typeof value !== "number" || !Number.isInteger(value)) throw new Unsupported(`expected integer for ${t}`);
    return `${t}(${value})`;
  }
  if (FLOATS.has(t)) {
    if (typeof value !== "number") throw new Unsupported(`expected number for ${t}`);
    return `${t}(${value})`;
  }
  if (t === "any" || t === "interface{}") {
    if (["string", "number", "boolean"].includes(typeof value)) return JSON.stringify(value);
    throw new Unsupported(`cannot build ${JSON.stringify(value)} as ${t}`);
  }
  // Named type of the same package with a primitive underlying type: Go conversion.
  if (/^[A-Z]\w*$/.test(t) && ["string", "number", "boolean"].includes(typeof value)) {
    return `${alias}.${t}(${JSON.stringify(value)})`;
  }
  throw new Unsupported(`cannot build a ${t} argument`);
}

/** Qualify package-local named types: `[]Address` in package cep -> `[]p0.Address`. */
function qualify(type: string, alias: string): string {
  return type.replace(/\b([A-Z]\w*)\b/g, (m, name: string, offset: number) =>
    type[offset - 1] === "." || BUILTIN.has(name) ? m : `${alias}.${name}`
  );
}

function callBody(meta: Meta, args: unknown[], alias: string): string {
  const params = meta.paramTypes;
  const rendered: string[] = [];
  params.forEach((pt, i) => {
    if (pt.startsWith("...")) {
      for (const v of args.slice(i)) rendered.push(goLiteral(pt.slice(3), v, alias));
    } else {
      if (i >= args.length) throw new Unsupported(`missing argument ${i + 1} (Go has no optional parameters)`);
      rendered.push(goLiteral(pt, args[i], alias));
    }
  });
  if (!params.some((p) => p.startsWith("...")) && args.length > params.length) {
    throw new Unsupported(`${args.length} args for ${params.length} params`);
  }
  const call = `${alias}.${meta.func}(${rendered.join(", ")})`;
  const rs = meta.results;
  const errIdx = rs.length > 0 && rs[rs.length - 1] === "error" ? rs.length - 1 : -1;
  const values = rs.filter((_, i) => i !== errIdx);
  const vars = rs.map((_, i) => (i === errIdx ? "err" : `v${i}`));
  if (rs.length === 0) return `${call}\n\treturn nil, nil`;
  const assign = `${vars.join(", ")} := ${call}`;
  const errCheck = errIdx >= 0 ? `\n\tif err != nil { return nil, err }` : "";
  if (values.length === 0) return `${assign}${errCheck}\n\treturn nil, nil`;
  if (values.length === 1) return `${assign}${errCheck}\n\treturn v0, nil`;
  if (values.length === 2 && rs[1] === "bool") return `${assign}\n\tif !v1 { return nil, nil }\n\treturn v0, nil`;
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
  const mod = fs.readFileSync(path.join(root, "go.mod"), "utf8");
  return /^go\s+(\S+)/m.exec(mod)?.[1] ?? "1.21";
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
      pending.push({ id: c.id, meta, body: callBody(meta, c.args, "__ALIAS__") });
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
