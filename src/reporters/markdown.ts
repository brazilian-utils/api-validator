/**
 * Per-lib markdown report: an actionable TODO list, ordered by what to do first.
 * Also used as the GitHub job summary when running inside a lib's CI.
 */
import type { BaselineDiff } from "../core/baseline.js";
import type { Contract, FunctionReport, LibReport } from "../core/model.js";
import { sig } from "../core/signature.js";

const esc = (s: string) => s.replaceAll("|", "\\|").replaceAll("\n", " ");
const code = (s: string) => `\`${s.replaceAll("`", "'")}\``;

function where(f: { location?: { file: string; line: number } }): string {
  return f.location ? ` — ${code(`${f.location.file}:${f.location.line}`)}` : "";
}

function fnLine(contract: Contract, f: FunctionReport): string {
  const fn = contract.functions.get(f.id)!;
  return `${code(f.id)} ${code(sig(fn))}`;
}

export function libMarkdown(report: LibReport, contract: Contract, diff?: BaselineDiff): string {
  const s = report.summary;
  const out: string[] = [];
  out.push(`## ${report.library} (${report.language})`);
  out.push("");
  if (report.revision) out.push(`Revision ${code(report.revision.slice(0, 12))}`);
  out.push("");
  out.push("| Coverage | Core coverage | OK | Signature issues | Failing tests | Missing (core) | Waived |");
  out.push("|---|---|---|---|---|---|---|");
  out.push(`| **${s.coverage}%** | **${s.coreCoverage}%** | ${s.ok} | ${s.signature} | ${s.failing} | ${s.missing} (${s.missingCore}) | ${s.waived} |`);
  out.push("");
  if (report.testsRan) out.push(`Conformance tests: ${s.testsPassed} passed, ${s.testsFailed} failed, ${s.testsSkipped} skipped.`);
  else out.push(`Conformance tests: not run${report.runnerNote ? ` (${report.runnerNote})` : ""}.`);
  out.push("");

  if (diff && diff.regressions.length > 0) {
    out.push(`### 🚨 Regressions vs baseline (${diff.regressions.length})`);
    out.push("");
    for (const r of diff.regressions) out.push(`- ${code(r.id)} is now **${r.now}**${r.detail ? `: ${esc(r.detail)}` : ""}`);
    out.push("");
  }

  if (report.configIssues.length > 0) {
    out.push("### ⚙️ Config problems");
    out.push("");
    for (const i of report.configIssues) out.push(`- **${i.severity}** ${esc(i.message)}`);
    out.push("");
  }

  const by = (status: string, level?: string) =>
    report.functions.filter((f) => f.status === status && (!level || f.level === level));

  const missingCore = by("missing", "core");
  if (missingCore.length > 0) {
    out.push(`### ❌ Missing core functions (${missingCore.length})`);
    out.push("");
    out.push("Every implementation is expected to have these.");
    out.push("");
    for (const f of missingCore) out.push(missingItem(contract, f));
    out.push("");
  }

  const sigIssues = by("signature");
  if (sigIssues.length > 0) {
    out.push(`### ⚠️ Signature does not match the contract (${sigIssues.length})`);
    out.push("");
    for (const f of sigIssues) {
      out.push(`- [ ] ${fnLine(contract, f)} → ${code(f.symbol!)}${where(f)}`);
      for (const i of f.issues.filter((x) => x.severity !== "info")) out.push(`  - ${i.severity === "error" ? "**error**" : "warning"}: ${esc(i.message)}`);
    }
    out.push("");
  }

  const failing = by("failing");
  if (failing.length > 0) {
    out.push(`### 🧪 Behaviour differs from the contract tests (${failing.length})`);
    out.push("");
    for (const f of failing) {
      out.push(`- [ ] ${code(f.id)} → ${code(f.symbol!)}${where(f)}`);
      for (const t of f.tests.filter((x) => x.status === "fail")) out.push(`  - ${code(t.id)}: ${esc(t.message ?? "")}`);
    }
    out.push("");
  }

  const warnings = report.functions.filter((f) => f.status === "ok" && f.issues.some((i) => i.severity === "warning"));
  if (warnings.length > 0) {
    out.push(`<details><summary>🔸 Compatible, with warnings (${warnings.length})</summary>`);
    out.push("");
    for (const f of warnings) {
      out.push(`- ${code(f.id)} → ${code(f.symbol!)}${where(f)}`);
      for (const i of f.issues.filter((x) => x.severity === "warning")) out.push(`  - ${esc(i.message)}`);
    }
    out.push("");
    out.push("</details>");
    out.push("");
  }

  const missingExt = by("missing", "extended");
  if (missingExt.length > 0) {
    out.push(`<details><summary>➕ Missing extended functions (${missingExt.length})</summary>`);
    out.push("");
    for (const f of missingExt) out.push(missingItem(contract, f));
    out.push("");
    out.push("</details>");
    out.push("");
  }

  if (report.unmapped.length > 0) {
    out.push(`<details><summary>🔍 Public symbols not mapped to the contract (${report.unmapped.length})</summary>`);
    out.push("");
    out.push("Either bind them (if they implement a contract function under another name), propose them for the contract, or add them to `ignore` in the lib config.");
    out.push("");
    for (const u of report.unmapped) {
      const hint = u.suggestions.length ? ` — maybe ${u.suggestions.map((x) => `${code(x.id)} (${Math.round(x.score * 100)}%)`).join(", ")}` : "";
      out.push(`- ${code(u.symbol)}${where(u)}${hint}`);
    }
    const bindable = report.unmapped.filter((u) => u.suggestions.length > 0);
    if (bindable.length > 0) {
      out.push("");
      out.push("Suggested `bindings` (verify before copying into the lib config):");
      out.push("");
      out.push("```yaml");
      out.push("bindings:");
      for (const u of bindable) out.push(`  ${u.suggestions[0].id}: ${u.symbol}`);
      out.push("```");
    }
    out.push("");
    out.push("</details>");
    out.push("");
  }

  const waived = by("waived");
  if (waived.length > 0) {
    out.push(`<details><summary>🙈 Waived (${waived.length})</summary>`);
    out.push("");
    for (const f of waived) out.push(`- ${code(f.id)}: ${esc(f.waiver ?? "")}`);
    out.push("");
    out.push("</details>");
    out.push("");
  }

  if (diff && diff.improvements.length > 0) {
    out.push(`✨ ${diff.improvements.length} function(s)/test(s) conform now but are not in the baseline yet — run \`api-validator baseline --lib ${report.library}\` to lock them in.`);
    out.push("");
  }
  return out.join("\n");
}

function missingItem(contract: Contract, f: FunctionReport): string {
  const hint = f.suggestions.length
    ? ` — similar: ${f.suggestions.map((s) => `${code(s.symbol)} (${Math.round(s.score * 100)}%)`).join(", ")}`
    : "";
  const extra = f.issues.length ? ` — ${f.issues.map((i) => esc(i.message)).join("; ")}` : "";
  return `- [ ] ${fnLine(contract, f)}${hint}${extra}`;
}

/** Cross-lib overview: one row per lib. */
export function overviewMarkdown(reports: LibReport[]): string {
  const out = ["| Library | Coverage | Core | OK | Signature | Failing | Missing | Tests (pass/fail/skip) |", "|---|---|---|---|---|---|---|---|"];
  for (const r of reports) {
    const s = r.summary;
    const tests = r.testsRan ? `${s.testsPassed}/${s.testsFailed}/${s.testsSkipped}` : "not run";
    out.push(`| ${r.library} | ${s.coverage}% | ${s.coreCoverage}% | ${s.ok} | ${s.signature} | ${s.failing} | ${s.missing} | ${tests} |`);
  }
  return out.join("\n");
}
