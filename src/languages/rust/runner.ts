/**
 * Rust conformance runner: generates a binary crate depending on the lib by path, with
 * one function per call (typed Rust literals built from the extracted parameter types)
 * and an `Emit` trait that turns common return types into JSON. Calls that cannot be
 * expressed, or that fail to compile (e.g. a struct return type without Emit), are
 * reported as unsupported and removed before rebuilding.
 */
import fs from "node:fs";
import path from "node:path";
import type { RunnerCall, RunnerResult } from "../../core/model.js";
import { parseJsonOutput, run } from "../../core/shell.js";
import { LANGUAGES_DIR } from "../../core/paths.js";
import type { AdapterContext } from "../types.js";

class Unsupported extends Error {}

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

function generic(t: string, name: string): string | undefined {
  const m = new RegExp(`^(?:[\\w:]*::)?${name}\\s*<([\\s\\S]*)>$`).exec(t);
  return m?.[1];
}

/** Render a JSON value as a Rust expression of type `type`. */
export function rustLiteral(type: string, value: unknown): string {
  const t = type.trim().replace(/'\w+\s*/g, "");
  if (t.startsWith("&")) {
    const inner = t.replace(/^&\s*(mut\s+)?/, "");
    if (inner === "str") {
      if (typeof value !== "string") throw new Unsupported(`expected string, got ${JSON.stringify(value)}`);
      return rustStr(value);
    }
    if (inner.startsWith("[")) {
      const el = inner.slice(1, -1);
      if (!Array.isArray(value)) throw new Unsupported("expected array");
      return `&[${value.map((v) => rustLiteral(el, v)).join(", ")}]`;
    }
    return `&${rustLiteral(inner, value)}`;
  }
  const opt = generic(t, "Option");
  if (opt !== undefined) return value === null ? "None" : `Some(${rustLiteral(opt, value)})`;
  if (value === null) throw new Unsupported(`null for ${t}`);
  const vec = generic(t, "Vec");
  if (vec !== undefined) {
    if (!Array.isArray(value)) throw new Unsupported("expected array");
    return `vec![${value.map((v) => rustLiteral(vec, v)).join(", ")}]`;
  }
  if (t === "String" || /^impl\s+(Into<String>|AsRef<str>|ToString)$/.test(t)) {
    if (typeof value !== "string") throw new Unsupported(`expected string, got ${JSON.stringify(value)}`);
    return `String::from(${rustStr(value)})`;
  }
  if (t === "char") {
    if (typeof value !== "string" || [...value].length !== 1) throw new Unsupported("expected 1-char string");
    return `'${rustStr(value).slice(1, -1).replace(/^'$/, "\\'")}'`;
  }
  if (t === "bool") {
    if (typeof value !== "boolean") throw new Unsupported("expected boolean");
    return String(value);
  }
  if (INTS.includes(t)) {
    if (typeof value !== "number" || !Number.isInteger(value)) throw new Unsupported(`expected integer for ${t}`);
    if (value < 0 && t.startsWith("u")) throw new Unsupported(`negative value for ${t}`);
    return `(${value}${t})`;
  }
  if (t === "f32" || t === "f64") {
    if (typeof value !== "number") throw new Unsupported("expected number");
    return `(${Number.isInteger(value) ? `${value}.0` : value}${t})`;
  }
  throw new Unsupported(`cannot build a ${t} argument`);
}

const EMIT_FILE = path.join(LANGUAGES_DIR, "rust", "emit.rs");

interface Prepared {
  id: string;
  expr: string;
  isResult: boolean;
}

function crateInfo(root: string): { pkg: string; lib: string } {
  const toml = fs.readFileSync(path.join(root, "Cargo.toml"), "utf8");
  const pkg = /\[package\][\s\S]*?\bname\s*=\s*"([^"]+)"/.exec(toml)?.[1];
  if (!pkg) throw new Error("Cargo.toml: package name not found");
  const libSection = /^\[lib\]\s*\n([^[]*)/m.exec(toml)?.[1] ?? "";
  const lib = /\bname\s*=\s*"([^"]+)"/.exec(libSection)?.[1] ?? pkg.replaceAll("-", "_");
  return { pkg, lib };
}

function prepare(call: RunnerCall, crate: string): Prepared {
  const meta = call.symbol.meta as { rustPath?: string; paramTypes?: string[] } | undefined;
  if (!meta?.rustPath) throw new Unsupported("symbol has no Rust metadata");
  const types = meta.paramTypes ?? [];
  if (call.args.length !== types.length) throw new Unsupported(`${call.args.length} args for ${types.length} params (Rust has no optional parameters)`);
  const args = types.map((t, i) => rustLiteral(t, call.args[i]));
  const ret = (call.symbol.returns ?? "").trim();
  const isResult = /^(?:[\w:]*::)?Result\s*</.test(ret) || /^io::Result|^anyhow::Result/.test(ret);
  return { id: call.id, expr: `${crate}::${meta.rustPath}(${args.join(", ")})`, isResult };
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
    const build = run("cargo", ["build", "--quiet", "--message-format=short"], { cwd: dir, env, timeoutMs: 20 * 60 * 1000 });
    if (build.status === 0) {
      const exe = run(path.join(dir, "target", "debug", "apivalidator_runner"), [], { cwd: ctx.root, timeoutMs: 5 * 60 * 1000 });
      if (!exe.stdout.includes("\u0000JSON\u0000")) {
        const error = `runner crashed: ${(exe.stderr || exe.stdout).trim().split("\n").slice(-10).join("\n")}`;
        for (const p of pending) results.set(p.id, { id: p.id, ok: false, error, unsupported: true });
      } else for (const r of parseJsonOutput<RunnerResult[]>(exe.stdout, "rust runner")) results.set(r.id, r);
      pending = [];
      break;
    }
    const failing = new Map<string, string>();
    for (const m of build.stderr.matchAll(/src[\\/]main\.rs:(\d+):\d+: (?:error(?:\[\w+\])?: )?(.*)/g)) {
      const id = lines.get(Number(m[1]));
      if (id && !failing.has(id)) failing.set(id, m[2]);
    }
    if (failing.size === 0) {
      const error = `cargo build failed: ${build.stderr.trim().split("\n").slice(0, 12).join("\n")}`;
      for (const p of pending) results.set(p.id, { id: p.id, ok: false, error, unsupported: true });
      pending = [];
      break;
    }
    for (const [id, msg] of failing) results.set(id, { id, ok: false, error: `does not compile: ${msg}`, unsupported: true });
    pending = pending.filter((p) => !failing.has(p.id));
  }
  return calls.map((c) => results.get(c.id) ?? { id: c.id, ok: false, error: "no result", unsupported: true });
}

