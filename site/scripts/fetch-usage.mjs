#!/usr/bin/env node
/**
 * Downloads the usage files of every library listed in libs.yaml and splits them into
 * one Markdown file per (lib, util, operation) under .cache/usage/.
 *
 * Source of each library's usage: `<repo>/<path>/<util>.md` at `ref`
 * ("latest-release" resolves the newest GitHub release; falls back to the default branch).
 *
 * When a repository has no usage files yet, the local `fixtures/usage/<lib>/` folder is used
 * instead, with a warning. The fixtures exist only so the site can be built before every
 * library adopts the contract; they are not documentation of record.
 *
 * Env:
 *   GITHUB_TOKEN   optional, raises the API rate limit
 *   USAGE_SOURCE   "fixtures" builds from fixtures/usage/ only (no network)
 *
 * Output:
 *   .cache/usage/<lib>/<util>/<op>[.pt-BR].md   frontmatter: lib, util, op, locale, since, source
 *   .cache/usage/manifest.json                   what was fetched from where
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR, FIXTURES_DIR, loadLibs, loadSpecs } from '../src/lib/registry.mjs';

const OFFLINE = process.env.USAGE_SOURCE === 'fixtures';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const API = 'https://api.github.com';
const headers = {
  'User-Agent': 'brazilian-utils-docs',
  Accept: 'application/vnd.github+json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

const specs = loadSpecs();
const specById = new Map(specs.map((s) => [s.id, s]));
const libs = loadLibs();

const manifest = { fetchedAt: new Date().toISOString(), libs: {} };
const warnings = [];

await fs.rm(CACHE_DIR, { recursive: true, force: true });
await fs.mkdir(CACHE_DIR, { recursive: true });

for (const lib of libs) {
  const result = { source: null, ref: null, utils: {} };
  let files = null;

  if (!OFFLINE) {
    try {
      const ref = await resolveRef(lib);
      files = await fetchRemote(lib, ref);
      if (files.length > 0) {
        result.source = 'github';
        result.ref = ref;
      }
    } catch (error) {
      warnings.push(`${lib.id}: could not fetch from GitHub (${error.message})`);
    }
  }

  if (!files || files.length === 0) {
    const local = await readFixtures(lib);
    if (local.length > 0) {
      files = local;
      result.source = 'fixtures';
      warnings.push(`${lib.id}: no usage files in ${lib.repo}/${lib.path}; using fixtures/usage/${lib.id}/`);
    }
  }

  for (const file of files ?? []) {
    const parsed = parseUsageFile(file.name, file.content);
    if (!parsed) continue;
    const { util, locale, since, sections } = parsed;
    const spec = specById.get(util);
    if (!spec) {
      warnings.push(`${lib.id}/${file.name}: no spec named "${util}" (specs/${util}/meta.yaml missing); skipped`);
      continue;
    }
    const known = new Set(spec.operations.map((op) => op.id));
    const written = [];
    for (const section of sections) {
      if (!known.has(section.op)) {
        warnings.push(`${lib.id}/${file.name}: unknown operation "## ${section.op}" (known: ${[...known].join(', ')}); skipped`);
        continue;
      }
      const target = path.join(CACHE_DIR, lib.id, util, `${section.op}${locale === 'pt-BR' ? '.pt-BR' : ''}.md`);
      await fs.mkdir(path.dirname(target), { recursive: true });
      const frontmatter = [
        '---',
        `lib: ${lib.id}`,
        `util: ${util}`,
        `op: ${section.op}`,
        `locale: ${locale}`,
        since ? `since: "${since}"` : null,
        file.url ? `source: ${file.url}` : null,
        '---',
      ]
        .filter(Boolean)
        .join('\n');
      await fs.writeFile(target, `${frontmatter}\n\n${section.body.trim()}\n`, 'utf8');
      written.push(section.op);
    }
    result.utils[util] = result.utils[util] ?? {};
    result.utils[util][locale] = written;
  }

  manifest.libs[lib.id] = result;
}

await fs.writeFile(path.join(CACHE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

// Summary
for (const lib of libs) {
  const r = manifest.libs[lib.id];
  const utils = Object.keys(r.utils);
  const where = r.source ? `${r.source}${r.ref ? `@${r.ref}` : ''}` : 'nothing';
  console.log(`usage  ${lib.id.padEnd(11)} ${where.padEnd(22)} ${utils.length} util(s)${utils.length ? ': ' + utils.join(', ') : ''}`);
}
for (const w of warnings) console.warn(`warn   ${w}`);

// ---------------------------------------------------------------------------

async function gh(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function resolveRef(lib) {
  if (lib.ref !== 'latest-release') return lib.ref;
  try {
    const release = await gh(`${API}/repos/${lib.repo}/releases/latest`);
    if (release?.tag_name) return release.tag_name;
  } catch {
    /* no releases yet */
  }
  const repo = await gh(`${API}/repos/${lib.repo}`);
  return repo.default_branch || 'main';
}

async function fetchRemote(lib, ref) {
  let listing;
  try {
    listing = await gh(`${API}/repos/${lib.repo}/contents/${lib.path}?ref=${encodeURIComponent(ref)}`);
  } catch (error) {
    if (String(error.message).startsWith('404')) return [];
    throw error;
  }
  if (!Array.isArray(listing)) return [];
  const files = [];
  for (const item of listing) {
    if (item.type !== 'file' || !item.name.endsWith('.md')) continue;
    const res = await fetch(item.download_url, { headers });
    if (!res.ok) throw new Error(`${res.status} downloading ${item.path}`);
    files.push({ name: item.name, content: await res.text(), url: item.html_url });
  }
  return files;
}

async function readFixtures(lib) {
  const dir = path.join(FIXTURES_DIR, lib.id);
  try {
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.md'));
    return Promise.all(
      names.map(async (name) => ({
        name,
        content: await fs.readFile(path.join(dir, name), 'utf8'),
        url: null,
      })),
    );
  } catch {
    return [];
  }
}

/**
 * `cpf.md` → util "cpf", locale en. `cpf.pt-br.md` → util "cpf", locale pt-BR.
 * Sections are `## <operation-id>` headings; text before the first heading is ignored.
 */
function parseUsageFile(name, content) {
  const match = /^(.+?)(?:\.(pt-br))?\.md$/i.exec(name);
  if (!match) return null;
  const util = match[1].toLowerCase();
  const locale = match[2] ? 'pt-BR' : 'en';

  let body = content;
  let since;
  const fm = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(content);
  if (fm) {
    body = content.slice(fm[0].length);
    const sinceLine = /^since:\s*["']?([^"'\n]+)["']?\s*$/m.exec(fm[1]);
    if (sinceLine) since = sinceLine[1].trim();
  }

  const sections = [];
  const re = /^##\s+(.+?)\s*$/gm;
  let m;
  const marks = [];
  while ((m = re.exec(body))) marks.push({ op: m[1].trim().toLowerCase(), start: m.index, end: m.index + m[0].length });
  for (let i = 0; i < marks.length; i++) {
    const next = marks[i + 1];
    sections.push({ op: marks[i].op, body: body.slice(marks[i].end, next ? next.start : undefined) });
  }
  return { util, locale, since, sections };
}
