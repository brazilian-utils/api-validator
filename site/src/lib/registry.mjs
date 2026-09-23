// Single place that knows where the site's data comes from.
// Used by the pages (src/app), the build scripts (scripts/) and the validator's tests.
// Plain ESM (no TypeScript) so the scripts run without a build step.
//
// Everything is read from the api-validator repository this site lives in:
//   ../contract/<domain>/contract.json  the spec: functions, signatures, cases, summaries, labels
//   ../contract/<domain>/spec.*.md     optional long-form spec per language (spec.en.md, spec.pt-br.md),
//                                      references.md and references/*.pdf
//   (<domain> is the kebab-case domain id: licensePlate -> license-plate)
//   ../contract/_categories.json       sidebar groups
//   ../libs/<lib>.json                 the libraries ("site" block: tab label, install line, usage files)
//   .generated/status.json             written by `api-validator site-data` from the latest check run
//                                      (implemented / failing / missing per lib and function; optional)

import fs from 'node:fs';
import path from 'node:path';
import { isImplemented } from './text.mjs';
import { keyOf, operationLabel, opRank, resolveOperation as resolveIn, shortName, repoSlug, slugOf } from './usage-format.mjs';

export { keyOf, slugOf };

// The site root. Resolved from the working directory (not import.meta.url) because Next bundles
// this module at build time, where a relative path would point nowhere.
const ROOT = path.resolve(process.env.DOCS_ROOT || process.cwd());
const REPO_ROOT = path.resolve(process.env.API_VALIDATOR_ROOT || path.join(ROOT, '..'));
export const CONTRACT_DIR = path.join(REPO_ROOT, 'contract');
export const LIBS_DIR = path.join(REPO_ROOT, 'libs');
export const CACHE_DIR = path.join(ROOT, '.cache', 'usage');
export const GUIDES_DIR = path.join(ROOT, '.cache', 'guides');
export const REPOS_CACHE = path.join(ROOT, '.cache', 'repos');
export const LOCAL_REPOS = path.join(REPO_ROOT, '.repos');
/** Files the libraries' live demos load, served at <base>/lib-assets/<lib>/. */
export const LIB_ASSETS_DIR = path.join(ROOT, 'public', 'lib-assets');
export const FIXTURES_DIR = path.join(ROOT, 'fixtures', 'usage');
/** Hand-written pages: <page>.mdx in English, <page>.pt-br.mdx in Portuguese. */
export const DOCS_DIR = path.join(ROOT, 'content', 'docs');
const STATUS_FILE = path.join(ROOT, '.generated', 'status.json');

/** The api-validator repository (contract, validator, this site). */
export const REPO_URL = 'https://github.com/brazilian-utils/api-validator';

/** Site languages. `en` is the root locale, `pt-BR` lives under /pt-br/. */
export const LANGS = ['en', 'pt-BR'];

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const lines = (v) => (Array.isArray(v) ? v.join('\n') : v);
/** Contract prose, English only or `{ en, pt-BR }`, as `{ en, 'pt-BR'? }` of strings (undefined when absent). */
const translations = (v) => (v == null ? undefined : typeof v === 'object' && !Array.isArray(v) ? { en: lines(v.en), 'pt-BR': v['pt-BR'] == null ? undefined : lines(v['pt-BR']) } : { en: lines(v) });
/**
 * Compute once per process (every page of a build reads the same files).
 * @template T
 * @param {() => T} fn
 * @returns {() => T}
 */
const once = (fn) => {
  let done = false;
  let value;
  return () => {
    if (!done) [value, done] = [fn(), true];
    return value;
  };
};

/** Sidebar groups, in display order. */
export const CATEGORIES = readJson(path.join(CONTRACT_DIR, '_categories.json')).categories;

/** Resolve a usage-file heading to one of the domain's operation ids, or undefined. */
export function resolveOperation(spec, heading) {
  return resolveIn(spec.operations, heading);
}

/** A function the lib has and runs (it may still fail cases), from a status.json entry. */
export { isImplemented };

/**
 * Every contract domain, as a page: sorted by category order, then `order`, then title.
 * @type {() => Array<SpecMeta>}
 */
export const loadSpecs = once(() => {
  const dirs = fs
    .readdirSync(CONTRACT_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && fs.existsSync(path.join(CONTRACT_DIR, e.name, 'contract.json')));
  const specs = dirs.map((e) => normalize(readJson(path.join(CONTRACT_DIR, e.name, 'contract.json'))));
  const catIndex = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  return specs.sort((a, b) => {
    const ca = catIndex.get(a.category) ?? 99;
    const cb = catIndex.get(b.category) ?? 99;
    if (ca !== cb) return ca - cb;
    if ((a.order ?? 99) !== (b.order ?? 99)) return (a.order ?? 99) - (b.order ?? 99);
    return a.title.en.localeCompare(b.title.en);
  });
});

export function loadSpec(id) {
  return loadSpecs().find((s) => s.id === id || s.domain === id) ?? null;
}

const operationsById = once(() => new Map(loadSpecs().flatMap((spec) => spec.operations.map((op) => [op.fnId, { spec, op }]))));

/** A contract function id (`licensePlate.isValid`) → its page and operation, or null. */
export function loadOperation(fnId) {
  return operationsById().get(fnId) ?? null;
}

/** A domain's folder in the repository, relative to its root: `contract/license-plate`. */
export const contractPath = (spec) => `contract/${spec.id}`;

/** The long-form spec of a language: `spec.en.md`, `spec.pt-br.md` (file names are kebab-case). */
export const specName = (locale) => `spec.${locale.toLowerCase()}.md`;

function normalize(doc) {
  const domain = doc.domain;
  const title = typeof doc.title === 'string' ? { en: doc.title, 'pt-BR': doc.title } : doc.title ?? { en: domain, 'pt-BR': domain };
  const summary = doc.summary ?? { en: '', 'pt-BR': '' };
  const operations = Object.entries(doc.functions)
    .sort(([a], [b]) => opRank(a) - opRank(b) || a.localeCompare(b))
    .map(([op, fn]) => ({
      id: op,
      fnId: `${domain}.${op}`,
      label: operationLabel(op, fn.label),
      summary: translations(fn.summary),
      description: translations(fn.description),
      references: fn.references ?? [],
      level: fn.level ?? 'extended',
      network: Boolean(fn.network),
      deprecated: Boolean(fn.deprecated),
      params: fn.params ?? [],
      returns: fn.returns,
      tests: fn.tests ?? [],
    }));
  const dir = path.join(CONTRACT_DIR, slugOf(domain));
  return {
    id: slugOf(domain),
    domain,
    category: doc.category,
    order: doc.order,
    title,
    summary,
    related: (doc.related ?? []).map(slugOf),
    operations,
    hasSpec: { en: fs.existsSync(path.join(dir, specName('en'))), 'pt-BR': fs.existsSync(path.join(dir, specName('pt-BR'))) },
  };
}

/** @type {() => Array<{id:string,name:string,label:string,icon?:string,repo:string,ref:string,path:string,reference?:Record<string,string>,guides?:Record<string,string>,root:string,assets:string[],prepare?:string[],package:string,install:string,registry:string}>} */
export const loadLibs = once(() =>
  fs
    .readdirSync(LIBS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(path.join(LIBS_DIR, f)))
    .filter((lib) => lib.site)
    .sort((a, b) => a.site.order - b.site.order)
    .map((lib) => ({
      id: shortName(lib.name),
      name: lib.name,
      label: lib.site.label,
      icon: lib.site.icon,
      repo: repoSlug(lib.repo),
      ref: lib.site.usage?.ref ?? 'latest-release',
      path: lib.site.usage?.path ?? 'docs/usage',
      reference: lib.site.usage?.reference,
      guides: lib.site.usage?.guides,
      root: lib.site.usage?.root ?? '.',
      assets: lib.site.usage?.assets ?? [],
      prepare: lib.site.usage?.prepare,
      package: lib.site.package,
      install: lib.site.install,
      registry: lib.site.registry,
    })),
);

/**
 * Links from `contract/<domain>/references.md` (a Markdown list) followed by the official
 * references of each function, without duplicates.
 * @returns {Array<{title:string,url:string}>}
 */
export function loadReferences(id) {
  const spec = loadSpec(id);
  if (!spec) return [];
  const out = [];
  const seen = new Set();
  const add = (title, url) => {
    if (seen.has(url)) return;
    seen.add(url);
    out.push({ title, url });
  };
  const file = path.join(CONTRACT_DIR, spec.id, 'references.md');
  if (fs.existsSync(file)) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) add(m[1].trim(), m[2].trim());
  }
  for (const op of spec.operations) for (const url of op.references) add(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), url);
  return out;
}

/** Local PDFs kept next to the references, so links survive when the official source goes offline. */
export function loadReferenceFiles(id) {
  const spec = loadSpec(id);
  const dir = spec && path.join(CONTRACT_DIR, spec.id, 'references');
  if (!dir || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => ({ name: f, repoPath: `${contractPath(spec)}/references/${f}` }));
}

/**
 * Guides fetched from the libraries (scripts/fetch-libs.mjs), [] before the first fetch.
 * @type {() => Array<{lib:string,slug:string,title:{en:string,'pt-BR'?:string},description:{en:string,'pt-BR'?:string},fns:string[],source:string}>}
 */
export const loadGuides = once(() => {
  const file = path.join(GUIDES_DIR, 'manifest.json');
  if (!fs.existsSync(file)) return [];
  const libs = loadLibs().map((l) => l.id);
  return readJson(file).guides.sort((a, b) => libs.indexOf(a.lib) - libs.indexOf(b.lib) || a.order - b.order);
});

/** One guide's content for a language (falls back to English, then any language it has), or null. */
export function loadGuide(lib, slug, locale) {
  for (const l of new Set([locale, 'en', ...LANGS])) {
    const file = path.join(GUIDES_DIR, lib, `${slug}.${l}.json`);
    if (fs.existsSync(file)) return { ...readJson(file), locale: l };
  }
  return null;
}

/** Manifest written by scripts/fetch-libs.mjs. Null before the first fetch. */
export const loadUsageManifest = once(() => {
  const file = path.join(CACHE_DIR, 'manifest.json');
  return fs.existsSync(file) ? readJson(file) : null;
});

/**
 * Status of every lib from the last api-validator run, or null when the site is built without it.
 * `libs[<id>].functions[<fnId>]` = { status: ok|failing|signature|missing|waived, symbol?, source?,
 * passed, failed, failures: [{ id, expected, actual }] }.
 */
export const loadStatus = once(() => (fs.existsSync(STATUS_FILE) ? readJson(STATUS_FILE) : null));

/**
 * How much of a utility a lib covers, for the parity views. With a validator run (status.json,
 * for every lib alike): the operations it implements, and whether they pass the shared cases.
 * Without one: the operations its usage files document (.cache/usage/manifest.json).
 *   state   full | partial | failing | none
 *   count   operations implemented (or documented); failing: how many of them fail cases
 *   detail  per operation, in page order: { op, status } where status is the function's
 *           status.json status (ok|failing|signature|missing|waived), or ok|missing for documented
 * @returns {{state:'full'|'partial'|'failing'|'none',count:number,failing:number,total:number,detail:Array<{op:SpecMeta['operations'][number],status:string}>}}
 */
export function coverage(spec, libId) {
  const total = spec.operations.length;
  const status = loadStatus();
  let detail;
  if (status) {
    const fns = status.libs?.[libId]?.functions ?? {};
    detail = spec.operations.map((op) => ({ op, status: fns[op.fnId]?.status ?? 'missing' }));
  } else {
    const documented = new Set(Object.values(loadUsageManifest()?.libs?.[libId]?.utils?.[spec.id] ?? {}).flat());
    detail = spec.operations.map((op) => ({ op, status: documented.has(op.id) ? 'ok' : 'missing' }));
  }
  const count = detail.filter((d) => isImplemented(d)).length;
  const failing = detail.filter((d) => d.status === 'failing').length;
  const state = count === 0 ? 'none' : failing ? 'failing' : count >= total ? 'full' : 'partial';
  return { state, count, failing, total, detail };
}

/**
 * @typedef {Object} SpecMeta
 * @property {string} id          URL slug (license-plate)
 * @property {string} domain      contract domain (licensePlate)
 * @property {string} category
 * @property {number=} order
 * @property {{en:string,'pt-BR':string}} title
 * @property {{en:string,'pt-BR':string}} summary
 * @property {Array<{id:string,fnId:string,label:{en:string,'pt-BR':string},summary?:{en:string,'pt-BR'?:string},description?:{en:string,'pt-BR'?:string},references:string[],level:string,network:boolean,deprecated:boolean,params:Array<{name:string,type:string,optional?:boolean}>,returns:string,tests:Array<object>}>} operations
 * @property {string[]} related   slugs
 * @property {{en:boolean,'pt-BR':boolean}} hasSpec
 */
