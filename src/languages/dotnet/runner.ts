/**
 * .NET conformance runner: generates an F# console project that references the lib's
 * project, one `run` line per call (JSON args rendered as F# literals, curried or tupled as
 * the function declares), builds it with all outputs under the work dir (`--artifacts-path`,
 * the checkout stays clean), drops calls that do not compile and retries.
 */
import fs from "node:fs";
import path from "node:path";
import type { NativeSymbol, RunnerCall, RunnerResult, TypeNode } from "../../core/model.js";
import { LANGUAGES_DIR } from "../../core/paths.js";
import { parseJsonOutput, run } from "../../core/shell.js";
import type { AdapterContext } from "../types.js";

/** A value or call the F# literal builders cannot express (the call is reported as unsupported). */
export class Unsupported extends Error {}

/** Render a JSON value as an F# literal of type `t` (from the assembly's reflection). */
export function fsharpLiteral(t: TypeNode | undefined, value: unknown): string {
  if (t?.kind === "union") {
    // C# nullable reference type: T | null
    const inner = t.of.find((x) => !(x.kind === "name" && x.name === "null"));
    return value === null ? "null" : fsharpLiteral(inner, value);
  }
  if (t?.kind === "name" && (t.name === "option" || t.name === "voption")) {
    const some = t.name === "option" ? "Some" : "ValueSome";
    return value === null ? (t.name === "option" ? "None" : "ValueNone") : `(${some} ${fsharpLiteral(t.args?.[0], value)})`;
  }
  if (value === null) return "null";
  const name = t?.kind === "name" ? t.name : undefined;
  if (typeof value === "string") {
    if (name === "char") {
      if ([...value].length !== 1) throw new Unsupported("expected a 1-char string");
      return `'${JSON.stringify(value).slice(1, -1).replace(/^'$/, "\\'")}'`;
    }
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    if (name === "float" || name === "float32" || (!name && !Number.isInteger(value))) return Number.isInteger(value) ? `${value}.0` : String(value);
    if (name === "decimal") return `${value}M`;
    if (name === "int64") return `${value}L`;
    if (!Number.isInteger(value)) throw new Unsupported(`non-integer for ${name}`);
    return String(value);
  }
  if (Array.isArray(value)) {
    const el = t?.kind === "list" ? t.of : t?.kind === "name" ? t.args?.[0] : undefined;
    const items = value.map((v) => fsharpLiteral(el, v)).join("; ");
    return t?.kind === "list" ? `[| ${items} |]` : `[ ${items} ]`;
  }
  throw new Unsupported("objects are not supported as .NET arguments");
}

/** F# call of `call.symbol` with its JSON args (curried or tupled as the function declares). */
function callExpr(call: Pick<RunnerCall, "symbol" | "args">): string {
  const params = call.symbol.params;
  return applyExpr(call.symbol, call.args.map((a, k) => () => fsharpLiteral(params[k]?.typeNode, a)));
}

/** F# application of `symbol` to already rendered argument expressions (thunks, rendered in order). */
function applyExpr(symbol: NativeSymbol, args: Array<() => string>): string {
  const meta = symbol.meta as { qualified?: string; groups?: number[] } | undefined;
  if (!meta?.qualified) throw new Unsupported("symbol has no .NET metadata");
  const groups = meta.groups ?? [symbol.params.length];
  const arity = groups.reduce((a, b) => a + b, 0);
  if (args.length !== arity) throw new Unsupported(`${args.length} args for ${arity} params`);
  let k = 0;
  const parts = groups.map((n) => {
    if (n === 0) return "()";
    const lits = Array.from({ length: n }, () => args[k++]());
    return `(${lits.join(", ")})`;
  });
  return `${meta.qualified} ${parts.join(" ")}`;
}

function findFile(dir: string, name: string): string | undefined {
  if (!fs.existsSync(dir)) return undefined;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name === name) return p;
    if (e.isDirectory()) {
      const found = findFile(p, name);
      if (found) return found;
    }
  }
  return undefined;
}

function findProject(dir: string): string | undefined {
  if (!fs.existsSync(dir)) return undefined;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && /\.(fs|cs)proj$/.test(e.name) && !/test/i.test(e.name)) return path.join(dir, e.name);
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !/^(bin|obj|\.git)$|test/i.test(e.name)) {
      const found = findProject(path.join(dir, e.name));
      if (found) return found;
    }
  }
  return undefined;
}

const ENV = { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };

/** Build the lib into the work dir and return its assembly (the checkout stays clean). */
function buildDotnetLib(ctx: AdapterContext): { dll: string } | { error: string } {
  const project = findProject(path.join(ctx.root, ctx.lib.entry)) ?? findProject(ctx.root);
  if (!project) return { error: "no .fsproj/.csproj found" };
  const artifacts = path.join(ctx.workDir, "lib-artifacts");
  const build = run("dotnet", ["build", project, "-nologo", "-v", "q", "--artifacts-path", artifacts, "-p:GeneratePackageOnBuild=false"], {
    cwd: ctx.workDir,
    env: ENV,
    timeoutMs: 15 * 60 * 1000
  });
  if (build.status !== 0) return { error: `dotnet build failed: ${(build.stdout + build.stderr).trim().split("\n").filter((l) => /error/.test(l)).slice(0, 8).join("\n")}` };
  const name = path.basename(project).replace(/\.(fs|cs)proj$/, "");
  const dll = findFile(path.join(artifacts, "bin"), `${name}.dll`);
  return dll ? { dll } : { error: `${name}.dll not found after build` };
}

/** Public API from the compiled assembly by reflection (extract.fsx). */
export function extractFromAssembly(ctx: AdapterContext): NativeSymbol[] {
  const built = buildDotnetLib(ctx);
  if ("error" in built) throw new Error(built.error);
  const r = run("dotnet", ["fsi", "--quiet", path.join(LANGUAGES_DIR, "dotnet", "extract.fsx"), built.dll], { cwd: ctx.workDir, env: ENV });
  if (!r.stdout.includes("\u0000JSON\u0000")) throw new Error(`.NET extractor failed: ${(r.stderr || r.stdout).trim().split("\n").slice(-10).join("\n")}`);
  const symbols = parseJsonOutput<NativeSymbol[]>(r.stdout, ".NET extractor");
  for (const s of symbols) if (s.location) s.location.file = path.relative(ctx.root, s.location.file);
  return symbols;
}

export async function runDotnet(ctx: AdapterContext, calls: RunnerCall[]): Promise<RunnerResult[]> {
  const results = new Map<string, RunnerResult>();
  const project = findProject(path.join(ctx.root, ctx.lib.entry)) ?? findProject(ctx.root);
  if (!project) return calls.map((c) => ({ id: c.id, ok: false, error: "no .fsproj/.csproj found", unsupported: true }));
  // MSBuild's own evaluation of the project (handles imports, conditions, multi-targeting).
  const props = run("dotnet", ["msbuild", project, "-getProperty:TargetFramework", "-getProperty:TargetFrameworks"], { cwd: ctx.workDir, env: ENV });
  const evaluated = props.status === 0 ? (JSON.parse(props.stdout).Properties as { TargetFramework?: string; TargetFrameworks?: string }) : {};
  const tfm = evaluated.TargetFramework || evaluated.TargetFrameworks?.split(";")[0] || "net8.0";

  let pending: Array<{ id: string; expr: string }> = [];
  for (const c of calls) {
    try {
      pending.push({ id: c.id, expr: callExpr(c) });
    } catch (e) {
      if (!(e instanceof Unsupported)) throw e;
      results.set(c.id, { id: c.id, ok: false, error: `unsupported by .NET runner: ${e.message}`, unsupported: true });
    }
  }

  const dir = path.join(ctx.workDir, "dotnet-runner");
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(LANGUAGES_DIR, "dotnet", "Prelude.fs"), path.join(dir, "Prelude.fs"));
  fs.writeFileSync(
    path.join(dir, "Runner.fsproj"),
    `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>${tfm}</TargetFramework><TreatWarningsAsErrors>false</TreatWarningsAsErrors><NoWarn>FS0020;FS0064</NoWarn></PropertyGroup>
  <ItemGroup><Compile Include="Prelude.fs" /><Compile Include="Program.fs" /></ItemGroup>
  <ItemGroup><ProjectReference Include="${project}" /></ItemGroup>
</Project>
`
  );
  const artifacts = path.join(dir, "artifacts");
  const env = ENV;
  const HEAD = 4;

  for (let attempt = 0; attempt < 8 && pending.length > 0; attempt++) {
    const lines = pending.map((p) => `    run ${JSON.stringify(p.id)} (fun () -> box (${p.expr}))`);
    fs.writeFileSync(
      path.join(dir, "Program.fs"),
      ["module Program", "open Prelude", "[<EntryPoint>]", "let main _ =", ...lines, "    flush ()", "    0", ""].join("\n")
    );
    const build = run(
      "dotnet",
      ["build", "Runner.fsproj", "-nologo", "-v", "q", "--artifacts-path", artifacts, "-p:GeneratePackageOnBuild=false"],
      { cwd: dir, env, timeoutMs: 15 * 60 * 1000 }
    );
    if (build.status === 0) {
      const dll = findFile(path.join(artifacts, "bin"), "Runner.dll");
      const exe = dll ? run("dotnet", [dll], { cwd: ctx.root, env }) : { status: -1, stdout: "", stderr: "Runner.dll not found after build" };
      if (!exe.stdout.includes("\u0000JSON\u0000")) {
        const error = `runner crashed: ${(exe.stderr || exe.stdout).trim().split("\n").slice(-10).join("\n")}`;
        for (const p of pending) results.set(p.id, { id: p.id, ok: false, error, unsupported: true });
      } else for (const r of parseJsonOutput<RunnerResult[]>(exe.stdout, ".NET runner")) results.set(r.id, r);
      pending = [];
      break;
    }
    const out = build.stdout + build.stderr;
    const failing = new Map<string, string>();
    for (const m of out.matchAll(/Program\.fs\((\d+),\d+\): error (\w+: .*?)(?: \[|$)/gm)) {
      const p = pending[Number(m[1]) - HEAD - 1];
      if (p && !failing.has(p.id)) failing.set(p.id, m[2]);
    }
    if (failing.size === 0) {
      const error = `dotnet build failed: ${out.trim().split("\n").filter((l) => /error/.test(l)).slice(0, 8).join("\n") || out.slice(-1500)}`;
      for (const p of pending) results.set(p.id, { id: p.id, ok: false, error, unsupported: true });
      pending = [];
      break;
    }
    for (const [id, msg] of failing) results.set(id, { id, ok: false, error: `does not compile: ${msg}`, unsupported: true });
    pending = pending.filter((p) => !failing.has(p.id));
  }
  return calls.map((c) => results.get(c.id) ?? { id: c.id, ok: false, error: "no result", unsupported: true });
}
