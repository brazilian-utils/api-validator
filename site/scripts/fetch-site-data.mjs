/**
 * Runs before fetch-libs.mjs, which needs the status (reference pages, guide functions). Builds
 * that did not run the validator (Vercel review deployments, a fresh clone) take the
 * status of the last run from the published site: /status.json and the badges. The GitHub
 * Actions pipeline runs the validator and writes these files itself (`docs site-data`),
 * so this step does nothing there.
 *
 *   SITE_DATA_URL   where to read from (default: SITE_URL, else the GitHub Pages site)
 *   SITE_DATA=skip  never download (the pages show no status)
 *
 * Nothing here fails the build: without the data, the site builds without the status.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadLibs } from '../src/lib/registry.mjs';

const STATUS = path.join('.generated', 'status.json');
const BADGES = path.join('public', 'badges');
const from = (process.env.SITE_DATA_URL || process.env.SITE_URL || 'https://brazilian-utils.github.io/docs').replace(/\/$/, '');

if (process.env.SITE_DATA === 'skip' || process.env.USAGE_SOURCE === 'fixtures') process.exit(0);
// A validator run wrote the file (no `fetchedFrom`): keep it. A copy fetched earlier is refreshed.
// A file that does not parse (a cut download) counts as absent.
let existing = null;
try {
  existing = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
} catch {}
if (existing && !existing.fetchedFrom) {
  console.log(`status ${STATUS} written by a validator run; nothing to fetch`);
  process.exit(0);
}

const get = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
};

try {
  const status = await (await get(`${from}/status.json`)).json();
  // A site built without a validator run publishes `{ libs: {} }`: that is no status at all.
  if (typeof status !== 'object' || !status?.libs || !Object.keys(status.libs).length) throw new Error('no status in it');
  fs.mkdirSync(path.dirname(STATUS), { recursive: true });
  fs.writeFileSync(STATUS, JSON.stringify({ ...status, fetchedFrom: `${from}/status.json` }));
  fs.mkdirSync(BADGES, { recursive: true });
  let badges = 0;
  for (const lib of loadLibs()) {
    for (const ext of ['svg', 'json']) {
      try {
        const body = await (await get(`${from}/badges/${lib.id}.${ext}`)).text();
        if (ext === 'svg' ? body.trimStart().startsWith('<svg') : JSON.parse(body)) {
          fs.writeFileSync(path.join(BADGES, `${lib.id}.${ext}`), body);
          badges++;
        }
      } catch {
        /* a lib without a badge yet */
      }
    }
  }
  console.log(`status from ${from}: ${Object.keys(status.libs).length} libs, ${badges} badge files`);
} catch (error) {
  console.warn(`warn   no status from ${from}/status.json (${error.message}); the pages show no status`);
}
