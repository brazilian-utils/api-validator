#!/usr/bin/env node
/**
 * Accessibility check of the built site (out/): axe-core with WCAG 2.0 and 2.1, levels A and AA,
 * plus axe's best practices, on a sample of every page type, in the light and the dark theme, on
 * a desktop and a phone viewport, with every accordion open (test cases, try it). Exits 1 when any
 * rule fails.
 *
 * Needs `playwright` and `axe-core`, which are not dependencies of the site: CI installs them for
 * this step only (see .github/workflows/site-check.yml). Locally:
 *   npm i --no-save playwright axe-core && npx playwright install chromium
 *   npm run build && node scripts/a11y.mjs
 *
 * Env: SITE_URL or BASE_PATH (as for the build), CHROMIUM (a browser executable).
 */
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const PORT = 4399;
const OUT = 'out';
// The base path the site was built with (SITE_URL's path, as next.config.mjs reads it).
const BASE = (process.env.BASE_PATH ?? new URL(process.env.SITE_URL || 'https://brazilian-utils.github.io/api-validator').pathname).replace(/\/$/, '');
// One page of each type, in both languages; generated pages exist in every build.
const PAGES = [
  '/', '/getting-started/', '/utils/cpf/', '/utils/license-plate/', '/libs/javascript/', '/libs/go/',
  '/reference/parity/', '/contributing/usage-files/', '/about/team/', '/pt-br/about/faq/', '/pt-br/', '/pt-br/utils/cnpj/', '/pt-br/libs/python/', '/does-not-exist/',
];
for (const guide of fs.existsSync(`${OUT}/guides`) ? fs.readdirSync(`${OUT}/guides`) : []) {
  const first = fs.readdirSync(`${OUT}/guides/${guide}`).find((f) => !f.endsWith('.txt'));
  if (first) PAGES.push(`/guides/${guide}/${first}/`, `/pt-br/guides/${guide}/${first}/`);
}

// out/ served as the host serves it: under BASE, index.html for folders. No preview daemon needed.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).slice(BASE.length) || '/';
  let file = path.join(OUT, rel);
  if (!path.resolve(file).startsWith(path.resolve(OUT))) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404, { 'content-type': 'text/html' }).end(fs.readFileSync(`${OUT}/404.html`));
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const url = (p) => `http://127.0.0.1:${PORT}${BASE}${p}`;
try {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const failures = [];
  const VIEWS = [
    ['light', { width: 1280, height: 900 }],
    ['dark', { width: 1280, height: 900 }],
    ['light', { width: 390, height: 844 }],
  ];
  for (const [theme, viewport] of VIEWS) {
    const context = await browser.newContext({ colorScheme: theme, viewport });
    await context.route(/^https:\/\//, (route) => route.abort()); // CDN demos are out of scope
    await context.addInitScript((t) => localStorage.setItem('theme', t), theme);
    const page = await context.newPage();
    for (const p of PAGES) {
      await page.goto(url(p));
      await page.waitForTimeout(600);
      // Open every disclosure of the page (try it, test cases, local copies), as a reader would.
      await page.evaluate(() => document.querySelectorAll('article details').forEach((d) => (d.open = true)));
      for (const trigger of await page.$$('article button[aria-expanded="false"]')) await trigger.click().catch(() => {});
      await page.waitForTimeout(600);
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] });
        return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
      });
      const view = `${theme} ${viewport.width}`;
      console.log(`${violations.length ? 'fail' : 'ok  '}  ${view.padEnd(10)} ${p}`);
      for (const v of violations) failures.push({ theme: view, path: p, ...v });
    }
    await context.close();
  }
  await browser.close();
  for (const f of failures) console.log(`\n${f.id} (${f.impact}) on ${f.theme} ${f.path}: ${f.help}\n  ${f.targets.join('\n  ')}`);
  console.log(`\n${PAGES.length} pages × ${VIEWS.length} views: ${failures.length} rule violations`);
  process.exitCode = failures.length ? 1 : 0;
} finally {
  server.close();
}
