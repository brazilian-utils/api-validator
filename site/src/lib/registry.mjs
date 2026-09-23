// Single place that knows where the site's data comes from.
// Used by astro.config.mjs, the build scripts and the Astro components.
// Plain ESM (no TypeScript) so astro.config.mjs can import it without a build step.
//
// Everything is read from the api-validator repository this site lives in:
//   ../contract/<domain>.json          the spec: functions, signatures, cases, summaries, labels
//   ../contract/<domain>/spec.*.md     optional long-form spec per language, and references.md
//   ../contract/_categories.json       sidebar groups
//   ../libs/<lib>.json                 the libraries ("site" block: tab label, install line, usage files)
//   .generated/status.json             written by `api-validator site-data` from the latest check run
//                                      (implemented / failing / missing per lib and function; optional)

import fs from 'node:fs';
import path from 'node:path';

// The site root. Resolved from the working directory (not import.meta.url) because Astro
// bundles this module into dist/ at build time, where a relative path would point nowhere.
export const ROOT = path.resolve(process.env.DOCS_ROOT || process.cwd());
export const REPO_ROOT = path.resolve(process.env.API_VALIDATOR_ROOT || path.join(ROOT, '..'));
export const CONTRACT_DIR = path.join(REPO_ROOT, 'contract');
export const LIBS_DIR = path.join(REPO_ROOT, 'libs');
export const CACHE_DIR = path.join(ROOT, '.cache', 'usage');
export const GUIDES_DIR = path.join(ROOT, '.cache', 'guides');
export const REPOS_CACHE = path.join(ROOT, '.cache', 'repos');
export const LOCAL_REPOS = path.join(REPO_ROOT, '.repos');
/** Files the libraries' live demos load, served at <base>/lib-assets/<lib>/. */
export const LIB_ASSETS_DIR = path.join(ROOT, 'public', 'lib-assets');
export const FIXTURES_DIR = path.join(ROOT, 'fixtures', 'usage');
export const DOCS_DIR = path.join(ROOT, 'src', 'content', 'docs');
export const STATUS_FILE = path.join(ROOT, '.generated', 'status.json');

/** Site languages. `en` is the root locale, `pt-BR` lives under /pt-br/. */
export const LANGS = ['en', 'pt-BR'];

/** URL prefix for each language ('' for the root locale). */
export const LANG_PREFIX = { en: '', 'pt-BR': 'pt-br' };

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const lines = (v) => (Array.isArray(v) ? v.join('\n') : v);

/** `licensePlate` → `license-plate`: the URL slug and usage file name of a domain. */
export const slugOf = (domain) => domain.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Case/separator-insensitive key: `remove-symbols`, `removeSymbols`, `Remove symbols` → `removesymbols`. */
export const keyOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Sidebar groups, in display order. */
export const CATEGORIES = readJson(path.join(CONTRACT_DIR, '_categories.json')).categories;

// Names of the operations the libraries share, used when the contract gives no `label`.
const LABELS = {
  isValid: { en: 'Validate', 'pt-BR': 'Validar' },
  format: { en: 'Format', 'pt-BR': 'Formatar' },
  parse: { en: 'Parse', 'pt-BR': 'Extrair' },
  removeSymbols: { en: 'Remove symbols', 'pt-BR': 'Remover símbolos' },
  generate: { en: 'Generate', 'pt-BR': 'Gerar' },
  getInfo: { en: 'Decode', 'pt-BR': 'Decodificar' },
  get: { en: 'Look up', 'pt-BR': 'Consultar' },
  list: { en: 'List', 'pt-BR': 'Listar' },
  convertToWords: { en: 'Write out in words', 'pt-BR': 'Escrever por extenso' },
};
// Display order of operations on a page; the rest follow alphabetically.
const OP_ORDER = ['isValid', 'format', 'parse', 'removeSymbols', 'generate', 'getInfo', 'get', 'list'];
// Older usage-file headings that name the same operations.
const OP_ALIASES = { validate: 'isValid' };

function humanize(op) {
  const words = op.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
}

/** Resolve a usage-file heading to one of the domain's operation ids, or undefined. */
export function resolveOperation(spec, heading) {
  const key = keyOf(heading);
  const alias = OP_ALIASES[key];
  if (alias && spec.operations.some((o) => o.id === alias)) return alias;
  return spec.operations.find((o) => keyOf(o.id) === key || keyOf(o.label.en) === key)?.id;
}

let specsCache;

/**
 * Every contract domain, as a page: sorted by category order, then `order`, then title.
 * @returns {Array<SpecMeta>}
 */
export function loadSpecs() {
  if (specsCache) return specsCache;
  const files = fs.readdirSync(CONTRACT_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  const specs = files.map((f) => normalize(readJson(path.join(CONTRACT_DIR, f))));
  const catIndex = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  specsCache = specs.sort((a, b) => {
    const ca = catIndex.get(a.category) ?? 99;
    const cb = catIndex.get(b.category) ?? 99;
    if (ca !== cb) return ca - cb;
    if ((a.order ?? 99) !== (b.order ?? 99)) return (a.order ?? 99) - (b.order ?? 99);
    return a.title.en.localeCompare(b.title.en);
  });
  return specsCache;
}

export function loadSpec(id) {
  return loadSpecs().find((s) => s.id === id || s.domain === id) ?? null;
}

function normalize(doc) {
  const domain = doc.domain;
  const title = typeof doc.title === 'string' ? { en: doc.title, 'pt-BR': doc.title } : doc.title ?? { en: domain, 'pt-BR': domain };
  const summary = doc.summary ?? { en: '', 'pt-BR': '' };
  const rank = (op) => (OP_ORDER.includes(op) ? OP_ORDER.indexOf(op) : OP_ORDER.length);
  const operations = Object.entries(doc.functions)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([op, fn]) => ({
      id: op,
      fnId: `${domain}.${op}`,
      label: fn.label ?? LABELS[op] ?? { en: humanize(op), 'pt-BR': humanize(op) },
      summary: fn.summary,
      description: lines(fn.description),
      references: fn.references ?? [],
      level: fn.level ?? 'extended',
      network: Boolean(fn.network),
      deprecated: Boolean(fn.deprecated),
      params: fn.params ?? [],
      returns: fn.returns,
      tests: fn.tests ?? [],
    }));
  const dir = path.join(CONTRACT_DIR, domain);
  return {
    id: slugOf(domain),
    domain,
    category: doc.category,
    order: doc.order,
    title,
    summary,
    related: (doc.related ?? []).map(slugOf),
    operations,
    hasSpec: { en: fs.existsSync(path.join(dir, 'spec.en.md')), 'pt-BR': fs.existsSync(path.join(dir, 'spec.pt-BR.md')) },
  };
}

/** @returns {Array<{id:string,name:string,label:string,icon?:string,repo:string,ref:string,path:string,package:string,install:string,registry:string}>} */
export function loadLibs() {
  return fs
    .readdirSync(LIBS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(path.join(LIBS_DIR, f)))
    .filter((lib) => lib.site)
    .sort((a, b) => a.site.order - b.site.order)
    .map((lib) => ({
      id: lib.name.replace(/^brazilian-utils-/, ''),
      name: lib.name,
      label: lib.site.label,
      icon: lib.site.icon,
      repo: new URL(lib.repo).pathname.replace(/^\/|\.git$/g, ''),
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
    }));
}

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
  const file = path.join(CONTRACT_DIR, spec.domain, 'references.md');
  if (fs.existsSync(file)) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) add(m[1].trim(), m[2].trim());
  }
  for (const op of spec.operations) for (const url of op.references) add(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), url);
  return out;
}

/** Local PDFs kept next to the references, so links survive when the official source goes offline. */
export function loadReferenceFiles(id) {
  const spec = loadSpec(id);
  const dir = spec && path.join(CONTRACT_DIR, spec.domain, 'references');
  if (!dir || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => ({ name: f, repoPath: `contract/${spec.domain}/references/${f}` }));
}

/**
 * Guides fetched from the libraries (scripts/fetch-libs.mjs), [] before the first fetch.
 * @returns {Array<{lib:string,slug:string,title:{en:string,'pt-BR'?:string},description:{en:string,'pt-BR'?:string},fns:string[],source:string}>}
 */
export function loadGuides() {
  const file = path.join(GUIDES_DIR, 'manifest.json');
  if (!fs.existsSync(file)) return [];
  const libs = loadLibs().map((l) => l.id);
  return readJson(file).guides.sort((a, b) => libs.indexOf(a.lib) - libs.indexOf(b.lib) || a.order - b.order);
}

/** One guide's content for a language (falls back to English), or null. */
export function loadGuide(lib, slug, locale) {
  for (const l of [locale, 'en']) {
    const file = path.join(GUIDES_DIR, lib, `${slug}.${l}.json`);
    if (fs.existsSync(file)) return { ...readJson(file), locale: l };
  }
  return null;
}

/** Manifest written by scripts/fetch-libs.mjs. Null before the first fetch. */
export function loadUsageManifest() {
  const file = path.join(CACHE_DIR, 'manifest.json');
  if (!fs.existsSync(file)) return null;
  return readJson(file);
}

/**
 * Status of every lib from the last api-validator run, or null when the site is built without it.
 * `libs[<id>].functions[<fnId>]` = { status: ok|failing|signature|missing|waived, symbol?, source?,
 * passed, failed, failures: [{ id, expected, actual }] }.
 */
export function loadStatus() {
  if (!fs.existsSync(STATUS_FILE)) return null;
  return readJson(STATUS_FILE);
}

/**
 * @typedef {Object} SpecMeta
 * @property {string} id          URL slug (license-plate)
 * @property {string} domain      contract domain (licensePlate)
 * @property {string} category
 * @property {number=} order
 * @property {{en:string,'pt-BR':string}} title
 * @property {{en:string,'pt-BR':string}} summary
 * @property {Array<{id:string,fnId:string,label:{en:string,'pt-BR':string},summary?:string,description?:string,references:string[],level:string,network:boolean,deprecated:boolean,params:Array<{name:string,type:string,optional?:boolean}>,returns:string,tests:Array<object>}>} operations
 * @property {string[]} related   slugs
 * @property {{en:boolean,'pt-BR':boolean}} hasSpec
 */
