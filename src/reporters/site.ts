/**
 * The public status site: static pages built from the contract and the latest reports, so
 * every lib can link its README badge to a page that answers "where are we compared with the
 * other libs, what is missing, what fails" — and every contract function has a page with its
 * spec, the implementation in each lib, a case-by-lib result matrix and the divergences.
 *
 *   index.html                    overview: libs, domains x libs
 *   libs/<lib>/index.html         one lib: comparison, work list, failures, API outside the contract
 *   functions/index.html          every function x lib
 *   functions/<id>/index.html     one function: spec, implementations, cases x libs, divergences
 *   badges/<lib>.svg | .json      badge (self-rendered SVG, and a shields.io endpoint)
 *   api/libs/<lib>.json           the lib's report, for scripts
 *   cases/…                       the JSON conformance suite (see core/cases.ts)
 *
 * Plain HTML + one stylesheet, relative links (works under any base path, e.g. GitHub Pages).
 */
import { marked } from "marked";
import type { ApiSurface, Contract, ContractFunction, FunctionReport, LibConfig, LibReport, NativeSymbol, TestOutcome } from "../core/model.js";
import type { DiffRow } from "../core/differential.js";
import { nativeSig, sig } from "../core/signature.js";
import { json, suiteFiles } from "../core/cases.js";
import { badge } from "./badge.js";

export interface SiteLib {
  lib: LibConfig;
  report: LibReport;
  surface?: ApiSurface;
  /** Source of the lib's reference implementation, per contract function (optional). */
  sources?: Map<string, string>;
}

export interface SiteInput {
  contract: Contract;
  libs: SiteLib[];
  diff?: { compared: number; rows: Array<DiffRow & { split: string }> };
  knownSplits?: Record<string, string[]>;
  /** Absolute URL the site is served from (for README snippets), e.g. https://org.github.io/api-validator/ */
  baseUrl?: string;
  generatedAt: string;
  validatorRepo: string;
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const short = (name: string) => name.replace(/^brazilian-utils-/, "");
const show = (v: unknown) => (v === undefined ? "—" : JSON.stringify(v));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

type Status = FunctionReport["status"];
const STATUS_LABEL: Record<Status, string> = { ok: "ok", failing: "failing", signature: "signature", missing: "missing", waived: "waived" };
const STATUS_CLASS: Record<Status, string> = { ok: "ok", failing: "bad", signature: "warn", missing: "none", waived: "none" };

function repoUrl(lib: LibConfig): string | undefined {
  return lib.repo?.replace(/\.git$/, "");
}

function sourceLink(l: SiteLib, loc?: { file: string; line: number }): string | undefined {
  const repo = repoUrl(l.lib);
  if (!repo || !loc || !l.report.revision || loc.file.startsWith("/") || loc.file.startsWith("..")) return undefined;
  return `${repo}/blob/${l.report.revision}/${loc.file}#L${loc.line}`;
}

function page(root: string, title: string, body: string, input: SiteInput, current: string): string {
  const nav = [
    ["index.html", "Overview"],
    ["functions/index.html", "Functions"],
    ...input.libs.map((l) => [`libs/${short(l.lib.name)}/index.html`, short(l.lib.name)]),
    ["cases/index.json", "JSON suite"]
  ]
    .map(([href, label]) => `<a href="${root}${href}"${href === current ? ' aria-current="page"' : ""}>${esc(label)}</a>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${root}site.css">
</head>
<body>
<header class="top"><a class="brand" href="${root}index.html">brazilian-utils <span>API contract</span></a><nav>${nav}</nav></header>
<main>
${body}
</main>
<footer>Generated ${esc(input.generatedAt)} by <a href="${esc(input.validatorRepo)}">api-validator</a> from the contract and the latest run of every lib. The contract is the spec; each lib's docs link here.</footer>
</body>
</html>
`;
}

function bar(value: number, label?: string): string {
  return `<span class="bar" role="img" aria-label="${esc(label ?? pct(value))}"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></span>`;
}

function pill(status: Status): string {
  return `<span class="pill ${STATUS_CLASS[status]}">${STATUS_LABEL[status]}</span>`;
}

function cell(f: FunctionReport | undefined): string {
  if (!f) return `<td class="dot none" title="not checked">·</td>`;
  const sym = { ok: "●", failing: "✕", signature: "◐", missing: "○", waived: "–" }[f.status];
  return `<td class="dot ${STATUS_CLASS[f.status]}" title="${esc(`${f.status}${f.symbol ? `: ${f.symbol}` : ""}`)}">${sym}</td>`;
}

function libsHead(input: SiteInput, root: string): string {
  return input.libs.map((l) => `<th class="lib"><a href="${root}libs/${short(l.lib.name)}/index.html">${esc(short(l.lib.name))}</a></th>`).join("");
}

const LEGEND = `<p class="legend"><span class="dot ok">●</span> ok <span class="dot bad">✕</span> failing cases <span class="dot warn">◐</span> signature differs <span class="dot none">○</span> missing <span class="dot none">–</span> waived</p>`;

// ---------------------------------------------------------------------------

function overview(input: SiteInput): string {
  const root = "";
  const rows = [...input.libs]
    .sort((a, b) => b.report.summary.coreCoverage - a.report.summary.coreCoverage)
    .map((l) => {
      const s = l.report.summary;
      return `<tr><td><a href="libs/${short(l.lib.name)}/index.html">${esc(short(l.lib.name))}</a></td><td>${esc(l.report.language)}</td><td class="num">${pct(s.coreCoverage)}</td><td>${bar(s.coreCoverage)}</td><td class="num">${s.ok + s.failing}/${s.total}</td><td class="num">${s.testsPassed} / <span class="${s.testsFailed ? "badtext" : ""}">${s.testsFailed}</span></td><td class="num">${s.missingCore}</td><td><img src="badges/${short(l.lib.name)}.svg" alt="badge" height="20"></td></tr>`;
    })
    .join("");
  const domains = [...input.contract.domains.keys()].sort();
  const matrix = domains
    .map((d) => {
      const fns = [...input.contract.functions.values()].filter((f) => f.domain === d);
      const cells = input.libs
        .map((l) => {
          const have = l.report.functions.filter((f) => f.id.startsWith(`${d}.`) && (f.status === "ok" || f.status === "failing")).length;
          const ratio = have / fns.length;
          const cls = ratio === 1 ? "ok" : ratio === 0 ? "none" : "part";
          return `<td class="heat ${cls}" title="${esc(`${short(l.lib.name)}: ${have} of ${fns.length}`)}">${have}/${fns.length}</td>`;
        })
        .join("");
      return `<tr><th scope="row"><a href="functions/index.html#${esc(d)}">${esc(input.contract.domains.get(d)?.title ?? d)}</a></th>${cells}</tr>`;
    })
    .join("");
  const fns = input.contract.functions.size;
  const cases = [...input.contract.functions.values()].reduce((n, f) => n + f.tests.length, 0);
  const fresh = input.diff ? input.diff.rows.length : 0;
  const body = `
<section class="hero">
  <p class="eyebrow">One library, ${input.libs.length} languages</p>
  <h1>Where every brazilian-utils implementation stands</h1>
  <p class="lede">${fns} contract functions in ${input.contract.domains.size} domains, ${cases} shared test cases run against every lib. Pick a lib to see what it is missing, what fails, and how it compares with the others.</p>
</section>
<h2>Libraries</h2>
<div class="scroll"><table>
<thead><tr><th>Lib</th><th>Language</th><th>Core</th><th></th><th>Implemented</th><th>Cases pass / fail</th><th>Missing core</th><th>Badge</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<h2>Domains</h2>
<p class="muted">Functions implemented (ok or failing cases) per domain and lib.</p>
<div class="scroll"><table class="matrix">
<thead><tr><th>Domain</th>${libsHead(input, root)}</tr></thead>
<tbody>${matrix}</tbody></table></div>
${input.diff ? `<h2>Divergences</h2><p>${input.diff.compared} calls with the same input in every lib; <strong>${fresh}</strong> inputs where libs answer differently. See each function's page.</p>` : ""}
<h2>For libs</h2>
<p>Every lib vendors the <a href="cases/index.json">JSON conformance suite</a> and runs it with its own harness (<a href="${esc(input.validatorRepo)}/blob/main/docs/harness.md">how</a>). README badge:</p>
<pre>${esc(`[![API contract](${input.baseUrl ?? ""}badges/<lib>.svg)](${input.baseUrl ?? ""}libs/<lib>/)`)}</pre>`;
  return page(root, "brazilian-utils API contract", body, input, "index.html");
}

// ---------------------------------------------------------------------------

function functionsIndex(input: SiteInput): string {
  const root = "../";
  const byDomain = new Map<string, ContractFunction[]>();
  for (const f of [...input.contract.functions.values()].sort((a, b) => a.id.localeCompare(b.id))) byDomain.set(f.domain, [...(byDomain.get(f.domain) ?? []), f]);
  const reports = input.libs.map((l) => new Map(l.report.functions.map((f) => [f.id, f])));
  const sections = [...byDomain]
    .map(([d, fns]) => {
      const rows = fns
        .map(
          (f) =>
            `<tr><td><a href="${esc(f.id)}/index.html">${esc(f.id)}</a></td><td><span class="lvl ${f.level}">${f.level}</span></td><td class="num">${f.tests.length}</td>${reports.map((r) => cell(r.get(f.id))).join("")}</tr>`
        )
        .join("");
      return `<tr class="group" id="${esc(d)}"><th colspan="${3 + input.libs.length}">${esc(input.contract.domains.get(d)?.title ?? d)}</th></tr>${rows}`;
    })
    .join("");
  const body = `<h1>Functions</h1>${LEGEND}
<div class="scroll"><table class="matrix">
<thead><tr><th>Function</th><th>Level</th><th>Cases</th>${libsHead(input, root)}</tr></thead>
<tbody>${sections}</tbody></table></div>`;
  return page(root, "Functions · brazilian-utils API contract", body, input, "functions/index.html");
}

function caseResult(o: TestOutcome | undefined, f: FunctionReport | undefined): string {
  if (!f || f.status === "missing" || f.status === "waived") return `<td class="dot none">○</td>`;
  if (!o) return `<td class="dot none" title="not run">·</td>`;
  const map = { pass: ["ok", "●"], fail: ["bad", "✕"], "known-failure": ["bad", "✕"], skip: ["none", "·"] } as const;
  const [cls, sym] = map[o.status];
  return `<td class="dot ${cls}" title="${esc(`${o.status}${o.message ? `: ${o.message}` : ""}`)}">${sym}</td>`;
}

function expectText(t: ContractFunction["tests"][number]): string {
  const e = t.expect;
  return e.kind === "returns" ? show(e.value ?? null) : e.kind === "throws" ? "throws" : e.kind === "matches" ? `matches /${e.pattern}/` : `satisfies ${e.fn}`;
}

function functionPage(input: SiteInput, fn: ContractFunction): string {
  const root = "../../";
  const libRows = input.libs
    .map((l) => {
      const f = l.report.functions.find((x) => x.id === fn.id);
      if (!f) return "";
      const sym = f.symbol ? l.surface?.symbols.find((s) => s.name === f.symbol) : undefined;
      const link = sourceLink(l, f.location);
      const fails = f.tests.filter((t) => t.status === "fail" || t.status === "known-failure").length;
      const notes = [
        ...f.issues.filter((i) => i.severity !== "info").map((i) => esc(i.message)),
        ...(fails ? [`${fails} failing case${fails === 1 ? "" : "s"}`] : []),
        ...(f.waiver ? [`waived: ${esc(f.waiver)}`] : []),
        ...(f.status === "missing" && f.suggestions.length ? [`maybe: ${f.suggestions.map((s) => `<code>${esc(s.symbol)}</code>`).join(", ")}`] : [])
      ];
      return `<tr><td><a href="${root}libs/${short(l.lib.name)}/index.html">${esc(short(l.lib.name))}</a></td><td>${pill(f.status)}</td><td>${sym ? `<code>${esc(nativeSig(sym as NativeSymbol))}</code>` : f.symbol ? `<code>${esc(f.symbol)}</code>` : "—"}</td><td>${link ? `<a href="${esc(link)}">source</a>` : ""}</td><td class="notes">${notes.join("<br>")}</td></tr>`;
    })
    .join("");
  const reports = input.libs.map((l) => l.report.functions.find((x) => x.id === fn.id));
  const caseRows = fn.tests
    .map((t) => {
      const results = reports.map((f) => caseResult(f?.tests.find((o) => o.id === t.id), f)).join("");
      return `<tr><td><code>${esc(JSON.stringify(t.args))}</code>${t.name ? `<div class="muted small">${esc(t.name)}</div>` : ""}${t.note ? `<div class="muted small">${esc(t.note)}</div>` : ""}</td><td><code>${esc(expectText(t))}</code>${t.repeat > 1 ? ` <span class="muted small">×${t.repeat}</span>` : ""}</td>${results}</tr>`;
    })
    .join("");
  const failures = input.libs
    .flatMap((l) =>
      (l.report.functions.find((x) => x.id === fn.id)?.tests ?? [])
        .filter((t) => t.status === "fail" || t.status === "known-failure")
        .map((t) => `<tr><td>${esc(short(l.lib.name))}</td><td><code>${esc(t.id.slice(fn.id.length + 1))}</code></td><td><code>${esc(show(t.expected))}</code></td><td><code>${esc(t.actual === undefined ? t.message ?? "" : show(t.actual))}</code></td></tr>`)
    )
    .join("");
  const divergences = (input.diff?.rows ?? [])
    .filter((r) => r.fn === fn.id)
    .slice(0, 40)
    .map((r) => `<tr><td><code>${esc(JSON.stringify(r.args))}</code></td><td>${r.answers.map((a) => `<code>${esc(a.answer)}</code> ← ${esc(a.libs.map(short).join(", "))}`).join("<br>")}</td></tr>`)
    .join("");
  const splits = input.knownSplits?.[fn.id] ?? [];
  const reference = input.libs.map((l) => ({ l, src: l.sources?.get(fn.id) })).find((x) => x.src);
  const body = `
<p class="crumbs"><a href="${root}functions/index.html#${esc(fn.domain)}">${esc(input.contract.domains.get(fn.domain)?.title ?? fn.domain)}</a></p>
<h1><code class="h">${esc(fn.id)}</code> <span class="lvl ${fn.level}">${fn.level}</span>${fn.deprecated ? ' <span class="pill warn">deprecated</span>' : ""}${fn.network ? ' <span class="pill none">network</span>' : ""}</h1>
${fn.summary ? `<p class="lede">${marked.parseInline(fn.summary, { async: false })}</p>` : ""}
<pre class="sig">${esc(sig(fn))}</pre>
${fn.params.some((p) => p.description) ? `<ul>${fn.params.filter((p) => p.description).map((p) => `<li><code>${esc(p.name)}</code>: ${esc(p.description)}</li>`).join("")}</ul>` : ""}
${fn.description ? `<section class="spec">${marked.parse(fn.description, { async: false })}</section>` : `<p class="muted">No written spec yet: the cases below are the spec. Add a <code>description</code> to <code>${esc(fn.source)}</code>.</p>`}
${fn.references?.length ? `<h3>References</h3><ul>${fn.references.map((r) => `<li><a href="${esc(r)}">${esc(r)}</a></li>`).join("")}</ul>` : ""}
<h2>Implementations</h2>
<div class="scroll"><table><thead><tr><th>Lib</th><th>Status</th><th>Native signature</th><th></th><th>Notes</th></tr></thead><tbody>${libRows}</tbody></table></div>
<h2>Cases × libs</h2>
${fn.tests.length ? `${LEGEND.replace("signature differs", "skipped").replace('<span class="dot warn">◐</span> skipped', '<span class="dot none">·</span> skipped / not run')}
<div class="scroll"><table class="matrix"><thead><tr><th>Args</th><th>Expected</th>${libsHead(input, root)}</tr></thead><tbody>${caseRows}</tbody></table></div>` : `<p class="muted">No cases yet — every lib may implement this differently and nothing would notice.</p>`}
${failures ? `<h2>Failures</h2><div class="scroll"><table><thead><tr><th>Lib</th><th>Case</th><th>Expected</th><th>Actual</th></tr></thead><tbody>${failures}</tbody></table></div>` : ""}
${divergences || splits.length ? `<h2>Divergences</h2>${splits.length ? `<p>Known splits: ${splits.map((s) => `<code>${esc(s)}</code>`).join(" · ")}</p>` : ""}${divergences ? `<div class="scroll"><table><thead><tr><th>Same input</th><th>Answers</th></tr></thead><tbody>${divergences}</tbody></table></div>` : ""}` : ""}
${reference ? `<h2>Reference implementation (${esc(short(reference.l.lib.name))})</h2><pre>${esc(reference.src)}</pre>` : ""}
<p class="muted small">Spec source: <a href="${esc(input.validatorRepo)}/blob/main/${esc(fn.source)}">${esc(fn.source)}</a> · cases: <a href="${root}cases/${esc(fn.domain)}.json">cases/${esc(fn.domain)}.json</a></p>`;
  return page(root, `${fn.id} · brazilian-utils API contract`, body, input, "");
}

// ---------------------------------------------------------------------------

function libPage(input: SiteInput, l: SiteLib): string {
  const root = "../../";
  const s = l.report.summary;
  const name = short(l.lib.name);
  const implementedBy = (id: string) =>
    input.libs.filter((o) => o !== l && o.report.functions.some((f) => f.id === id && (f.status === "ok" || f.status === "failing"))).map((o) => short(o.lib.name));
  const compare = [...input.libs]
    .sort((a, b) => b.report.summary.coreCoverage - a.report.summary.coreCoverage)
    .map((o) => `<tr class="${o === l ? "me" : ""}"><td>${o === l ? `<strong>${esc(short(o.lib.name))}</strong>` : `<a href="../${short(o.lib.name)}/index.html">${esc(short(o.lib.name))}</a>`}</td><td class="num">${pct(o.report.summary.coreCoverage)}</td><td>${bar(o.report.summary.coreCoverage)}</td><td class="num">${o.report.summary.ok + o.report.summary.failing}</td><td class="num">${o.report.summary.testsPassed}</td></tr>`)
    .join("");
  const rank = (f: FunctionReport) => ({ failing: 0, signature: 1, missing: f.level === "core" ? 2 : 3, ok: 9, waived: 9 })[f.status];
  const work = l.report.functions
    .filter((f) => rank(f) < 9)
    .map((f) => ({ f, by: implementedBy(f.id) }))
    .sort((a, b) => rank(a.f) - rank(b.f) || b.by.length - a.by.length || a.f.id.localeCompare(b.f.id));
  const why = (f: FunctionReport) =>
    f.status === "failing"
      ? plural(f.tests.filter((t) => t.status === "fail" || t.status === "known-failure").length, "failing case")
      : f.status === "signature"
        ? f.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ")
        : f.suggestions.length
          ? `maybe already there as ${f.suggestions.map((x) => x.symbol).join(", ")}`
          : "";
  const workRows = work
    .map(({ f, by }) => `<tr><td><a href="${root}functions/${esc(f.id)}/index.html">${esc(f.id)}</a></td><td><span class="lvl ${f.level}">${f.level}</span></td><td>${pill(f.status)}</td><td class="small">${esc(why(f))}</td><td class="small">${by.length ? `${by.length}: ${esc(by.join(", "))}` : "none yet"}</td></tr>`)
    .join("");
  const failures = l.report.functions
    .flatMap((f) => f.tests.filter((t) => t.status === "fail" || t.status === "known-failure").map((t) => ({ f, t })))
    .map(({ f, t }) => `<tr><td><a href="${root}functions/${esc(f.id)}/index.html">${esc(t.id)}</a></td><td><code>${esc(show(t.expected))}</code></td><td><code>${esc(t.actual === undefined ? t.message ?? "" : show(t.actual))}</code></td></tr>`)
    .join("");
  const unmapped = l.report.unmapped
    .map((u) => `<tr><td><code>${esc(u.symbol)}</code></td><td class="small">${u.suggestions.map((x) => `<a href="${root}functions/${esc(x.id)}/index.html">${esc(x.id)}</a>`).join(", ")}</td></tr>`)
    .join("");
  const minority = new Map<string, number>();
  for (const r of input.diff?.rows ?? []) {
    const mine = r.answers.findIndex((a) => a.libs.includes(l.lib.name));
    if (mine > 0) minority.set(r.fn, (minority.get(r.fn) ?? 0) + 1);
  }
  const divRows = [...minority]
    .sort((a, b) => b[1] - a[1])
    .map(([fn, n]) => `<tr><td><a href="${root}functions/${esc(fn)}/index.html">${esc(fn)}</a></td><td class="num">${n}</td></tr>`)
    .join("");
  const repo = repoUrl(l.lib);
  const badgeMd = `[![API contract](${input.baseUrl ?? root}badges/${name}.svg)](${input.baseUrl ?? root}libs/${name}/)`;
  const body = `
<p class="eyebrow">${esc(l.report.language)}${l.report.revision ? ` · <code>${esc(l.report.revision.slice(0, 7))}</code>` : ""}</p>
<h1>${esc(l.lib.name)}</h1>
<p>${repo ? `<a href="${esc(repo)}">${esc(repo.replace("https://github.com/", ""))}</a> · ` : ""}<a href="${root}api/libs/${name}.json">report JSON</a> · <img src="${root}badges/${name}.svg" alt="badge" height="20" class="inline"></p>
<div class="stats">
<div><b>${pct(s.coreCoverage)}</b><span>core functions</span></div>
<div><b>${s.ok + s.failing}/${s.total}</b><span>functions implemented</span></div>
<div><b>${s.testsPassed}</b><span>cases passing</span></div>
<div><b class="${s.testsFailed ? "badtext" : ""}">${s.testsFailed}</b><span>cases failing</span></div>
<div><b>${s.signature}</b><span>signatures to fix</span></div>
<div><b>${l.report.unmapped.length}</b><span>public API outside the contract</span></div>
</div>
<h2>Compared with the other libs</h2>
<div class="scroll"><table><thead><tr><th>Lib</th><th>Core</th><th></th><th>Implemented</th><th>Cases passing</th></tr></thead><tbody>${compare}</tbody></table></div>
<h2>Work list</h2>
<p class="muted">Failing first, then signatures, then missing core, then missing extended — within each, functions most other libs already have (more references to port from) first.</p>
<div class="scroll"><table><thead><tr><th>Function</th><th>Level</th><th>Status</th><th>Why</th><th>Implemented by</th></tr></thead><tbody>${workRows || '<tr><td colspan="5">Nothing: every contract function is implemented and passing.</td></tr>'}</tbody></table></div>
${failures ? `<h2>Failing cases</h2><div class="scroll"><table><thead><tr><th>Case</th><th>Expected</th><th>Actual</th></tr></thead><tbody>${failures}</tbody></table></div>` : ""}
${unmapped ? `<h2>Public API outside the contract</h2><p class="muted">Bind each to a contract function (<code>bindings</code>), propose it in the contract, or mark it internal (<code>ignore</code>) in <code>libs/${esc(l.lib.name)}.yaml</code>.</p><div class="scroll"><table><thead><tr><th>Symbol</th><th>Might be</th></tr></thead><tbody>${unmapped}</tbody></table></div>` : ""}
${divRows ? `<h2>Where this lib answers differently</h2><p class="muted">Inputs where this lib is not in the largest group of libs giving the same answer.</p><div class="scroll"><table><thead><tr><th>Function</th><th>Inputs</th></tr></thead><tbody>${divRows}</tbody></table></div>` : ""}
<h2>Working on it</h2>
<pre>${esc(`# from the lib checkout, with api-validator next to it
npx tsx ../api-validator/src/cli.ts check --lib ${l.lib.name} --path . --tests   # this page, locally
npx tsx ../api-validator/src/cli.ts brief <function> --lib ${l.lib.name} --path .  # porting brief
npx tsx ../api-validator/src/cli.ts export-cases --lib ${l.lib.name} --path .      # refresh api-contract/`)}</pre>
<h3>README badge</h3>
<pre>${esc(badgeMd)}</pre>`;
  return page(root, `${name} · brazilian-utils API contract`, body, input, `libs/${name}/index.html`);
}

// ---------------------------------------------------------------------------

/** Width of Verdana 11px text, approximately (what shields-style badges use). */
function textWidth(s: string): number {
  return [...s].reduce((w, ch) => w + (/[ilj.,:;|!']/.test(ch) ? 3.5 : /[mwMW%]/.test(ch) ? 10 : /[A-Z0-9]/.test(ch) ? 7.5 : 6.5), 0);
}

export function badgeSvg(report: LibReport): string {
  const b = badge(report);
  const color = { brightgreen: "#2e7d32", yellow: "#b08800", orange: "#c75000" }[b.color] ?? "#555";
  const lw = Math.round(textWidth(b.label) + 12);
  const rw = Math.round(textWidth(b.message) + 12);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${esc(`${b.label}: ${b.message}`)}"><title>${esc(`${b.label}: ${b.message}`)}</title><clipPath id="r"><rect width="${lw + rw}" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${rw}" height="20" fill="${color}"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11"><text x="${lw / 2}" y="14">${esc(b.label)}</text><text x="${lw + rw / 2}" y="14">${esc(b.message)}</text></g></svg>\n`;
}

const CSS = `:root{--ground:#f5f7f3;--surface:#fff;--sunk:#ecf0ea;--ink:#15201a;--muted:#58645d;--line:#d6ddd5;--accent:#1d7447;--ok:#1d7447;--ok-bg:#dcefe3;--warn:#a87808;--warn-bg:#f6ebcb;--bad:#b23a2e;--bad-bg:#f7e1dd;--none:#9aa59e;--part:#eaf3d9;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--ground:#0e1411;--surface:#151d18;--sunk:#1b2620;--ink:#e4ebe6;--muted:#98a69d;--line:#2a3830;--accent:#52c48a;--ok:#52c48a;--ok-bg:#1b3527;--warn:#e2b64e;--warn-bg:#3a3018;--bad:#ee7a6c;--bad-bg:#3d211d;--none:#5d6b63;--part:#26331c;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86em}
header.top{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--surface);position:sticky;top:0;z-index:1}
.brand{font-weight:700;text-decoration:none;color:var(--ink)}.brand span{color:var(--accent)}
header nav{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px}header nav a{color:var(--muted);text-decoration:none}header nav a[aria-current],header nav a:hover{color:var(--accent)}
main{max-width:1180px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:30px;line-height:1.2;margin:8px 0 12px;text-wrap:balance}h2{font-size:21px;margin:40px 0 10px;padding-top:16px;border-top:1px solid var(--line)}h3{font-size:16px;margin:22px 0 8px}
.hero h1{font-size:36px}.lede{font-size:17px;color:var(--muted);max-width:70ch}.eyebrow{font:600 12px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin:0}
.muted{color:var(--muted)}.small{font-size:12.5px}.crumbs{margin:0;font-size:13px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface);margin:12px 0}
table{border-collapse:collapse;width:100%}th,td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
thead th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);background:var(--sunk);white-space:nowrap}
tr:last-child td{border-bottom:0}td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
tr.group th{background:var(--sunk);font-size:13px}tr.me td{background:var(--ok-bg)}
.matrix th.lib{text-align:center}.dot{text-align:center;font-size:14px}.dot.ok{color:var(--ok)}.dot.bad{color:var(--bad)}.dot.warn{color:var(--warn)}.dot.none{color:var(--none)}
.heat{text-align:center;font-variant-numeric:tabular-nums;font-size:13px}.heat.ok{background:var(--ok-bg);color:var(--ok)}.heat.part{background:var(--part)}.heat.none{color:var(--none)}
.pill{display:inline-block;font:600 11.5px/1.7 ui-monospace,monospace;padding:0 8px;border-radius:99px;white-space:nowrap}.pill.ok{background:var(--ok-bg);color:var(--ok)}.pill.warn{background:var(--warn-bg);color:var(--warn)}.pill.bad{background:var(--bad-bg);color:var(--bad)}.pill.none{background:var(--sunk);color:var(--muted)}
.lvl{font:600 11px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.lvl.core{color:var(--accent)}
.bar{display:inline-block;width:120px;height:8px;border-radius:99px;background:var(--sunk);overflow:hidden;vertical-align:middle}.bar i{display:block;height:100%;background:var(--accent)}
.badtext{color:var(--bad)}.legend{font-size:13px;color:var(--muted)}.legend .dot{margin-left:10px}
pre{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:12px 14px;overflow-x:auto}pre.sig{font-size:14px}
code.h{font-size:.95em}.spec{max-width:78ch}.notes{font-size:13px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:18px 0}
.stats div{background:var(--surface);padding:12px 14px}.stats b{display:block;font-size:24px;font-variant-numeric:tabular-nums}.stats span{font-size:12.5px;color:var(--muted)}
img.inline{vertical-align:middle}
footer{max-width:1180px;margin:0 auto;padding:16px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px}
`;

export function buildSite(input: SiteInput): Map<string, string> {
  const out = new Map<string, string>();
  out.set("site.css", CSS);
  out.set("index.html", overview(input));
  out.set("functions/index.html", functionsIndex(input));
  for (const fn of input.contract.functions.values()) out.set(`functions/${fn.id}/index.html`, functionPage(input, fn));
  for (const l of input.libs) {
    const name = short(l.lib.name);
    out.set(`libs/${name}/index.html`, libPage(input, l));
    out.set(`badges/${name}.svg`, badgeSvg(l.report));
    out.set(`badges/${name}.json`, JSON.stringify(badge(l.report)));
    out.set(`api/libs/${name}.json`, json(l.report));
  }
  for (const [rel, value] of suiteFiles(input.contract)) out.set(rel, json(value));
  return out;
}
