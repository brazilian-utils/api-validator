#!/usr/bin/env node
/**
 * Reads what every library in ../libs/*.json publishes about how to use it, at the ref the site
 * shows (its latest GitHub release by default), and prepares it for the pages:
 *
 *   usage      `<site.usage.path>/<util>.md`: one `## <operation id>` section per contract
 *              function (see content/docs/contributing/usage-files.mdx)
 *   reference  `<site.usage.reference>`: one page whose `##`/`###` headings are the library's own
 *              symbol names (`### isValidCpf`), mapped to contract functions with the validator's
 *              bindings (.generated/status.json). Fills what the usage files do not cover.
 *   guides     `<site.usage.guides>/*.md`: longer pages (a form field, an address form…) whose
 *              examples come in framework / variant / file tabs with an optional live demo:
 *
 *                <div class="example" data-name="React" data-demo="/snippets/live/?…">
 *                  <div class="variant" data-variant="CPF" data-demo="…">      (optional level)
 *                    <div class="file" data-file="cpf-field.tsx">
 *                      [cpf-field.tsx](../snippets/…/cpf-field.tsx ':include :type=code tsx')
 *                    </div>
 *                  </div>
 *                </div>
 *
 *              (the markup docsify renders too, so the same files serve a library's own site).
 *   assets     folders the demos load, copied to public/lib-assets/<lib>/ as they are.
 *   prepare    a command run in the checkout first (argv, no shell, no secrets in its env),
 *              e.g. the JavaScript library generating its examples from templates.
 *
 * Where a library is read from: USAGE_SOURCE=fixtures → only fixtures/usage/<lib>/ (offline);
 * USAGE_SOURCE=local → ../.repos/<lib> (the checkouts api-validator ran on); otherwise a shallow
 * clone at the ref, falling back to the local checkout, then to the fixtures.
 *
 * Output:
 *   .cache/usage/<lib>/<util>/<op>[.pt-BR].md    one usage tab (frontmatter: lib, util, op, locale, source)
 *   .cache/usage/manifest.json                   what came from where, and each library's API intro
 *   .cache/guides/<lib>/<slug>.<locale>.json     one guide, parsed, with its files inlined
 *   .cache/guides/manifest.json                  every guide: title, description, contract functions it uses
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CACHE_DIR, FIXTURES_DIR, GUIDES_DIR, LANGS, LIB_ASSETS_DIR, LOCAL_REPOS, REPOS_CACHE, keyOf, loadLibs, loadOperation, loadSpecs, loadStatus, resolveOperation,
} from '../src/lib/registry.mjs';
import { absolutizeLinks, parseGuide, referenceAnchor, referenceFiles } from '../src/lib/guides.mjs';
import { parseUsageFileName, referenceSections, splitSections, stripFrontMatter, symbolMap } from '../src/lib/usage-format.mjs';

const MODE = process.env.USAGE_SOURCE ?? 'github';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const specs = loadSpecs();
const specByKey = new Map(specs.flatMap((s) => [[keyOf(s.id), s], [keyOf(s.domain), s]]));
const status = loadStatus();
const warnings = [];
const manifest = { fetchedAt: new Date().toISOString(), libs: {} };
const guides = [];

for (const dir of [CACHE_DIR, GUIDES_DIR, LIB_ASSETS_DIR]) fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(GUIDES_DIR, { recursive: true });

for (const lib of loadLibs()) {
  const src = await sourceOf(lib);
  const result = { source: src?.origin ?? null, ref: src?.ref ?? null, utils: {}, intro: {} };
  manifest.libs[lib.id] = result;
  if (src && lib.prepare && (lib.guides || lib.assets.length)) prepare(lib, src.dir);

  // Usage: usage files first, the reference page for what they leave out, else the fixtures.
  let sections = src ? usageFiles(lib, src) : [];
  if (src) {
    const have = new Set(sections.map((s) => `${s.spec.id}/${s.op}/${s.locale}`));
    sections.push(...referencePage(lib, src, result).filter((s) => !have.has(`${s.spec.id}/${s.op}/${s.locale}`)));
  }
  if (!sections.length) {
    sections = fixtureSections(lib);
    if (sections.length) {
      result.source = 'fixtures';
      result.ref = null;
      if (MODE !== 'fixtures') warnings.push(`${lib.id}: no usage files or reference page${src ? ` in ${lib.repo}@${src.ref}` : ''}; using fixtures/usage/${lib.id}/`);
    }
  }
  for (const s of sections) writeUsage(lib, s, result);

  if (src && lib.guides) readGuides(lib, src);
  if (src) copyAssets(lib, src.dir);
}

fs.writeFileSync(path.join(CACHE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(GUIDES_DIR, 'manifest.json'), JSON.stringify({ guides }, null, 2));

for (const [id, r] of Object.entries(manifest.libs)) {
  const where = r.source ? `${r.source}${r.ref ? `@${r.ref}` : ''}` : 'nothing';
  const g = guides.filter((x) => x.lib === id).length;
  console.log(`libs   ${id.padEnd(11)} ${where.padEnd(26)} ${Object.keys(r.utils).length} util(s)${g ? `, ${g} guide(s)` : ''}`);
}
for (const w of warnings) console.warn(`warn   ${w}`);

// ---------------------------------------------------------------------------
// Where a library's files come from

async function sourceOf(lib) {
  if (MODE === 'fixtures') return null;
  const local = path.join(LOCAL_REPOS, lib.name);
  const localSource = () => {
    if (!fs.existsSync(local)) return null;
    const head = gitHead(local);
    return { dir: local, ref: head ?? 'local', origin: 'local', url: blobBase(lib, head ?? 'main') };
  };
  if (MODE === 'local') return localSource();
  try {
    // Without the API (rate limit, no token: Vercel builds) the newest version tag stands in for
    // the latest release, and without tags the clone takes the default branch.
    const ref = await resolveRef(lib).catch((error) => {
      const tag = lib.ref === 'latest-release' ? newestTag(lib) : null;
      warnings.push(`${lib.id}: could not resolve ${lib.ref} (${error.message}); using ${tag ?? 'the default branch'}`);
      return tag;
    });
    const dir = path.join(REPOS_CACHE, lib.id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const args = ['clone', '--quiet', '--depth', '1', ...(ref ? ['--branch', ref] : []), `https://github.com/${lib.repo}.git`, dir];
    const clone = spawnSync('git', args, { stdio: ['ignore', 'ignore', 'pipe'], timeout: 180_000 });
    if (clone.status !== 0) throw new Error(`git clone failed: ${String(clone.stderr).trim().split('\n').pop()}`);
    const at = ref ?? gitHead(dir);
    return { dir, ref: at, origin: 'github', url: blobBase(lib, at) };
  } catch (error) {
    const fallback = localSource();
    warnings.push(`${lib.id}: could not clone ${lib.repo} (${error.message})${fallback ? '; using the local checkout' : ''}`);
    return fallback;
  }
}

async function resolveRef(lib) {
  if (lib.ref !== 'latest-release') return lib.ref;
  const headers = { 'User-Agent': 'brazilian-utils-docs', Accept: 'application/vnd.github+json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };
  const get = async (url) => {
    let res = await fetch(url, { headers });
    // A token without access to the org (401) should not stop public reads.
    if (res.status === 401 && headers.Authorization) res = await fetch(url, { headers: Object.fromEntries(Object.entries(headers).filter(([k]) => k !== "Authorization")) });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return res.json();
  };
  try {
    const release = await get(`https://api.github.com/repos/${lib.repo}/releases/latest`);
    if (release?.tag_name) return release.tag_name;
  } catch {
    /* no releases yet */
  }
  return (await get(`https://api.github.com/repos/${lib.repo}`)).default_branch || 'main';
}

/** The highest version tag of a repository (`v1.2.3`, `1.2.3`), read with git: no API, no token. */
function newestTag(lib) {
  const r = spawnSync('git', ['ls-remote', '--tags', '--refs', `https://github.com/${lib.repo}.git`], { encoding: 'utf8', timeout: 60_000 });
  if (r.status !== 0) return null;
  const versions = r.stdout
    .split('\n')
    .map((l) => l.split('refs/tags/')[1])
    .flatMap((tag) => {
      const m = tag?.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
      return m ? [{ tag, v: m.slice(1).map(Number) }] : [];
    });
  versions.sort((a, b) => b.v[0] - a.v[0] || b.v[1] - a.v[1] || b.v[2] - a.v[2]);
  return versions[0]?.tag ?? null;
}

function gitHead(dir) {
  const r = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function blobBase(lib, ref) {
  return `https://github.com/${lib.repo}/blob/${ref}/`;
}

/** The library's own build step, with a minimal environment: no tokens reach it. */
function prepare(lib, dir) {
  const [cmd, ...args] = lib.prepare;
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, CI: 'true' };
  const r = spawnSync(cmd, args, { cwd: dir, env, encoding: 'utf8', timeout: 300_000 });
  if (r.status !== 0) warnings.push(`${lib.id}: prepare (${lib.prepare.join(' ')}) failed: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' ')}`);
}

function copyAssets(lib, dir) {
  for (const rel of lib.assets) {
    const from = path.join(dir, rel);
    if (!fs.existsSync(from)) {
      warnings.push(`${lib.id}: asset folder ${rel} not found`);
      continue;
    }
    const to = path.join(LIB_ASSETS_DIR, lib.id, path.relative(path.join(dir, lib.root), from));
    fs.cpSync(from, to, { recursive: true, filter: (f) => !f.includes(`${path.sep}node_modules`) });
  }
  // A demo imports its host's stylesheet from the folder above (docsify's theme, in the lib's own
  // docs). Here the page around the frame styles the demo, so that file is only a placeholder.
  if (!lib.assets.length) return;
  fs.mkdirSync(path.join(LIB_ASSETS_DIR, lib.id), { recursive: true });
  fs.writeFileSync(path.join(LIB_ASSETS_DIR, lib.id, 'styles.css'), '/* The docs site styles the live demos (src/components/live-demo.client.tsx). */\n');
}

// ---------------------------------------------------------------------------
// Usage

function usageFiles(lib, src) {
  const dir = path.join(src.dir, lib.path);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    const file = path.join(dir, name);
    const sections = usageSections(lib, name, fs.readFileSync(file, 'utf8'), src.url + `${lib.path}/${name}`);
    out.push(...sections.map((s) => ({ ...s, body: siteLinks(lib, src, file, s.locale, s.body) })));
  }
  return out;
}

/** Relative links of a library's Markdown → GitHub (or the operation here, for reference anchors). */
function siteLinks(lib, src, fromFile, locale, md) {
  const ctx = { lib, src, locale, status, specs };
  return absolutizeLinks(md, {
    fromFile,
    srcDir: src.dir,
    srcUrl: src.url,
    docsRoot: path.join(src.dir, lib.root),
    reference: referenceFiles(ctx),
    anchor: referenceAnchor(ctx),
  });
}

function fixtureSections(lib) {
  const dir = path.join(FIXTURES_DIR, lib.id);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .flatMap((name) => usageSections(lib, name, fs.readFileSync(path.join(dir, name), 'utf8'), null));
}

/** `cpf.md` / `cpf.pt-br.md`: sections are `## <operation id>`; text before the first heading is ignored. */
function usageSections(lib, name, content, url) {
  const file = parseUsageFileName(name);
  const spec = file && specByKey.get(keyOf(file.stem));
  if (!spec) {
    if (file && !/^readme$/i.test(file.stem)) warnings.push(`${lib.id}/${name}: no contract domain named "${file.stem}"; skipped`);
    return [];
  }
  const { locale } = file;
  const fm = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(content);
  const since = fm && /^since:\s*["']?([^"'\n]+)["']?\s*$/m.exec(fm[1])?.[1].trim();
  const out = [];
  for (const s of splitSections(stripFrontMatter(content))) {
    const op = resolveOperation(spec, s.heading);
    if (!op) {
      warnings.push(`${lib.id}/${name}: unknown operation "## ${s.heading}" (known: ${spec.operations.map((o) => o.id).join(', ')}); skipped`);
      continue;
    }
    out.push({ spec, op, locale, since, body: s.body, source: url });
  }
  return out;
}

/** Headings that are the library's symbol names, mapped to contract functions by the last validator run. */
function referencePage(lib, src, result) {
  if (!lib.reference) return [];
  const fns = status?.libs?.[lib.id]?.functions;
  if (!fns) {
    warnings.push(`${lib.id}: reference page not read, no validator run to map its symbols (run api-validator site-data)`);
    return [];
  }
  const bySymbol = symbolMap(Object.entries(fns).filter(([fnId]) => loadOperation(fnId)).map(([fnId, f]) => [fnId, f.symbol]));
  const out = [];
  for (const locale of LANGS) {
    const rel = lib.reference[locale];
    const file = rel && path.join(src.dir, rel);
    if (!file || !fs.existsSync(file)) continue;
    const { sections, intro } = referenceSections(stripFrontMatter(fs.readFileSync(file, 'utf8')), bySymbol);
    for (const s of sections) {
      const { spec, op } = loadOperation(s.fnId);
      out.push({ spec, op: op.id, locale, body: siteLinks(lib, src, file, locale, s.body), source: `${src.url}${rel}#${s.symbol.toLowerCase()}` });
    }
    // Conventions every function follows go on the library's page.
    if (sections.length) result.intro[locale] = siteLinks(lib, src, file, locale, intro);
  }
  return out;
}

function writeUsage(lib, s, result) {
  const target = path.join(CACHE_DIR, lib.id, s.spec.id, `${s.op}${s.locale === 'pt-BR' ? '.pt-BR' : ''}.md`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const fm = ['---', `lib: ${lib.id}`, `util: ${s.spec.id}`, `op: ${s.op}`, `locale: ${s.locale}`, s.since && `since: "${s.since}"`, s.source && `source: ${JSON.stringify(s.source)}`, '---'];
  fs.writeFileSync(target, `${fm.filter(Boolean).join('\n')}\n\n${s.body.trim()}\n`);
  ((result.utils[s.spec.id] ??= {})[s.locale] ??= []).push(s.op);
}

// ---------------------------------------------------------------------------
// Guides

function readGuides(lib, src) {
  const found = new Map();
  for (const locale of LANGS) {
    const rel = lib.guides[locale];
    const dir = rel && path.join(src.dir, rel);
    if (!dir || !fs.existsSync(dir)) continue;
    const names = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && !n.startsWith('_') && !/^readme\.md$/i.test(n)).sort();
    for (const name of names) {
      const slug = name.replace(/\.md$/, '');
      const guide = parseGuide({ lib, src, file: path.join(dir, name), locale, siblings: names.map((n) => n.replace(/\.md$/, '')), status, specs, warn: (w) => warnings.push(w) });
      fs.mkdirSync(path.join(GUIDES_DIR, lib.id), { recursive: true });
      fs.writeFileSync(path.join(GUIDES_DIR, lib.id, `${slug}.${locale}.json`), JSON.stringify(guide));
      const entry = found.get(slug) ?? { lib: lib.id, slug, order: found.size, title: {}, description: {}, fns: [], source: guide.source };
      entry.title[locale] = guide.title;
      entry.description[locale] = guide.description;
      entry.fns = [...new Set([...entry.fns, ...guide.fns])].sort();
      found.set(slug, entry);
    }
  }
  guides.push(...found.values());
}
