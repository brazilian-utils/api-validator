/**
 * Rust conformance runner: generates a binary crate depending on the lib by path, with
 * one function per call (typed Rust literals built from the extracted parameter types)
 * and an `Emit` trait that turns common return types into JSON. Calls that cannot be
 * expressed, or that fail to compile (e.g. a struct return type without Emit), are
 * reported as unsupported and removed before rebuilding.
 */
import fs from "node:fs";
import path from "node:path";
import type { NativeSymbol, RunnerCall, RunnerResult, TypeNode } from "../../core/model.js";
import { crateInfo } from "./cargo.js";
import { isStringTrait } from "./traits.js";
import { parseJsonOutput, run } from "../../core/shell.js";
import { LANGUAGES_DIR } from "../../core/paths.js";
import type { AdapterContext } from "../types.js";

/** A value or call the literal builders cannot express in Rust. */
export class Unsupported extends Error {}

/** Rust string literal (JSON escapes like \b or \u0001 are not valid Rust). */
function rustStr(s: string): string {
  const body = [...s]
    .map((c) => {
      if (c === "\\") return "\\\\";
      if (c === '"') return '\\"';
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      const code = c.codePointAt(0)!;
      return code < 0x20 || code === 0x7f ? `\\u{${code.toString(16)}}` : c;
    })
    .join("");
  return `"${body}"`;
}

const INTS = ["i8", "i16", "i32", "i64", "i128", "isize", "u8", "u16", "u32", "u64", "u128", "usize"];

/** Last path segment of a type name (`std::string::String` -> `String`). */
export const last = (name: string) => name.split("::").pop()!;

/** Render a JSON value as a Rust expression of type `t`. */
export function rustLiteral(t: TypeNode, value: unknown): string {
  if (t.kind === "ref") {
    const inner = t.of;
    if (inner.kind === "name" && inner.name === "str") {
      if (typeof value !== "string") throw new Unsupported(`expected string, got ${JSON.stringify(value)}`);
      return rustStr(value);
    }
    if (inner.kind === "list") {
      if (!Array.isArray(value)) throw new Unsupported("expected array");
      return `&[${value.map((v) => rustLiteral(inner.of, v)).join(", ")}]`;
    }
    return `&${rustLiteral(inner, value)}`;
  }
  if (t.kind !== "name") throw new Unsupported(`cannot build a ${t.kind} argument`);
  const name = last(t.name);
  if (name === "Option") return value === null ? "None" : `Some(${rustLiteral(t.args![0], value)})`;
  if (value === null) throw new Unsupported(`null for ${t.name}`);
  if (name === "Vec") {
    if (!Array.isArray(value)) throw new Unsupported("expected array");
    return `vec![${value.map((v) => rustLiteral(t.args![0], v)).join(", ")}]`;
  }
  if (name === "String" || (name === "impl" && (t.args ?? []).some(isStringTrait))) {
    if (typeof value !== "string") throw new Unsupported(`expected string, got ${JSON.stringify(value)}`);
    return `String::from(${rustStr(value)})`;
  }
  if (name === "char") {
    if (typeof value !== "string" || [...value].length !== 1) throw new Unsupported("expected 1-char string");
    return `'${rustStr(value).slice(1, -1).replace(/^'$/, "\\'")}'`;
  }
  if (name === "bool") {
    if (typeof value !== "boolean") throw new Unsupported("expected boolean");
    return String(value);
  }
  if (INTS.includes(name)) {
    if (typeof value !== "number" || !Number.isInteger(value)) throw new Unsupported(`expected integer for ${name}`);
    if (value < 0 && name.startsWith("u")) throw new Unsupported(`negative value for ${name}`);
    return `(${value}${name})`;
  }
  if (name === "f32" || name === "f64") {
    if (typeof value !== "number") throw new Unsupported("expected number");
    return `(${Number.isInteger(value) ? `${value}.0` : value}${name})`;
  }
  throw new Unsupported(`cannot build a ${t.name} argument`);
}

const EMIT_FILE = path.join(LANGUAGES_DIR, "rust", "emit.rs");

interface Prepared {
  id: string;
  expr: string;
  isResult: boolean;
}

/** Path of the symbol inside its crate (`cpf::is_valid`). */
function rustPathOf(symbol: NativeSymbol): string {
  const meta = symbol.meta as { rustPath?: string } | undefined;
  if (!meta?.rustPath) throw new Unsupported("symbol has no Rust metadata");
  return meta.rustPath;
}

/** Typed argument literals of a call (Rust has no optional parameters: counts must match). */
function rustArgs(symbol: NativeSymbol, values: unknown[]): string[] {
  const params = symbol.params;
  if (values.length !== params.length) throw new Unsupported(`${values.length} args for ${params.length} params (Rust has no optional parameters)`);
  return params.map((p, i) => {
    if (!p.typeNode) throw new Unsupported(`no type for parameter ${p.name}`);
    return rustLiteral(p.typeNode, values[i]);
  });
}

/** `Result<T, E>`: an Err is the idiomatic "throws". */
const isResultType = (t: TypeNode | undefined): t is Extract<TypeNode, { kind: "name" }> => t?.kind === "name" && last(t.name) === "Result";

function prepare(call: RunnerCall, crate: string): Prepared {
  const rustPath = rustPathOf(call.symbol);
  const args = rustArgs(call.symbol, call.args);
  return { id: call.id, expr: `${crate}::${rustPath}(${args.join(", ")})`, isResult: isResultType(call.symbol.returnsNode) };
}

function program(items: Prepared[]): { code: string; lines: Map<number, string> } {
  const head = fs.readFileSync(EMIT_FILE, "utf8").split("\n");
  const lines = new Map<number, string>();
  const body: string[] = ["fn main() {", "    let mut out = String::from(\"[\");"];
  items.forEach((it, i) => {
    const wrapped = it.isResult ? it.expr : `Ok::<_, ()>(${it.expr})`;
    const stmt = [
      i > 0 ? '    out.push(\',\');' : "",
      `    guard(${JSON.stringify(it.id)}, &mut out, || ${wrapped});`
    ].filter(Boolean);
    const start = head.length + body.length + 1;
    stmt.forEach((_, k) => lines.set(start + k, it.id));
    body.push(...stmt);
  });
  body.push("    out.push(']');", '    print!("\\u{0}JSON\\u{0}{}", out);', "}");
  return { code: [...head, ...body].join("\n") + "\n", lines };
}

export async function runRust(ctx: AdapterContext, calls: RunnerCall[]): Promise<RunnerResult[]> {
  const results = new Map<string, RunnerResult>();
  const { pkg, lib } = crateInfo(ctx.root);
  let pending: Prepared[] = [];
  for (const c of calls) {
    try {
      pending.push(prepare(c, lib));
    } catch (e) {
      if (!(e instanceof Unsupported)) throw e;
      results.set(c.id, { id: c.id, ok: false, error: `unsupported by Rust runner: ${e.message}`, unsupported: true });
    }
  }
  const dir = path.join(ctx.workDir, "rust-runner");
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "Cargo.toml"),
    `[package]\nname = "apivalidator_runner"\nversion = "0.0.0"\nedition = "2021"\n\n[dependencies]\n${JSON.stringify(pkg)} = { path = ${JSON.stringify(ctx.root)} }\n\n[workspace]\n`
  );
  const env = { ...process.env, CARGO_TARGET_DIR: path.join(dir, "target"), RUSTFLAGS: "-A warnings" };

  for (let attempt = 0; attempt < 10 && pending.length > 0; attempt++) {
    const { code, lines } = program(pending);
    fs.writeFileSync(path.join(dir, "src", "main.rs"), code);
    const build = run("cargo", ["build", "--quiet", "--message-format=json"], { cwd: dir, env, timeoutMs: 20 * 60 * 1000 });
    if (build.status === 0) {
      const exe = run(path.join(dir, "target", "debug", "apivalidator_runner"), [], { cwd: ctx.root, timeoutMs: 5 * 60 * 1000 });
      if (!exe.stdout.includes("\u0000JSON\u0000")) {
        const error = `runner crashed: ${(exe.stderr || exe.stdout).trim().split("\n").slice(-10).join("\n")}`;
        for (const p of pending) results.set(p.id, { id: p.id, ok: false, error, unsupported: true });
      } else for (const r of parseJsonOutput<RunnerResult[]>(exe.stdout, "rust runner")) results.set(r.id, r);
      pending = [];
      break;
    }
    // Structured compiler diagnostics (one JSON message per line): map error spans to calls.
    const failing = new Map<string, string>();
    const diagnostics: string[] = [];
    for (const line of build.stdout.split("\n")) {
      if (!line.startsWith("{")) continue;
      const msg = JSON.parse(line);
      if (msg.reason !== "compiler-message" || msg.message?.level !== "error") continue;
      diagnostics.push(msg.message.rendered ?? msg.message.message);
      for (const span of msg.message.spans ?? []) {
        if (!span.is_primary || !/main\.rs$/.test(span.file_name)) continue;
        const id = lines.get(span.line_start);
        if (id && !failing.has(id)) failing.set(id, msg.message.message);
      }
    }
    if (failing.size === 0) {
      const error = `cargo build failed: ${(diagnostics.join("\n") || build.stderr).trim().split("\n").slice(0, 12).join("\n")}`;
      for (const p of pending) results.set(p.id, { id: p.id, ok: false, error, unsupported: true });
      pending = [];
      break;
    }
    for (const [id, msg] of failing) results.set(id, { id, ok: false, error: `does not compile: ${msg}`, unsupported: true });
    pending = pending.filter((p) => !failing.has(p.id));
  }
  return calls.map((c) => results.get(c.id) ?? { id: c.id, ok: false, error: "no result", unsupported: true });
}

