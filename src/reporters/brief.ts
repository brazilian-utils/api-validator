/**
 * Porting brief: everything needed to implement (or fix) one contract function in one lib,
 * self-contained so a person or a coding agent can work from it alone:
 * the idiomatic name, the signature, the shared test vectors (the acceptance criteria),
 * the reference implementation's source and links to every other implementation.
 */
import fs from "node:fs";
import path from "node:path";
import { blobUrl } from "../core/libs.js";
import type { ContractFunction, LibConfig, LibReport } from "../core/model.js";
import { sig } from "../core/signature.js";
import type { LanguageAdapter } from "../languages/types.js";

export interface ImplRef {
  lib: LibConfig;
  report: LibReport;
  root: string;
}

const code = (s: string) => `\`${s.replaceAll("`", "'")}\``;
const show = (v: unknown) => (v === undefined ? "" : JSON.stringify(v));

function link(ref: ImplRef, file: string, line: number): string {
  if (!ref.lib.repo || !ref.report.revision) return `${file}:${line}`;
  return blobUrl(ref.lib.repo, ref.report.revision, file, line);
}

/** Source of the top-level block starting at `line` (until the next top-level line). */
function sourceBlock(file: string, line: number, max = 80): string | undefined {
  if (!fs.existsSync(file)) return undefined;
  const lines = fs.readFileSync(file, "utf8").split("\n");
  // Include the doc comment right above.
  let start = line - 1;
  while (start > 0 && /^\s*(\/\/|\*|\/\*\*|#|%%|"""|@|\[)/.test(lines[start - 1])) start--;
  const out: string[] = [];
  for (let i = start; i < lines.length && out.length < max; i++) {
    if (i > line - 1 && out.length > 1 && /^\S/.test(lines[i]) && !/^[)}\]]/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n").trimEnd();
}

const FENCE: Record<string, string> = { typescript: "ts", python: "python", go: "go", rust: "rust", ruby: "ruby", erlang: "erlang", dotnet: "fsharp" };

export function briefMarkdown(fn: ContractFunction, target: ImplRef, adapter: LanguageAdapter, others: ImplRef[], reference?: string): string {
  const out: string[] = [];
  const mine = target.report.functions.find((f) => f.id === fn.id);
  const expected = adapter.candidates(fn, target.lib)[0];
  out.push(`### ${code(fn.id)} in ${target.lib.name}`);
  out.push("");
  if (fn.summary) out.push(`> ${fn.summary}`, "");
  out.push(`- **Contract:** ${code(sig(fn))}${fn.level === "core" ? " (core)" : ""}`);
  out.push(`- **Idiomatic name for ${adapter.displayName}:** ${code(expected)}${mine?.symbol ? ` (today: ${code(mine.symbol)})` : ""}`);
  out.push(`- **Status:** ${mine?.status ?? "missing"}`);
  for (const i of mine?.issues.filter((x) => x.severity !== "info") ?? []) out.push(`  - ${i.severity}: ${i.message}`);
  for (const t of mine?.tests.filter((x) => x.status === "fail") ?? []) out.push(`  - failing ${code(t.id)}: ${t.message}`);
  out.push("");

  if (fn.tests.length) {
    out.push("**Acceptance tests** (shared by every implementation):", "");
    out.push("| args | expected |", "|---|---|");
    for (const t of fn.tests) {
      const e = t.expect;
      const expectation =
        e.kind === "returns" ? show(e.value) : e.kind === "throws" ? "error / exception" : e.kind === "matches" ? `matches /${e.pattern}/` : `result passes ${e.fn}`;
      out.push(`| ${code(JSON.stringify(t.args))}${t.repeat > 1 ? ` ×${t.repeat}` : ""} | ${code(expectation)} |`);
    }
    out.push("");
  } else out.push("_No shared tests yet: add vectors to the contract together with the implementation._", "");

  const impls = others
    .map((o) => ({ o, f: o.report.functions.find((f) => f.id === fn.id) }))
    .filter(({ f }) => f && (f.status === "ok" || f.status === "failing") && f.location);
  if (impls.length) {
    out.push("**Existing implementations:**", "");
    for (const { o, f } of impls) {
      out.push(`- ${o.lib.name}: [${code(f!.symbol!)}](${link(o, f!.location!.file, f!.location!.line)})${f!.status === "failing" ? " — fails some shared tests" : ""}`);
    }
    out.push("");
    const ref = impls.find(({ o }) => o.lib.name === reference) ?? impls[0];
    const src = sourceBlock(path.join(ref.o.root, ref.f!.location!.file), ref.f!.location!.line);
    if (src) {
      out.push(`<details><summary>Reference source (${ref.o.lib.name})</summary>`, "", "```" + (FENCE[ref.o.report.language] ?? ""), src, "```", "", "</details>", "");
    }
  }
  out.push(`Done when: \`doc check --lib ${target.lib.name} --tests --only '${fn.id}'\` reports it ok.`, "");
  return out.join("\n");
}
