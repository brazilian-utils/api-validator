import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const whichCache = new Map<string, string | undefined>();

/** Absolute path of an executable on PATH, or undefined. */
export function which(bin: string): string | undefined {
  if (whichCache.has(bin)) return whichCache.get(bin);
  let found: string | undefined;
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(dir, bin);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      found = candidate;
      break;
    } catch {
      // keep looking
    }
  }
  whichCache.set(bin, found);
  return found;
}

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

/** Run a command without a shell, capturing output. Never throws on non-zero exit. */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; input?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}
): RunResult {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    input: opts.input,
    env: opts.env ?? process.env,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: opts.timeoutMs ?? 10 * 60 * 1000
  });
  if (r.error) return { status: -1, stdout: r.stdout ?? "", stderr: String(r.error) };
  return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Run and throw with stderr on failure. */
export function runOrThrow(cmd: string, args: string[], opts: Parameters<typeof run>[2] = {}): string {
  const r = run(cmd, args, opts);
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${r.status}):\n${r.stderr.trim() || r.stdout.trim()}`);
  }
  return r.stdout;
}

export function git(args: string[], cwd?: string): void {
  execFileSync("git", args, { cwd, stdio: "inherit" });
}

/** Parse the last JSON document printed by a helper process. */
export function parseJsonOutput<T>(stdout: string, what: string): T {
  const start = stdout.lastIndexOf("\u0000JSON\u0000");
  const text = start >= 0 ? stdout.slice(start + 6) : stdout;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${what}: could not parse JSON output:\n${stdout.slice(0, 2000)}`);
  }
}
