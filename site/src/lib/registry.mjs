// Single place that knows how the repo is laid out.
// Used by astro.config.mjs, the build scripts and the Astro components.
// Plain ESM (no TypeScript) so astro.config.mjs can import it without a build step.

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

// The project root. Resolved from the working directory (not import.meta.url) because Astro
// bundles this module into dist/ at build time, where a relative path would point nowhere.
// Override with DOCS_ROOT when running from another directory.
export const ROOT = path.resolve(process.env.DOCS_ROOT || process.cwd());
export const SPECS_DIR = path.join(ROOT, 'specs');
export const CACHE_DIR = path.join(ROOT, '.cache', 'usage');
export const FIXTURES_DIR = path.join(ROOT, 'fixtures', 'usage');
export const DOCS_DIR = path.join(ROOT, 'src', 'content', 'docs');

/** Site languages. `en` is the root locale, `pt-BR` lives under /pt-br/. */
export const LANGS = ['en', 'pt-BR'];

/** URL prefix for each language ('' for the root locale). */
export const LANG_PREFIX = { en: '', 'pt-BR': 'pt-br' };

/** Sidebar groups, in display order. A spec picks one via `category` in meta.yaml. */
export const CATEGORIES = [
  { id: 'documents', label: { en: 'Personal documents', 'pt-BR': 'Documentos pessoais' } },
  { id: 'companies', label: { en: 'Companies', 'pt-BR': 'Empresas' } },
  { id: 'address', label: { en: 'Address', 'pt-BR': 'Endereço' } },
  { id: 'vehicles', label: { en: 'Vehicles', 'pt-BR': 'Veículos' } },
  { id: 'finance', label: { en: 'Finance', 'pt-BR': 'Financeiro' } },
  { id: 'telecom', label: { en: 'Telephony', 'pt-BR': 'Telefonia' } },
  { id: 'text-and-dates', label: { en: 'Text and dates', 'pt-BR': 'Texto e datas' } },
];

function readYaml(file) {
  // Our own files only; the safe schema refuses custom tags and code-like constructs.
  return yaml.load(fs.readFileSync(file, 'utf8'), { schema: yaml.JSON_SCHEMA, filename: file });
}

/** @returns {Array<{id:string,label:string,icon?:string,repo:string,ref:string,path:string,package:string,install:string,registry:string}>} */
export function loadLibs() {
  const { libs } = readYaml(path.join(ROOT, 'libs.yaml'));
  return libs;
}

/**
 * Every spec that has a meta.yaml, sorted by category order, then by `order`, then by title.
 * @returns {Array<SpecMeta>}
 */
export function loadSpecs() {
  if (!fs.existsSync(SPECS_DIR)) return [];
  const specs = fs
    .readdirSync(SPECS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SPECS_DIR, d.name, 'meta.yaml')))
    .map((d) => normalizeMeta(d.name, readYaml(path.join(SPECS_DIR, d.name, 'meta.yaml'))));

  const catIndex = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  return specs.sort((a, b) => {
    const ca = catIndex.get(a.category) ?? 99;
    const cb = catIndex.get(b.category) ?? 99;
    if (ca !== cb) return ca - cb;
    if ((a.order ?? 99) !== (b.order ?? 99)) return (a.order ?? 99) - (b.order ?? 99);
    return a.title.en.localeCompare(b.title.en);
  });
}

export function loadSpec(id) {
  const file = path.join(SPECS_DIR, id, 'meta.yaml');
  if (!fs.existsSync(file)) return null;
  return normalizeMeta(id, readYaml(file));
}

function normalizeMeta(id, meta) {
  const cat = CATEGORIES.find((c) => c.id === meta.category);
  if (!cat) {
    throw new Error(
      `specs/${id}/meta.yaml: unknown category "${meta.category}". Known: ${CATEGORIES.map((c) => c.id).join(', ')}`,
    );
  }
  return {
    id,
    category: meta.category,
    order: meta.order,
    title: meta.title,
    summary: meta.summary,
    operations: (meta.operations ?? []).map((op) => ({ id: op.id, label: op.label })),
    related: meta.related ?? [],
    hasSpec: { en: fs.existsSync(path.join(SPECS_DIR, id, 'spec_en.md')), 'pt-BR': fs.existsSync(path.join(SPECS_DIR, id, 'spec.md')) },
  };
}

/** Parsed `test-cases.json` for a spec, or null when the spec has none yet. */
export function loadTestCases(id) {
  const file = path.join(SPECS_DIR, id, 'test-cases.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Links from `specs/<id>/references/references.md`, parsed from its Markdown list.
 * @returns {Array<{title:string,url:string}>}
 */
export function loadReferences(id) {
  const file = path.join(SPECS_DIR, id, 'references', 'references.md');
  if (!fs.existsSync(file)) return [];
  const md = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const match of md.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    out.push({ title: match[1].trim(), url: match[2].trim() });
  }
  return out;
}

/** Local PDFs kept next to the references, so links survive when the official source goes offline. */
export function loadReferenceFiles(id) {
  const dir = path.join(SPECS_DIR, id, 'references');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => ({ name: f, repoPath: `specs/${id}/references/${f}` }));
}

/** Manifest written by scripts/fetch-usage.mjs. Null before the first fetch. */
export function loadUsageManifest() {
  const file = path.join(CACHE_DIR, 'manifest.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * @typedef {Object} SpecMeta
 * @property {string} id
 * @property {string} category
 * @property {number=} order
 * @property {{en:string,'pt-BR':string}} title
 * @property {{en:string,'pt-BR':string}} summary
 * @property {Array<{id:string,label:{en:string,'pt-BR':string}}>} operations
 * @property {string[]} related
 * @property {{en:boolean,'pt-BR':boolean}} hasSpec
 */
