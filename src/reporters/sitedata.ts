/**
 * Data the docs site (site/, Starlight) needs from a validator run, written by
 * `api-validator site-data`:
 *
 *   site/.generated/status.json     per lib: summary, and per contract function its status,
 *                                   native symbol, source link and failing cases; per function
 *                                   the inputs where libs disagree (from `diff`)
 *   site/public/badges/<lib>.svg    self-rendered badge (+ .json shields.io endpoint)
 *   site/public/cases/…             the JSON conformance suite (see core/cases.ts)
 *
 * The site reads the contract and lib configs directly; this file only adds what a run found.
 * Without it the site still builds, showing the spec and the usage tabs without status.
 */
import type { Contract, LibConfig, LibReport } from "../core/model.js";
import type { DiffRow } from "../core/differential.js";
import { blobUrl } from "../core/libs.js";
import type { FunctionUsage } from "../core/usage.js";
import { shortName as short } from "../../site/src/lib/usage-format.mjs";
import { json, suiteFiles } from "../core/cases.js";
import { badge, badgeSvg } from "./badge.js";

export interface SiteDataLib {
  lib: LibConfig;
  report: LibReport;
  /** Contract ops the lib's usage files document, per function id (see core/usage.ts). */
  usage?: Record<string, FunctionUsage>;
}

export interface SiteDataInput {
  contract: Contract;
  libs: SiteDataLib[];
  diff?: { compared: number; rows: Array<DiffRow & { split: string }> };
  generatedAt: string;
}

function sourceUrl(lib: LibConfig, report: LibReport, loc?: { file: string; line: number }): string | undefined {
  if (!lib.repo || !loc || !report.revision || loc.file.startsWith("/") || loc.file.startsWith("..")) return undefined;
  return blobUrl(lib.repo, report.revision, loc.file, loc.line);
}

function statusJson(input: SiteDataInput) {
  const libs = Object.fromEntries(
    input.libs.map(({ lib, report, usage }) => [
      short(lib.name),
      {
        name: lib.name,
        language: report.language,
        revision: report.revision,
        repo: lib.repo,
        summary: report.summary,
        testsRan: report.testsRan,
        functions: Object.fromEntries(
          report.functions.map((f) => {
            const failures = f.tests.filter((t) => t.status === "fail" || t.status === "known-failure");
            return [
              f.id,
              {
                status: f.status,
                level: f.level,
                symbol: f.symbol,
                source: sourceUrl(lib, report, f.location),
                passed: f.tests.filter((t) => t.status === "pass").length,
                failed: failures.length,
                issues: f.issues.filter((i) => i.severity === "error").map((i) => i.message),
                failures: failures.map((t) => ({ id: t.id, expected: t.expected ?? null, actual: t.actual ?? null, message: t.message })),
                results: Object.fromEntries(f.tests.map((t) => [t.id, t.status])),
                suggestions: f.suggestions.map((s) => s.symbol),
                waiver: f.waiver,
                usage: usage?.[f.id]
              }
            ];
          })
        ),
        unmapped: report.unmapped.map((u) => ({ symbol: u.symbol, suggestions: u.suggestions.map((s) => s.id) }))
      }
    ])
  );
  const divergences: Record<string, { splits: string[]; rows: Array<{ args: unknown[]; answers: Array<{ answer: string; libs: string[] }> }> }> = {};
  for (const r of input.diff?.rows ?? []) {
    const d = (divergences[r.fn] ??= { splits: [], rows: [] });
    if (!d.splits.includes(r.split)) d.splits.push(r.split);
    if (d.rows.length < 20) d.rows.push({ args: r.args, answers: r.answers.map((a) => ({ answer: a.answer, libs: a.libs.map(short) })) });
  }
  return { generatedAt: input.generatedAt, compared: input.diff?.compared, libs, divergences };
}

/** Every file to write, relative to the site root. */
export function siteDataFiles(input: SiteDataInput): Map<string, string> {
  const out = new Map<string, string>();
  out.set(".generated/status.json", json(statusJson(input)));
  for (const { lib, report } of input.libs) {
    out.set(`public/badges/${short(lib.name)}.svg`, badgeSvg(report));
    out.set(`public/badges/${short(lib.name)}.json`, JSON.stringify(badge(report)));
  }
  for (const [rel, value] of suiteFiles(input.contract)) out.set(`public/${rel}`, json(value));
  return out;
}
