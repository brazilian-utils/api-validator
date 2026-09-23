/**
 * A lib's conformance badge, published with the docs site as `badges/<lib>.svg` (self-rendered,
 * no third-party service) and `badges/<lib>.json` (a shields.io "endpoint", for other styles).
 * A lib's README links it to its status page:
 *   [![API contract](https://<site>/badges/<lib>.svg)](https://<site>/libs/<lib>/)
 */
import type { LibReport } from "../core/model.js";

export function badge(report: LibReport) {
  const s = report.summary;
  const tests = report.testsRan ? ` · ${s.testsPassed}/${s.testsPassed + s.testsFailed} tests` : "";
  const color = s.failing + s.signature > 0 || s.missingCore > 0 ? (s.coreCoverage >= 75 ? "yellow" : "orange") : "brightgreen";
  return { schemaVersion: 1, label: "api contract", message: `core ${s.coreCoverage}%${tests}`, color };
}

/** Width of Verdana 11px text, approximately (what shields-style badges use). */
function textWidth(s: string): number {
  return [...s].reduce((w, ch) => w + (/[ilj.,:;|!']/.test(ch) ? 3.5 : /[mwMW%]/.test(ch) ? 10 : /[A-Z0-9]/.test(ch) ? 7.5 : 6.5), 0);
}

export function badgeSvg(report: LibReport): string {
  const b = badge(report);
  const color = { brightgreen: "#2e7d32", yellow: "#b08800", orange: "#c75000" }[b.color] ?? "#555";
  const lw = Math.round(textWidth(b.label) + 12);
  const rw = Math.round(textWidth(b.message) + 12);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${escXml(`${b.label}: ${b.message}`)}"><title>${escXml(`${b.label}: ${b.message}`)}</title><clipPath id="r"><rect width="${lw + rw}" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${rw}" height="20" fill="${color}"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11"><text x="${lw / 2}" y="14">${escXml(b.label)}</text><text x="${lw + rw / 2}" y="14">${escXml(b.message)}</text></g></svg>\n`;
}


function escXml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
