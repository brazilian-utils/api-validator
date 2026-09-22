/**
 * .NET conformance runner: generates an F# console project that references the lib's
 * project, one `run` line per call (JSON args rendered as F# literals, curried or tupled as
 * the function declares), builds it with all outputs under the work dir (`--artifacts-path`,
 * the checkout stays clean), drops calls that do not compile and retries.
 */
import fs from "node:fs";
import path from "node:path";
import type { RunnerCall, RunnerResult } from "../../core/model.js";
import { LANGUAGES_DIR } from "../../core/paths.js";
import { parseJsonOutput, run } from "../../core/shell.js";
import type { AdapterContext } from "../types.js";

class Unsupported extends Error {}

/** Render a JSON value as an F# literal, guided by the (possibly absent) declared type. */
export function fsharpLiteral(type: string | undefined, value: unknown): string {
  const t = (type ?? "").trim();
  const opt = /^(.+?)\s+option$/.exec(t) ?? /^Option<(.+)>$/.exec(t);
  if (opt) return value === null ? "None" : `(Some ${fsharpLiteral(opt[1], value)})`;
  if (value === null) return "null";
  if (typeof value === "string") {
    if (t === "char") return `'${value}'`;
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    if (/^(float|double|single)$/.test(t) || (!t && !Number.isInteger(value))) return Number.isInteger(value) ? `${value}.0` : String(value);
    if (t === "decimal") return `${value}M`;
    if (t === "int64" || t === "long") return `${value}L`;
    if (!Number.isInteger(value)) throw new Unsupported(`non-integer for ${t}`);
    return String(value);
  }
  if (Array.isArray(value)) {
    const el = /^(.+?)\s+(list|array|seq)$/.exec(t)?.[1];
    const items = value.map((v) => fsharpLiteral(el, v)).join("; ");
    return /array$|\[\]$/.test(t) ? `[| ${items} |]` : `[ ${items} ]`;
  }
  throw new Unsupported("objects are not supported as .NET arguments");
}

function callExpr(call: RunnerCall): string {
  const meta = call.symbol.meta as { qualified?: string; groups?: number[]; paramTypes?: string[] } | undefined;
  if (!meta?.qualified) throw new Unsupported("symbol has no .NET metadata");
  const groups = meta.groups ?? [call.symbol.params.length];
  const types = meta.paramTypes ?? [];
  const arity = groups.reduce((a, b) => a + b, 0);
  if (call.args.length !== arity) throw new Unsupported(`${call.args.length} args for ${arity} params`);
  let k = 0;
  const parts = groups.map((n) => {
    if (n === 0) return "()";
    const lits = Array.from({ length: n }, () => {
      const lit = fsharpLiteral(types[k], call.args[k]);
      k++;
      return lit;
    });
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

export async function runDotnet(ctx: AdapterContext, calls: RunnerCall[]): Promise<RunnerResult[]> {
  const results = new Map<string, RunnerResult>();
  const project = findProject(path.join(ctx.root, ctx.lib.entry)) ?? findProject(ctx.root);
  if (!project) return calls.map((c) => ({ id: c.id, ok: false, error: "no .fsproj/.csproj found", unsupported: true }));
  const tfm = /<TargetFramework>([^<]+)</.exec(fs.readFileSync(project, "utf8"))?.[1] ?? "net8.0";

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
  const env = { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
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
