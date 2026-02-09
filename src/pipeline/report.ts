import fs from "node:fs";
import { ensureDir } from "../utils/fs.js";
import { DASHBOARD_HTML_PATH, OUTPUT_DIR } from "../utils/paths.js";
import type { ComparatorOutput } from "../types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function writeHtmlReport(result: ComparatorOutput): string {
  ensureDir(OUTPUT_DIR);
  const legacyMarkdownPath = `${OUTPUT_DIR}/matrix.md`;
  if (fs.existsSync(legacyMarkdownPath)) {
    fs.unlinkSync(legacyMarkdownPath);
  }

  const libNames = Array.from(
    new Set(result.matrix.flatMap((row) => Object.keys(row.implementations)))
  ).sort();

  const countsByLib = Object.fromEntries(
    libNames.map((lib) => [lib, { pass: 0, mismatch: 0, missing: 0 }])
  ) as Record<string, { pass: number; mismatch: number; missing: number }>;

  for (const row of result.matrix) {
    for (const lib of libNames) {
      const cell = row.implementations[lib];
      if (!cell || !cell.exists) {
        countsByLib[lib].missing += 1;
      } else if (!cell.signatureMatch) {
        countsByLib[lib].mismatch += 1;
      } else {
        countsByLib[lib].pass += 1;
      }
    }
  }

  const tableHeader = [
    "<th class=\"sticky\">Function</th>",
    ...libNames.map((lib) => `<th>${escapeHtml(lib)}</th>`)
  ].join("");

  const rows = result.matrix
    .map((row) => {
      const fn = `${row.domain}.${row.function}`;
      const cells = libNames
        .map((lib) => {
          const cell = row.implementations[lib];
          if (!cell || !cell.exists) {
            return '<td data-status="missing"><span class="badge bad">Missing</span></td>';
          }
          if (!cell.signatureMatch) {
            const note = escapeHtml((cell.notes ?? ["Signature mismatch"]).join("; "));
            return `<td data-status="mismatch" title="${note}"><span class="badge warn">Mismatch</span></td>`;
          }
          return '<td data-status="pass"><span class="badge ok">Match</span></td>';
        })
        .join("");
      return `<tr data-fn="${escapeHtml(fn.toLowerCase())}"><td class=\"fn\">${escapeHtml(fn)}</td>${cells}</tr>`;
    })
    .join("\n");

  const libCards = libNames
    .map((lib) => {
      const c = countsByLib[lib];
      return `
        <article class="lib-card">
          <h3>${escapeHtml(lib)}</h3>
          <p><strong>${c.pass}</strong> match</p>
          <p><strong>${c.mismatch}</strong> mismatch</p>
          <p><strong>${c.missing}</strong> missing</p>
        </article>
      `;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Validator Dashboard</title>
    <style>
      :root {
        --bg: #f8f6f0;
        --paper: #fffefb;
        --ink: #1f2937;
        --muted: #6b7280;
        --line: #d8d3c8;
        --ok: #0f766e;
        --warn: #b45309;
        --bad: #b91c1c;
        --accent1: #f5d0a9;
        --accent2: #b7d8c5;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(1200px 500px at 20% -10%, var(--accent1), transparent 60%),
          radial-gradient(1000px 500px at 90% -20%, var(--accent2), transparent 55%),
          var(--bg);
      }
      .wrap { max-width: 1240px; margin: 0 auto; padding: 28px 18px 40px; }
      header { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 20px; }
      h1 { margin: 0; font-size: clamp(1.5rem, 3vw, 2.3rem); }
      .sub { color: var(--muted); font-family: "Menlo", "Consolas", "Liberation Mono", monospace; font-size: 0.86rem; }
      .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
      .card { background: var(--paper); border: 1px solid var(--line); border-radius: 14px; padding: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
      .card h2 { margin: 0 0 6px; font-size: 0.85rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
      .card .num { font-size: 1.8rem; font-weight: 700; }
      .controls { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
      .controls input, .controls select {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px 12px;
        font: inherit;
      }
      .libs { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin-bottom: 16px; }
      .lib-card { background: var(--paper); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
      .lib-card h3 { margin: 0 0 8px; font-size: 0.95rem; }
      .lib-card p { margin: 2px 0; font-family: "Menlo", "Consolas", "Liberation Mono", monospace; font-size: 0.82rem; color: var(--muted); }
      .table-wrap { overflow: auto; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); }
      table { width: 100%; border-collapse: collapse; min-width: 800px; }
      th, td { padding: 9px 10px; border-bottom: 1px solid #ece7dc; text-align: center; }
      th { position: sticky; top: 0; background: #fcfaf5; z-index: 1; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
      th.sticky, td.fn { text-align: left; position: sticky; left: 0; z-index: 2; background: inherit; }
      td.fn { font-family: "Menlo", "Consolas", "Liberation Mono", monospace; font-size: 0.82rem; white-space: nowrap; }
      .badge { border-radius: 999px; padding: 3px 8px; font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
      .ok { background: rgba(15,118,110,0.12); color: var(--ok); }
      .warn { background: rgba(180,83,9,0.12); color: var(--warn); }
      .bad { background: rgba(185,28,28,0.12); color: var(--bad); }
      .hidden { display: none; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div>
          <h1>API Validator Dashboard</h1>
          <p class="sub">Generated at ${escapeHtml(new Date().toISOString())}</p>
        </div>
      </header>

      <section class="summary">
        <article class="card"><h2>Functions</h2><p class="num">${result.matrix.length}</p></article>
        <article class="card"><h2>Missing</h2><p class="num">${result.summary.missingCount}</p></article>
        <article class="card"><h2>Mismatches</h2><p class="num">${result.summary.signatureMismatchCount}</p></article>
        <article class="card"><h2>Invalid Mappings</h2><p class="num">${result.summary.invalidMappingCount}</p></article>
      </section>

      <section class="controls">
        <input id="search" placeholder="Filter by function name..." />
        <select id="status">
          <option value="all">All rows</option>
          <option value="missing">Has missing</option>
          <option value="mismatch">Has mismatch</option>
          <option value="pass">All matched</option>
        </select>
      </section>

      <section class="libs">${libCards}</section>

      <section class="table-wrap">
        <table id="matrix">
          <thead><tr>${tableHeader}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    </div>

    <script>
      const search = document.getElementById('search');
      const status = document.getElementById('status');
      const rows = Array.from(document.querySelectorAll('#matrix tbody tr'));

      function rowState(row) {
        const cells = Array.from(row.querySelectorAll('td[data-status]')).map(td => td.dataset.status);
        const hasMissing = cells.includes('missing');
        const hasMismatch = cells.includes('mismatch');
        if (hasMissing) return 'missing';
        if (hasMismatch) return 'mismatch';
        return 'pass';
      }

      function applyFilters() {
        const q = search.value.trim().toLowerCase();
        const s = status.value;

        for (const row of rows) {
          const name = row.dataset.fn || '';
          const state = rowState(row);
          const matchName = !q || name.includes(q);
          const matchState = s === 'all' || s === state;
          row.classList.toggle('hidden', !(matchName && matchState));
        }
      }

      search.addEventListener('input', applyFilters);
      status.addEventListener('change', applyFilters);
      applyFilters();
    </script>
  </body>
</html>`;

  fs.writeFileSync(DASHBOARD_HTML_PATH, `${html}\n`, "utf8");
  return html;
}
