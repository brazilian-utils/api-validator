#!/usr/bin/env node
/**
 * Accessibility check of the built site (dist/): axe-core with WCAG 2.0 and 2.1, levels A and AA,
 * plus axe's best practices, on a sample of every page type, in the light and the dark theme, with
 * every <details> open (test cases, try-it). Exits 1 when any rule fails.
 *
 * Needs `playwright` and `axe-core`, which are not dependencies of the site: CI installs them for
 * this step only (see .github/workflows/site-check.yml). Locally:
 *   npm i --no-save playwright axe-core && npx playwright install chromium
 *   npm run build && node scripts/a11y.mjs
 *
 * Env: BASE_PATH (the base the site was built with, default /), CHROMIUM (a browser executable).
 */
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const PORT = 4399;
const BASE = (process.env.BASE_PATH || '/').replace(/\/$/, '');
// One page of each type, in both languages; generated pages exist in every build.
const PAGES = [
  '/', '/getting-started/', '/utils/cpf/', '/utils/license-plate/', '/libs/javascript/', '/libs/go/',
  '/reference/parity/', '/contributing/usage-files/', '/pt-br/', '/pt-br/utils/cnpj/', '/pt-br/libs/python/',
];
for (const guide of fs.existsSync('dist/guides') ? fs.readdirSync('dist/guides') : []) {
  const first = fs.readdirSync(`dist/guides/${guide}`)[0];
  if (first) PAGES.push(`/guides/${guide}/${first}/`, `/pt-br/guides/${guide}/${first}/`);
}

// dist/ served as the host serves it: under BASE, index.html for folders. No preview daemon needed.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).slice(BASE.length) || '/';
  let file = path.join('dist', rel);
  if (!path.resolve(file).startsWith(path.resolve('dist'))) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404, { 'content-type': 'text/html' }).end(fs.readFileSync('dist/404.html'));
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const url = (p) => `http://127.0.0.1:${PORT}${BASE}${p}`;
try {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const failures = [];
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ colorScheme: theme });
    await context.route(/^https:\/\//, (route) => route.abort()); // CDN demos are out of scope
    await context.addInitScript((t) => localStorage.setItem('starlight-theme', t), theme);
    const page = await context.newPage();
    for (const p of PAGES) {
      await page.goto(url(p));
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      await page.waitForTimeout(1200); // Expressive Code marks scrollable code blocks after load
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] });
        return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
      });
      console.log(`${violations.length ? 'fail' : 'ok  '}  ${theme.padEnd(5)} ${p}`);
      for (const v of violations) failures.push({ theme, path: p, ...v });
    }
    await context.close();
  }
  await browser.close();
  for (const f of failures) console.log(`\n${f.id} (${f.impact}) on ${f.theme} ${f.path}: ${f.help}\n  ${f.targets.join('\n  ')}`);
  console.log(`\n${PAGES.length} pages × 2 themes: ${failures.length} rule violations`);
  process.exitCode = failures.length ? 1 : 0;
} finally {
  server.close();
}
