import type { BaselineDiff } from "../core/baseline.js";
import type { LibReport } from "../core/model.js";

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const color = (n: number) => (s: string) => (tty ? `\x1b[${n}m${s}\x1b[0m` : s);
export const c = { red: color(31), green: color(32), yellow: color(33), dim: color(2), bold: color(1), cyan: color(36) };

export function consoleSummary(report: LibReport, diff: BaselineDiff | undefined, verbose: boolean): string {
  const s = report.summary;
  const lines: string[] = [];
  const pct = s.coverage >= 90 ? c.green : s.coverage >= 50 ? c.yellow : c.red;
  lines.push(
    `${c.bold(report.library)} ${c.dim(`(${report.language})`)}  coverage ${pct(`${s.coverage}%`)}  core ${s.coreCoverage}%  ` +
      `${c.green(`${s.ok} ok`)}  ${s.signature ? c.yellow(`${s.signature} signature`) : "0 signature"}  ` +
      `${s.failing ? c.red(`${s.failing} failing`) : "0 failing"}  ${s.missing} missing (${s.missingCore} core)` +
      (report.testsRan ? `  tests ${c.green(String(s.testsPassed))}/${s.testsFailed ? c.red(String(s.testsFailed)) : "0"}/${c.dim(String(s.testsSkipped))}` : c.dim(`  tests not run${report.runnerNote ? `: ${report.runnerNote}` : ""}`))
  );
  for (const i of report.configIssues) lines.push(`  ${i.severity === "error" ? c.red("config error") : c.yellow("config")}: ${i.message}`);
  if (diff) {
    for (const r of diff.regressions) lines.push(`  ${c.red("REGRESSION")} ${r.id} is now ${r.now}${r.detail ? c.dim(` — ${r.detail}`) : ""}`);
    if (diff.improvements.length) lines.push(c.cyan(`  ${diff.improvements.length} newly conforming (not in baseline yet)`));
  }
  if (verbose) {
    for (const f of report.functions) {
      if (f.status === "ok" && !f.issues.some((i) => i.severity === "warning")) continue;
      if (f.status === "missing" && f.level === "extended") continue;
      const tag = { ok: c.yellow("warn"), signature: c.yellow("sig "), failing: c.red("fail"), missing: c.red("miss"), waived: c.dim("waiv") }[f.status];
      lines.push(`  ${tag} ${f.id}${f.symbol ? c.dim(` → ${f.symbol}`) : ""}`);
      for (const i of f.issues.filter((x) => x.severity !== "info")) lines.push(c.dim(`         ${i.message}`));
      for (const t of f.tests.filter((x) => x.status === "fail")) lines.push(c.dim(`         ${t.id}: ${t.message}`));
      if (f.suggestions.length) lines.push(c.dim(`         similar: ${f.suggestions.map((x) => x.symbol).join(", ")}`));
    }
  }
  return lines.join("\n");
}
