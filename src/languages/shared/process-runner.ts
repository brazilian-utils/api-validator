import type { RunnerResult } from "../../core/model.js";
import { parseJsonOutput, run } from "../../core/shell.js";

/**
 * The runner wire protocol shared by every out-of-process runner:
 *
 *   stdin:  {"calls": [{"id": "cpf.isValid#0@0", "symbol": "cpf.is_valid", "args": ["..."]}, ...]}
 *   stdout: <anything>  "\0JSON\0"  [{"id": "...", "ok": true, "value": ...}
 *                                  | {"id": "...", "ok": false, "error": "...", "unsupported"?: true}]
 *
 * The marker lets the lib print whatever it wants (warnings, logs) without breaking parsing.
 * Values are plain JSON: null for None/nil/undefined/Option::None, lists for tuples,
 * objects for records/structs/dicts, ISO-8601 strings for dates.
 */
export interface WireCall {
  id: string;
  symbol: string;
  args: unknown[];
  [extra: string]: unknown;
}

export function runJsonProcess(
  cmd: string,
  args: string[],
  calls: WireCall[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}
): RunnerResult[] {
  const r = run(cmd, args, { ...opts, input: JSON.stringify({ calls }) });
  if (!r.stdout.includes("\u0000JSON\u0000")) {
    const detail = (r.stderr || r.stdout).trim().split("\n").slice(-15).join("\n");
    const error = `runner crashed (exit ${r.status}): ${detail}`;
    return calls.map((c) => ({ id: c.id, ok: false as const, error, unsupported: true }));
  }
  return parseJsonOutput<RunnerResult[]>(r.stdout, `${cmd} runner`);
}
