/**
 * Erlang conformance runner: compiles the lib with `erlc` into the work dir (the checkout is
 * never touched), writes the calls as Erlang terms and runs them through runner.escript.
 */
import fs from "node:fs";
import path from "node:path";
import type { NativeSymbol, RunnerCall, RunnerResult } from "../../core/model.js";
import { LANGUAGES_DIR } from "../../core/paths.js";
import { parseJsonOutput, run } from "../../core/shell.js";
import type { AdapterContext } from "../types.js";

/** Render a JSON value as an Erlang term: strings become UTF-8 binaries, null `undefined`. */
export function erlangTerm(value: unknown): string {
  if (value === null || value === undefined) return "undefined";
  if (typeof value === "string") {
    return `<<"${[...value].map((c) => (c === "\\" ? "\\\\" : c === '"' ? '\\"' : c.charCodeAt(0) < 32 ? `\\x{${c.charCodeAt(0).toString(16)}}` : c)).join("")}"/utf8>>`;
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) return Number.isSafeInteger(value) ? String(value) : BigInt(value).toString();
    // Erlang floats need digits on both sides of the dot: 0.5, 1.0e-7 (never 5e-1).
    const [mantissa, exp] = String(value).split("e");
    return `${mantissa.includes(".") ? mantissa : `${mantissa}.0`}${exp ? `e${exp}` : ""}`;
  }
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(erlangTerm).join(", ")}]`;
  return `#{${Object.entries(value as object).map(([k, v]) => `${erlangTerm(k)} => ${erlangTerm(v)}`).join(", ")}}`;
}

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ["test", "_build", ".git", "deps"].includes(e.name) ? [] : sourceFiles(p);
    return e.name.endsWith(".erl") ? [p] : [];
  });
}

const TOOL = () => path.join(LANGUAGES_DIR, "erlang", "tool.escript");

/** Compile the lib into `<workDir>/ebin` with debug_info (the checkout is never touched). */
export function compileErlang(ctx: AdapterContext): { ebin: string } | { error: string } {
  const srcDir = path.join(ctx.root, ctx.lib.entry === "." ? "src" : ctx.lib.entry);
  const ebin = path.join(ctx.workDir, "ebin");
  fs.rmSync(ebin, { recursive: true, force: true });
  fs.mkdirSync(ebin, { recursive: true });
  const includes = ["include", "src"].map((d) => path.join(ctx.root, d)).filter((d) => fs.existsSync(d)).flatMap((d) => ["-I", d]);
  const build = run("erlc", ["+debug_info", "-o", ebin, ...includes, ...sourceFiles(srcDir)], { cwd: ctx.root });
  if (build.status !== 0) return { error: `erlc failed: ${(build.stderr || build.stdout).trim().split("\n").slice(0, 10).join("\n")}` };
  return { ebin };
}

export interface BeamModule {
  module: string;
  types: Record<string, string>;
  symbols: NativeSymbol[];
}

/** Public API as the compiler sees it (beam abstract code), see tool.escript. */
export function extractFromBeams(ctx: AdapterContext): BeamModule[] {
  const built = compileErlang(ctx);
  if ("error" in built) throw new Error(built.error);
  const r = run("escript", [TOOL(), "extract", built.ebin], { cwd: ctx.root });
  if (!r.stdout.includes("\u0000JSON\u0000")) throw new Error(`erlang extractor crashed: ${(r.stderr || r.stdout).trim().split("\n").slice(-10).join("\n")}`);
  const modules = parseJsonOutput<BeamModule[]>(r.stdout, "erlang extractor");
  for (const m of modules) for (const s of m.symbols) if (s.location) s.location.file = path.relative(ctx.root, path.resolve(ctx.root, s.location.file));
  return modules;
}

export async function runErlang(ctx: AdapterContext, calls: RunnerCall[]): Promise<RunnerResult[]> {
  const built = compileErlang(ctx);
  if ("error" in built) return calls.map((c) => ({ id: c.id, ok: false, error: built.error, unsupported: true }));
  const ebin = built.ebin;
  const terms = calls.map((c) => {
    const [mod, fun] = [(c.symbol.meta?.module as string) ?? c.symbol.name.split(".")[0], c.symbol.name.split(".").pop()!];
    return `{${erlangTerm(c.id)}, '${mod}', '${fun}', ${erlangTerm(c.args)}}.`;
  });
  const file = path.join(ctx.workDir, "calls.terms");
  fs.writeFileSync(file, terms.join("\n") + "\n");
  const r = run("escript", [TOOL(), "run", ebin, file], { cwd: ctx.root });
  if (!r.stdout.includes("\u0000JSON\u0000")) {
    const error = `runner crashed: ${(r.stderr || r.stdout).trim().split("\n").slice(-10).join("\n")}`;
    return calls.map((c) => ({ id: c.id, ok: false, error, unsupported: true }));
  }
  return parseJsonOutput<RunnerResult[]>(r.stdout, "erlang runner");
}
