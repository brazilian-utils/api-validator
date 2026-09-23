// The usage-file and reference-page formats, shared by the site (scripts/fetch-libs.mjs,
// registry.mjs) and the validator (src/core/usage.ts), so both read a lib's docs the same way:
// same file names, same `## <operation>` headings, same reference-page sections and intro.
//
// Pure: no fs, nothing runs at import. Types in usage-format.d.mts.

/** `licensePlate` → `license-plate`: the URL slug and usage file name of a domain. */
export const slugOf = (domain) => domain.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Case/separator-insensitive key: `get-info`, `getInfo`, `Get info` → `getinfo`. */
export const keyOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** `brazilian-utils-python` → `python`: the lib id on the site and in fixtures/usage/. */
export const shortName = (name) => name.replace(/^brazilian-utils-/, '');

/** `https://github.com/owner/repo(.git)` → `owner/repo`. */
export const repoSlug = (url) => new URL(url).pathname.replace(/^\/|\.git$/g, '');

/** Display order of operations on a page; the rest follow alphabetically. */
export const OP_ORDER = ['isValid', 'format', 'parse', 'generate', 'getInfo', 'get', 'list'];

/** Position of an operation in OP_ORDER (unlisted ones after every listed one). */
export const opRank = (op) => (OP_ORDER.includes(op) ? OP_ORDER.indexOf(op) : OP_ORDER.length);

/** Older usage-file headings that name the same operations. */
export const OP_ALIASES = { validate: 'isValid' };

/** Names of the operations the libraries share, used when the contract gives no `label`. */
export const DEFAULT_LABELS = {
  isValid: { en: 'Validate', 'pt-BR': 'Validar' },
  format: { en: 'Format', 'pt-BR': 'Formatar' },
  parse: { en: 'Parse', 'pt-BR': 'Interpretar' },
  generate: { en: 'Generate', 'pt-BR': 'Gerar' },
  getInfo: { en: 'Decode', 'pt-BR': 'Decodificar' },
  get: { en: 'Look up', 'pt-BR': 'Consultar' },
  list: { en: 'List', 'pt-BR': 'Listar' },
  convertToWords: { en: 'Write out in words', 'pt-BR': 'Escrever por extenso' },
};

function humanize(op) {
  const words = op.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
}

/** The name of an operation on the site: the contract's `label`, else the shared default, else `isFoo` → `Is foo`. */
export function operationLabel(op, label) {
  return label ?? DEFAULT_LABELS[op] ?? { en: humanize(op), 'pt-BR': humanize(op) };
}

const FRONT_MATTER = /^---\s*\n[\s\S]*?\n---\s*\n?/;

/** The text without its `---` front matter block. */
export const stripFrontMatter = (text) => text.replace(FRONT_MATTER, '');

/** `license-plate.pt-br.md` → `{ stem: 'license-plate', locale: 'pt-BR' }`; null when not a `.md` file. */
export function parseUsageFileName(name) {
  const m = /^(.+?)(?:\.(pt-br))?\.md$/i.exec(name);
  return m ? { stem: m[1], locale: m[2] ? 'pt-BR' : 'en' } : null;
}

/** The `## <heading>` sections of a usage file (front matter already stripped); text before the first is ignored. */
export function splitSections(body) {
  const marks = [...body.matchAll(/^##\s+(.+?)\s*$/gm)];
  return marks.map((m, i) => ({ heading: m[1].trim(), body: body.slice(m.index + m[0].length, marks[i + 1]?.index).trim() }));
}

/**
 * Resolve a usage-file heading to one of a domain's operations (`[{ id, label: { en } }]`, in
 * display order): the operation id, its English label, or an older alias, ignoring case and
 * separators. Returns the operation id, or undefined.
 */
export function resolveOperation(ops, heading) {
  const key = keyOf(heading);
  const alias = OP_ALIASES[key];
  if (alias && ops.some((o) => o.id === alias)) return alias;
  return ops.find((o) => keyOf(o.id) === key || keyOf(o.label.en) === key)?.id;
}

/**
 * Symbol name → contract function id, from `[fnId, nativeSymbol]` pairs (the validator's
 * bindings): the full symbol and its last segment (`cpf.IsValid` → `IsValid`), first one wins.
 */
export function symbolMap(entries) {
  const out = new Map();
  for (const [fnId, symbol] of entries) {
    if (!symbol) continue;
    for (const name of [symbol, symbol.split(/[.:]/).pop()]) if (!out.has(name)) out.set(name, fnId);
  }
  return out;
}

/**
 * A reference page (front matter already stripped): one Markdown page whose `##`/`###` headings
 * are the lib's own symbol names (`### isValidCpf`). Every `##`/`###` heading outside fenced
 * code ends the section before it; one whose text is a symbol `bySymbol` knows (a single
 * token, backticks allowed) starts the section of that contract function. `intro` is what
 * comes before the first documented function (conventions every function follows): from the
 * first heading on (without that heading), minus the family heading (`## CPF`) right above it.
 */
export function referenceSections(body, bySymbol) {
  // Headings, except lines inside fenced code (a `## comment` in an example).
  const fences = [...body.matchAll(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1[^\S\n]*$|(?![\s\S]))/gm)].map((m) => [m.index, m.index + m[0].length]);
  const marks = [...body.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)].filter((m) => !fences.some(([a, b]) => m.index > a && m.index < b));
  const sections = [];
  let first = null;
  marks.forEach((m, i) => {
    const symbol = /^`?([^`\s]+)`?$/.exec(m[2])?.[1];
    const fnId = symbol && bySymbol.get(symbol);
    if (!fnId) return;
    first ??= i;
    sections.push({ fnId, symbol, body: body.slice(m.index + m[0].length, marks[i + 1]?.index).trim() });
  });
  let intro = '';
  if (first !== null) {
    let cut = marks[first].index;
    const parent = marks.slice(0, first).reverse().find((m) => m[1].length < marks[first][1].length);
    if (parent && marks[first][1].length === 3) cut = parent.index;
    // The page's own opening text describes that page ("Every function of the package…"): the
    // intro starts at the first heading before the functions, and that heading gives way to the
    // site's own ("API conventions").
    const start = marks.find((m) => m.index < cut);
    intro = start ? body.slice(start.index + start[0].length, cut).trim() : body.slice(0, cut).trim();
  }
  return { sections, intro };
}
