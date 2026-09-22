/**
 * Self-contained HTML dashboard: contract functions x libs matrix with filters and a detail
 * panel per cell. Data is embedded as JSON; no external resources.
 */
import fs from "node:fs";
import path from "node:path";
import type { Contract, LibReport } from "../core/model.js";
import { sig } from "../core/signature.js";

export function dashboardData(contract: Contract, reports: LibReport[]) {
  const functions = [...contract.functions.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => ({ id: f.id, domain: f.domain, level: f.level, sig: sig(f), tests: f.tests.length }));
  return {
    generatedAt: new Date().toISOString(),
    functions,
    libs: reports.map((r) => ({
      name: r.library,
      language: r.language,
      revision: r.revision?.slice(0, 12),
      testsRan: r.testsRan,
      runnerNote: r.runnerNote,
      summary: r.summary,
      unmapped: r.unmapped.length,
      cells: Object.fromEntries(
        r.functions.map((f) => [
          f.id,
          {
            s: f.status,
            w: f.issues.some((i) => i.severity === "warning") ? 1 : 0,
            sym: f.symbol,
            loc: f.location ? `${f.location.file}:${f.location.line}` : undefined,
            issues: f.issues.filter((i) => i.severity !== "info").map((i) => `${i.severity}: ${i.message}`),
            tests: f.tests.filter((t) => t.status !== "pass").map((t) => `${t.status}: ${t.id} ${t.message ?? ""}`),
            passed: f.tests.filter((t) => t.status === "pass").length,
            sugg: f.suggestions.map((s) => s.symbol),
            waiver: f.waiver
          }
        ])
      )
    }))
  };
}

export function writeDashboard(contract: Contract, reports: LibReport[], file: string): void {
  const data = JSON.stringify(dashboardData(contract, reports)).replaceAll("<", "\\u003c");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, TEMPLATE.replace("__DATA__", data));
}

const TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>brazilian-utils Conformance</title>
<style>
  :root {
    --bg: #f7f7f5; --panel: #ffffff; --ink: #1c1d21; --muted: #6a6d75; --line: #e3e3de;
    --ok: #1f8a5b; --ok-bg: #e3f4ec; --warn: #a15c00; --warn-bg: #fdf0da;
    --bad: #b42318; --bad-bg: #fde7e5; --miss: #8a8f98; --miss-bg: #f0f0ee; --accent: #3a5bd9;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #141518; --panel: #1c1e22; --ink: #e8e8ea; --muted: #9a9ca3; --line: #2c2e33;
      --ok: #4cc38a; --ok-bg: #173226; --warn: #f0b35a; --warn-bg: #3a2c14;
      --bad: #ff7b72; --bad-bg: #3d1b19; --miss: #8a8f98; --miss-bg: #24262b; --accent: #8ea4ff;
    }
  }
  :root[data-theme="dark"] {
    --bg: #141518; --panel: #1c1e22; --ink: #e8e8ea; --muted: #9a9ca3; --line: #2c2e33;
    --ok: #4cc38a; --ok-bg: #173226; --warn: #f0b35a; --warn-bg: #3a2c14;
    --bad: #ff7b72; --bad-bg: #3d1b19; --miss: #8a8f98; --miss-bg: #24262b; --accent: #8ea4ff;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width: 1400px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: var(--muted); font-size: 12px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; margin: 18px 0; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
  .card h3 { margin: 0 0 2px; font-size: 13px; word-break: break-all; }
  .card .lang { color: var(--muted); font-size: 12px; }
  .card .big { font-size: 26px; font-weight: 650; font-variant-numeric: tabular-nums; margin-top: 6px; }
  .bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: var(--miss-bg); margin: 8px 0 6px; }
  .bar i { display: block; }
  .card .nums { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .controls input, .controls select { background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font: inherit; }
  .controls input { flex: 1 1 220px; }
  .legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--muted); margin-bottom: 10px; }
  .legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; background: var(--c); }
  .table-wrap { overflow: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; max-height: 75vh; }
  table { border-collapse: separate; border-spacing: 0; width: 100%; }
  th, td { border-bottom: 1px solid var(--line); padding: 5px 8px; white-space: nowrap; }
  thead th { position: sticky; top: 0; background: var(--panel); z-index: 2; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); text-align: center; }
  th.fn, td.fn { position: sticky; left: 0; background: var(--panel); z-index: 1; text-align: left; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  thead th.fn { z-index: 3; }
  td.fn .lvl { font-family: system-ui, sans-serif; font-size: 10px; color: var(--accent); margin-left: 6px; }
  td.cell { text-align: center; cursor: pointer; }
  .pill { display: inline-block; min-width: 54px; border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: 600; }
  .ok { color: var(--ok); background: var(--ok-bg); } .warn { color: var(--warn); background: var(--warn-bg); }
  .bad { color: var(--bad); background: var(--bad-bg); } .miss { color: var(--miss); background: var(--miss-bg); }
  tr.sel td { outline: 1px solid var(--accent); outline-offset: -1px; }
  #detail { position: fixed; right: 16px; bottom: 16px; width: min(520px, calc(100vw - 32px)); max-height: 60vh; overflow: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; box-shadow: 0 10px 30px rgba(0,0,0,.18); display: none; }
  #detail h4 { margin: 0 0 6px; font-family: ui-monospace, monospace; font-size: 13px; }
  #detail ul { margin: 6px 0; padding-left: 18px; } #detail li { margin: 2px 0; font-size: 12px; }
  #detail code { font-size: 12px; } #detail .close { float: right; cursor: pointer; border: 0; background: none; color: var(--muted); font-size: 18px; }
  .muted { color: var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <h1>brazilian-utils · API conformance</h1>
  <div class="sub" id="gen"></div>
  <div class="cards" id="cards"></div>
  <div class="controls">
    <input id="q" placeholder="Filter functions (e.g. cpf, isValid)…" />
    <select id="level"><option value="">All levels</option><option value="core">Core</option><option value="extended">Extended</option></select>
    <select id="status">
      <option value="">All rows</option>
      <option value="gap">Rows with any gap</option>
      <option value="missing">Missing somewhere</option>
      <option value="problem">Signature/test problems</option>
      <option value="full">Implemented everywhere</option>
    </select>
  </div>
  <div class="legend">
    <span style="--c: var(--ok)">ok</span><span style="--c: var(--warn)">ok with warnings</span>
    <span style="--c: var(--warn)">signature mismatch</span><span style="--c: var(--bad)">tests failing</span>
    <span style="--c: var(--miss)">missing / waived</span>
  </div>
  <div class="table-wrap"><table id="t"><thead></thead><tbody></tbody></table></div>
</div>
<div id="detail"></div>
<script>
const D = __DATA__;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
$("#gen").textContent = "Generated " + new Date(D.generatedAt).toLocaleString() + " · " + D.functions.length + " contract functions · " + D.libs.length + " libraries";
const LABEL = { ok: ["ok", "ok"], signature: ["signature", "warn"], failing: ["failing", "bad"], missing: ["missing", "miss"], waived: ["waived", "miss"] };
$("#cards").innerHTML = D.libs.map((l) => {
  const s = l.summary, t = s.total || 1;
  const seg = (n, v) => '<i style="width:' + (n / t * 100) + '%;background:var(' + v + ')"></i>';
  return '<div class="card"><h3>' + esc(l.name.replace("brazilian-utils-", "")) + '</h3><div class="lang">' + esc(l.language) + (l.revision ? " · " + esc(l.revision.slice(0, 7)) : "") +
    '</div><div class="big">' + s.coverage + '%</div><div class="bar">' + seg(s.ok, "--ok") + seg(s.signature, "--warn") + seg(s.failing, "--bad") + '</div><div class="nums">' +
    s.ok + " ok · " + s.signature + " sig · " + s.failing + " failing · " + s.missing + " missing<br>core " + s.coreCoverage + "% · " +
    (l.testsRan ? "tests " + s.testsPassed + "✓ " + s.testsFailed + "✗ " + s.testsSkipped + " skipped" : "tests not run") + "</div></div>";
}).join("");
$("#t thead").innerHTML = "<tr><th class='fn'>Function</th>" + D.libs.map((l) => "<th>" + esc(l.name.replace("brazilian-utils-", "")) + "</th>").join("") + "</tr>";
function pill(c) {
  if (!c) return "";
  let [label, cls] = LABEL[c.s];
  if (c.s === "ok" && c.w) cls = "warn";
  if (c.s === "ok" && c.passed) label = "ok ✓" + c.passed;
  return '<span class="pill ' + cls + '">' + label + "</span>";
}
$("#t tbody").innerHTML = D.functions.map((f, i) => "<tr data-i='" + i + "'><td class='fn' title='" + esc(f.sig) + "'>" + esc(f.id) + (f.level === "core" ? "<span class='lvl'>core</span>" : "") +
  "</td>" + D.libs.map((l, j) => "<td class='cell' data-j='" + j + "'>" + pill(l.cells[f.id]) + "</td>").join("") + "</tr>").join("");
function rowKind(f) {
  const st = D.libs.map((l) => l.cells[f.id]?.s);
  return { missing: st.includes("missing"), problem: st.includes("signature") || st.includes("failing"), full: st.every((s) => s === "ok" || s === "waived") };
}
function apply() {
  const q = $("#q").value.trim().toLowerCase(), lvl = $("#level").value, st = $("#status").value;
  document.querySelectorAll("#t tbody tr").forEach((tr) => {
    const f = D.functions[tr.dataset.i], k = rowKind(f);
    const show = (!q || f.id.toLowerCase().includes(q)) && (!lvl || f.level === lvl) &&
      (!st || (st === "gap" && !k.full) || (st === "missing" && k.missing) || (st === "problem" && k.problem) || (st === "full" && k.full));
    tr.style.display = show ? "" : "none";
  });
}
["#q", "#level", "#status"].forEach((s) => $(s).addEventListener("input", apply));
$("#t tbody").addEventListener("click", (e) => {
  const td = e.target.closest("td.cell"); if (!td) return;
  const tr = td.parentElement, f = D.functions[tr.dataset.i], l = D.libs[td.dataset.j], c = l.cells[f.id];
  document.querySelectorAll("tr.sel").forEach((x) => x.classList.remove("sel")); tr.classList.add("sel");
  const list = (title, items) => items && items.length ? "<div class='muted'>" + title + "</div><ul>" + items.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "";
  $("#detail").innerHTML = "<button class='close' aria-label='Close'>×</button><h4>" + esc(f.id) + " · " + esc(l.name.replace("brazilian-utils-", "")) + "</h4>" +
    "<div><code>" + esc(f.sig) + "</code></div><p>" + pill(c) + (c.sym ? " → <code>" + esc(c.sym) + "</code>" : "") + (c.loc ? " <span class='muted'>" + esc(c.loc) + "</span>" : "") + "</p>" +
    (c.waiver ? "<p class='muted'>Waived: " + esc(c.waiver) + "</p>" : "") + list("Issues", c.issues) + list("Tests (non-passing)", c.tests) + list("Similar symbols", c.sugg) +
    (f.tests ? "" : "<p class='muted'>No conformance tests in the contract for this function yet.</p>");
  $("#detail").style.display = "block";
});
$("#detail").addEventListener("click", (e) => { if (e.target.classList.contains("close")) $("#detail").style.display = "none"; });
</script>
</body>
</html>
`;
