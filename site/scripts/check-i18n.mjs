#!/usr/bin/env node
/**
 * Reports what is missing or stale between the two languages.
 *
 *  - contract: every domain has its title and summary in both languages (the contract schema
 *              requires both), and every function its summary and description; a long-form spec, when a domain has one, must exist as both
 *              contract/<domain>/spec.en.md and spec.pt-BR.md, and warns if one was changed more
 *              than a day after the other.
 *  - pages:    every hand-written page in src/content/docs/ must have a pt-br/ twin.
 *
 * Exit code 1 with --strict when anything is missing (used in CI on pull requests).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CONTRACT_DIR, DOCS_DIR, LANGS, loadSpecs } from '../src/lib/registry.mjs';

const strict = process.argv.includes('--strict');
const problems = [];
const notes = [];

for (const spec of loadSpecs()) {
  // The raw file: loadSpecs fills a missing language in, so it would never look missing.
  const raw = JSON.parse(fs.readFileSync(path.join(CONTRACT_DIR, `${spec.domain}.json`), 'utf8'));
  for (const lang of LANGS) {
    if (typeof raw.title !== 'string' && !raw.title?.[lang]) problems.push(`contract/${spec.domain}.json: title.${lang} is missing`);
    if (!raw.summary?.[lang]) problems.push(`contract/${spec.domain}.json: summary.${lang} is missing`);
  }
  // Function prose: a plain string is English only; the site shows it on Portuguese pages too.
  for (const [op, fn] of Object.entries(raw.functions ?? {})) {
    for (const field of ['summary', 'description']) {
      const v = fn[field];
      if (v === undefined) continue;
      for (const lang of LANGS) {
        if (typeof v === 'object' && !Array.isArray(v) ? !v[lang] : lang !== 'en') problems.push(`contract/${spec.domain}.json: ${op}.${field}.${lang} is missing`);
      }
    }
  }
  const pt = path.join(CONTRACT_DIR, spec.domain, 'spec.pt-BR.md');
  const en = path.join(CONTRACT_DIR, spec.domain, 'spec.en.md');
  if (fs.existsSync(pt) !== fs.existsSync(en)) {
    problems.push(`contract/${spec.domain}/${fs.existsSync(pt) ? 'spec.en.md' : 'spec.pt-BR.md'} is missing (the other language exists)`);
  }
  if (fs.existsSync(pt) && fs.existsSync(en)) {
    const a = lastCommitDate(pt) ?? fs.statSync(pt).mtime;
    const b = lastCommitDate(en) ?? fs.statSync(en).mtime;
    const days = Math.abs(a - b) / 86_400_000;
    if (days > 1) notes.push(`contract/${spec.domain}: spec.pt-BR.md and spec.en.md last changed ${Math.round(days)} days apart; check they still match`);
  }
}

// pages (utils/, libs/ and guides/ are generated in both languages)
const skip = new Set(['utils', 'libs', 'guides']);
for (const file of walk(DOCS_DIR)) {
  const rel = path.relative(DOCS_DIR, file);
  const top = rel.split(path.sep)[0];
  if (top === 'pt-br' || skip.has(top)) continue;
  const twin = path.join(DOCS_DIR, 'pt-br', rel);
  if (!fs.existsSync(twin)) problems.push(`src/content/docs/pt-br/${rel.split(path.sep).join('/')} is missing`);
}

for (const p of problems) console.log(`missing  ${p}`);
for (const n of notes) console.log(`note     ${n}`);
if (problems.length === 0 && notes.length === 0) console.log('i18n     everything has a twin');
if (strict && problems.length > 0) process.exit(1);

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(md|mdx)$/.test(entry.name)) yield full;
  }
}

function lastCommitDate(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return out ? new Date(out) : null;
  } catch {
    return null;
  }
}
