#!/usr/bin/env node
/**
 * Design check of the built site (out/): the Impeccable detector (impeccable.style), which flags
 * the patterns of generated interfaces (nested cards, side-stripe callouts, hero metrics, eyebrow
 * labels, gradient text…) and design-quality problems (line length, cramped padding, overflow),
 * on every page type, on a desktop and a phone. Exits 1 on any finding.
 *
 * Project exceptions live in .impeccable/config.json, each with its reason in DESIGN.md.
 * Needs a Chrome or Chromium (CHROME_PATH to pick one). Run after `npm run build`.
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const PORT = 4398;
const BASE = new URL(process.env.SITE_URL || 'https://brazilian-utils.github.io/docs').pathname.replace(/\/$/, '');
const PAGES = [
  '/', '/pt-br/', '/getting-started/', '/utils/cpf/', '/utils/license-plate/', '/pt-br/utils/cnpj/',
  '/libs/javascript/', '/libs/go/', '/reference/parity/', '/contributing/specs/', '/contributing/usage-files/', '/about/faq/', '/about/team/', '/does-not-exist/',
];
for (const guide of fs.existsSync('out/guides') ? fs.readdirSync('out/guides') : []) {
  for (const slug of fs.readdirSync(`out/guides/${guide}`).filter((f) => !f.includes('.'))) PAGES.push(`/guides/${guide}/${slug}/`);
}
const VIEWPORTS = ['1280x800', '390x844'];

const server = spawn(process.execPath, [path.join('scripts', 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 800));
let failed = 0;
try {
  for (const viewport of VIEWPORTS) {
    for (const page of PAGES) {
      const url = `http://127.0.0.1:${PORT}${BASE}${page}`;
      const detect = () => spawnSync(path.join('node_modules', '.bin', 'impeccable'), ['detect', '--viewport', viewport, url], { encoding: 'utf8' });
      let run = detect();
      // A browser that did not start (a cold CI runner) is not a finding: try it once more.
      if (run.status === 1 && /Failed to launch|WS endpoint/.test(run.stderr)) run = detect();
      const findings = (run.stderr + run.stdout).split('\n').filter((line) => /^\s+\[/.test(line)).map((line) => line.trim());
      if (run.status === 1) {
        console.log(`error ${viewport.padEnd(9)} ${page}\n${run.stderr}`);
        failed++;
      } else if (findings.length) {
        console.log(`fail  ${viewport.padEnd(9)} ${page}\n  ${findings.join('\n  ')}`);
        failed++;
      } else console.log(`ok    ${viewport.padEnd(9)} ${page}`);
    }
  }
} finally {
  server.kill();
}
console.log(`\n${PAGES.length} pages × ${VIEWPORTS.length} viewports: ${failed} with findings`);
process.exitCode = failed ? 1 : 0;
