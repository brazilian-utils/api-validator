/**
 * shields.io "endpoint" badges, one per lib (output/badges/<lib>.json). With the dashboard
 * published to GitHub Pages, a lib's README can show its conformance:
 *   ![API contract](https://img.shields.io/endpoint?url=https://<org>.github.io/api-validator/badges/<lib>.json)
 */
import type { LibReport } from "../core/model.js";

export function badge(report: LibReport) {
  const s = report.summary;
  const tests = report.testsRan ? ` · ${s.testsPassed}/${s.testsPassed + s.testsFailed} tests` : "";
  const color = s.failing + s.signature > 0 || s.missingCore > 0 ? (s.coreCoverage >= 75 ? "yellow" : "orange") : "brightgreen";
  return { schemaVersion: 1, label: "api contract", message: `core ${s.coreCoverage}%${tests}`, color };
}
