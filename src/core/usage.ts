/**
 * Usage files: how each lib shows its functions on the docs site.
 *
 * Every lib keeps `<site.usage.path>/<slug>.md` (default `docs/usage/`), one file per contract
 * domain, named after the site slug (`license-plate.md`) or the domain (`licensePlate.md`).
 * Each `## <operation>` section documents one contract function: `## isValid`, `## format`, …
 * (`is-valid`, `get-info` and the older `validate` resolve too). A `.pt-br.md` twin holds
 * Portuguese prose when the lib has it. The site (site/scripts/fetch-libs.mjs) cuts the files
 * into one usage tab per lib and operation.
 *
 * This module is the validator's side of that standard:
 *   - parse the files and tell, per contract function, whether the lib documents it and what is
 *     wrong (a section for a function the lib does not have, an example that never calls it);
 *   - scaffold the missing sections from the shared cases the lib passes, in the lib's language,
 *     so every implemented function gets a correct example without anyone writing it by hand.
 */
import fs from "node:fs";
import path from "node:path";
import {
  keyOf,
  shortName,
  operationLabel,
  opRank,
  parseUsageFileName,
  referenceSections,
  resolveOperation,
  slugOf,
  splitSections,
  stripFrontMatter,
  symbolMap
} from "../../site/src/lib/usage-format.mjs";
import type { Contract, ContractFunction, FunctionReport, LibConfig, LibReport } from "./model.js";

export interface UsageSection {
  file: string;
  locale: "en" | "pt-BR";
  fn: string;
  body: string;
}

export interface UsageFiles {
  /** Where the files were read from (a lib checkout or the site fixtures). */
  dir?: string;
  sections: UsageSection[];
  /** Files or headings that match nothing in the contract. */
  warnings: string[];
}

export interface FunctionUsage {
  documented: boolean;
  problems: string[];
}

/** A domain's operations the way the site lists them: display order, label (the contract's or the default). */
function operationsOf(contract: Contract, domain: string) {
  return [...contract.functions.values()]
    .filter((f) => f.domain === domain)
    .map((f) => ({ id: f.operation, label: operationLabel(f.operation, f.label) }))
    .sort((a, b) => opRank(a.id) - opRank(b.id) || a.id.localeCompare(b.id));
}

export function parseUsageDir(contract: Contract, dir: string): UsageFiles {
  const out: UsageFiles = { dir, sections: [], warnings: [] };
  if (!fs.existsSync(dir)) return out;
  const domains = new Map([...contract.domains.keys()].flatMap((d) => [[keyOf(d), d], [keyOf(slugOf(d)), d]]));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const { stem, locale } = parseUsageFileName(file)!;
    const domain = domains.get(keyOf(stem));
    if (!domain) {
      if (!/^readme$/i.test(stem)) out.warnings.push(`${file}: no contract domain named "${stem}"`);
      continue;
    }
    const ops = operationsOf(contract, domain);
    for (const s of splitSections(stripFrontMatter(fs.readFileSync(path.join(dir, file), "utf8")))) {
      const op = resolveOperation(ops, s.heading);
      if (!op) {
        const known = [...contract.functions.values()].filter((f) => f.domain === domain).map((f) => f.operation);
        out.warnings.push(`${file}: "## ${s.heading}" is not an operation of ${domain} (${known.join(", ")})`);
        continue;
      }
      out.sections.push({ file, locale, fn: `${domain}.${op}`, body: s.body });
    }
  }
  return out;
}

/**
 * A reference page: one Markdown file whose `##`/`###` headings are the lib's own symbol names
 * (`### isValidCpf`), the way many libs already document their API. Each section documents the
 * contract function the validator bound to that symbol; other headings are ignored. `intro` is
 * what the site shows on the lib's page (see referenceSections in site/src/lib/usage-format.mjs).
 */
export function parseReference(report: LibReport, file: string, content: string, locale: "en" | "pt-BR"): { sections: UsageSection[]; intro: string } {
  const { sections, intro } = referenceSections(stripFrontMatter(content), symbolMap(report.functions.map((f) => [f.id, f.symbol] as const)));
  return { sections: sections.map((s) => ({ file, locale, fn: s.fnId, body: s.body })), intro };
}

/** The reference pages a lib declares (`site.usage.reference`), per locale. */
function referenceFilesFor(lib: LibConfig, root: string, report: LibReport): UsageSection[] {
  const ref = lib.site?.usage.reference;
  if (!ref) return [];
  const out: UsageSection[] = [];
  for (const [locale, rel] of Object.entries(ref) as Array<["en" | "pt-BR", string]>) {
    const file = path.join(root, rel);
    if (fs.existsSync(file)) out.push(...parseReference(report, rel, fs.readFileSync(file, "utf8"), locale).sections);
  }
  return out;
}

/**
 * What a lib documents itself, in its checkout at `root`: its usage files, plus its reference
 * page for the function/locale pairs they do not cover (the site reads them the same way).
 * `dir` is the reference page when only the page contributes.
 */
export function ownUsage(contract: Contract, lib: LibConfig, root: string, report: LibReport): UsageFiles {
  if (!lib.site) return { sections: [], warnings: [] };
  const own = parseUsageDir(contract, path.join(root, lib.site.usage.path));
  const have = new Set(own.sections.map((s) => `${s.fn}/${s.locale}`));
  const fromReference = referenceFilesFor(lib, root, report).filter((s) => !have.has(`${s.fn}/${s.locale}`));
  if (fromReference.length && !have.size) own.dir = path.join(root, lib.site.usage.reference!.en);
  own.sections.push(...fromReference);
  return own;
}

/** The lib's own usage (ownUsage); without any, the site's fixtures for it. */
export function usageFilesFor(contract: Contract, lib: LibConfig, root: string | undefined, fixturesDir: string, report: LibReport): UsageFiles {
  const own = root && lib.site ? ownUsage(contract, lib, root, report) : undefined;
  if (own && own.sections.length) return own;
  const fixtures = parseUsageDir(contract, path.join(fixturesDir, shortName(lib.name)));
  const warnings = [...(own?.warnings ?? []), ...fixtures.warnings];
  return fixtures.sections.length || fixtures.warnings.length ? { ...fixtures, warnings } : { sections: [], warnings };
}

const implemented = (f?: FunctionReport) => f?.status === "ok" || f?.status === "failing" || f?.status === "signature";
/** The name an example must mention: the last segment of the native symbol. */
const callName = (symbol: string) => symbol.split(/[.:]/).pop()!;

/** Per contract function: documented or not, and what is wrong with the section. */
export function usageStatus(contract: Contract, report: LibReport, files: UsageFiles): Record<string, FunctionUsage> {
  const byFn = new Map<string, UsageSection[]>();
  for (const s of files.sections) byFn.set(s.fn, [...(byFn.get(s.fn) ?? []), s]);
  const out: Record<string, FunctionUsage> = {};
  for (const f of report.functions) {
    if (!contract.functions.has(f.id)) continue;
    const sections = byFn.get(f.id) ?? [];
    const problems: string[] = [];
    const en = sections.filter((s) => s.locale === "en");
    if (sections.length && !implemented(f)) problems.push("documents a function the lib does not implement");
    if (implemented(f) && f.symbol) {
      const name = callName(f.symbol);
      for (const s of en) if (!s.body.includes(name)) problems.push(`${s.file}: the example never calls \`${name}\``);
    }
    for (const s of en) if (!/```/.test(s.body)) problems.push(`${s.file}: the section has no code block`);
    out[f.id] = { documented: en.length > 0, problems };
  }
  return out;
}

export interface UsageSummary {
  implemented: number;
  documented: number;
  problems: number;
  /** Contract functions the lib implements without a usage section. */
  undocumented: string[];
}

/** Totals over the contract functions (the ones `usage` has an entry for). */
export function summarizeUsage(report: LibReport, usage: Record<string, FunctionUsage>): UsageSummary {
  const impl = report.functions.filter((f) => implemented(f) && usage[f.id]);
  return {
    implemented: impl.length,
    documented: impl.filter((f) => usage[f.id].documented).length,
    problems: Object.values(usage).reduce((n, u) => n + u.problems.length, 0),
    undocumented: impl.filter((f) => !usage[f.id].documented).map((f) => f.id)
  };
}

// ---------------------------------------------------------------------------
// Scaffolding: examples from the shared cases the lib passes
// ---------------------------------------------------------------------------

interface Example {
  args: unknown[];
  /** Expected return value; absent for random results (generators). */
  value?: unknown;
}

interface Target {
  lib: LibConfig;
  fn: ContractFunction;
  /** Native symbol as the extractor names it (`cpf.IsValid`, `brutils.format_cpf`, …). */
  symbol: string;
  /** Native return type, when the extractor knows it. */
  returns?: string;
  /** Native parameter types, when known (decimal literals need them). */
  paramTypes: Array<string | undefined>;
  /** Source file of the symbol, relative to the lib root. */
  file?: string;
  examples: Example[];
}

type Renderer = { fence: string; render: (t: Target) => string[] | undefined };

const RANDOM = "random valid value";
const truncate = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function quote(s: string, q: "'" | '"'): string {
  const esc = s.replace(/\\/g, "\\\\").replace(new RegExp(q, "g"), `\\${q}`).replace(/\n/g, "\\n");
  return `${q}${esc}${q}`;
}

/** A literal in a C-like syntax: strings, numbers, booleans, null, arrays, maps. */
function literal(v: unknown, o: { q: "'" | '"'; t: string; f: string; nil: string; key: (k: string) => string; map: [string, string]; arr: [string, string] }): string {
  if (v === null || v === undefined) return o.nil;
  if (typeof v === "string") return quote(v, o.q);
  if (typeof v === "boolean") return v ? o.t : o.f;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `${o.arr[0]}${v.map((x) => literal(x, o)).join(", ")}${o.arr[1]}`;
  const entries = Object.entries(v as Record<string, unknown>).map(([k, x]) => `${o.key(k)}${literal(x, o)}`);
  return `${o.map[0]}${entries.join(", ")}${o.map[1]}`;
}

type Syntax = Parameters<typeof literal>[1];
const JS: Syntax = { q: "'", t: "true", f: "false", nil: "null", key: (k) => `${k}: `, map: ["{ ", " }"], arr: ["[", "]"] };
const PY: Syntax = { q: "'", t: "True", f: "False", nil: "None", key: (k) => `'${k}': `, map: ["{", "}"], arr: ["[", "]"] };
const RB: Syntax = { ...JS, nil: "nil" };
const DQ: Syntax = { ...JS, q: '"' };
const GO: Syntax = { ...DQ, nil: "nil" };
const RS: Syntax = { ...DQ, nil: "None" };
/** Erlang terms: binaries for strings, maps with snake_case atom keys, `undefined` for null. */
const erl = (v: unknown): string =>
  typeof v === "string"
    ? `<<${quote(v, '"')}${/^[\x00-\x7f]*$/.test(v) ? "" : "/utf8"}>>`
    : Array.isArray(v)
      ? `[${v.map(erl).join(", ")}]`
      : v && typeof v === "object"
        ? `#{${Object.entries(v).map(([k, x]) => `${k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)} => ${erl(x)}`).join(", ")}}`
        : v === null || v === undefined
          ? "undefined"
          : String(v);
const argList = (args: unknown[], syntax: Syntax) => args.map((a) => literal(a, syntax)).join(", ");

/** Lines `call  <comment> result`, aligned. */
function calls(rows: Array<[string, string | undefined]>, comment: string): string[] {
  const width = Math.max(...rows.map(([c]) => c.length));
  return rows.map(([c, r]) => (r === undefined ? c : `${c.padEnd(width)}  ${comment} ${r}`));
}

const isRandom = (e: Example) => !("value" in e);

const RENDERERS: Record<string, Renderer> = {
  typescript: {
    fence: "js",
    render: (t) => {
      const name = callName(t.symbol);
      return [
        `import { ${name} } from '${t.lib.site?.package ?? t.lib.name}';`,
        "",
        ...calls(t.examples.map((e) => [`${name}(${argList(e.args, JS)});`, isRandom(e) ? RANDOM : truncate(literal(e.value, JS))]), "//")
      ];
    }
  },
  python: {
    fence: "python",
    render: (t) => {
      const parts = t.symbol.split(".");
      const name = parts.pop()!;
      const from = [t.lib.site?.package ?? t.lib.entry, ...parts].join(".");
      return [
        `from ${from} import ${name}`,
        "",
        ...calls(t.examples.map((e) => [`${name}(${argList(e.args, PY)})`, isRandom(e) ? RANDOM : truncate(literal(e.value, PY))]), "#")
      ];
    }
  },
  ruby: {
    fence: "ruby",
    render: (t) => {
      const ns = (t.lib.options.namespace as string | undefined) ?? "BrazilianUtils";
      const req = t.file?.replace(/^lib\//, "").replace(/\.rb$/, "");
      const call = `${ns}::${t.symbol}`;
      return [
        ...(req ? [`require '${req}'`, ""] : []),
        ...calls(t.examples.map((e) => [`${call}(${argList(e.args, RB)})`, isRandom(e) ? RANDOM : truncate(literal(e.value, RB))]), "# =>")
      ];
    }
  },
  go: {
    fence: "go",
    render: (t) => {
      const [pkg, name] = t.symbol.split(".");
      const fallible = /\berror\)?\s*$/.test(t.returns ?? "");
      const rows: Array<[string, string | undefined]> = [];
      for (const e of t.examples) {
        const call = `${pkg}.${name}(${argList(e.args, DQ)})`;
        if (isRandom(e)) rows.push([call, RANDOM]);
        else if (e.value === null) {
          if (fallible) rows.push([call, "error"]);
        } else rows.push([call, truncate(fallible ? `${literal(e.value, GO)}, nil` : literal(e.value, GO))]);
      }
      if (!rows.length) return undefined;
      return [`import "${t.lib.site?.package ?? "github.com/brazilian-utils/go"}/${pkg}"`, "", ...calls(rows, "//")];
    }
  },
  rust: {
    fence: "rust",
    render: (t) => {
      const [mod, name] = t.symbol.split(".");
      const ret = t.returns ?? "";
      const wrap = (v: unknown) => {
        const lit = literal(v, RS);
        if (/^Option</.test(ret)) return v === null ? "None" : `Some(${lit})`;
        if (/^Result</.test(ret)) return v === null ? "Err(_)" : `Ok(${lit})`;
        return v === null ? undefined : lit;
      };
      const rows: Array<[string, string | undefined]> = [];
      for (const e of t.examples) {
        const call = `${mod}::${name}(${argList(e.args, DQ)});`;
        const r = isRandom(e) ? RANDOM : wrap(e.value);
        if (r !== undefined) rows.push([call, truncate(r)]);
      }
      if (!rows.length) return undefined;
      return [`use ${(t.lib.site?.package ?? "brazilian_utils").replace(/-/g, "_")}::${mod};`, "", ...calls(rows, "//")];
    }
  },
  dotnet: {
    fence: "csharp",
    render: (t) => {
      const option = /\boption$/.test(t.returns ?? "");
      const arg = (a: unknown, i: number) => (typeof a === "number" && t.paramTypes[i] === "decimal" ? `${a}m` : literal(a, DQ));
      const rows: Array<[string, string | undefined]> = [];
      for (const e of t.examples) {
        const call = `${t.symbol}(${e.args.map(arg).join(", ")});`;
        if (isRandom(e)) rows.push([call, RANDOM]);
        else if (e.value === null) rows.push([call, option ? "None" : "null"]);
        else rows.push([call, truncate(option ? `Some(${literal(e.value, DQ)})` : literal(e.value, DQ))]);
      }
      return [`using ${t.lib.entry};`, "", ...calls(rows, "//")];
    }
  },
  erlang: {
    fence: "erlang",
    render: (t) => {
      const [mod, name] = t.symbol.split(".");
      const tagged = /\{ok,/.test(t.returns ?? "");
      const rows: Array<[string, string | undefined]> = [];
      for (const e of t.examples) {
        const call = `${mod}:${name}(${e.args.map(erl).join(", ")}).`;
        if (isRandom(e)) rows.push([call, RANDOM]);
        else if (e.value === null) {
          if (tagged || /\berror\b/.test(t.returns ?? "")) rows.push([call, "{error, _}"]);
        } else rows.push([call, truncate(tagged ? `{ok, ${erl(e.value)}}` : erl(e.value))]);
      }
      if (!rows.length) return undefined;
      return calls(rows, "%");
    }
  }
};

/** Up to `max` examples from the cases the lib passes: distinct results first, short inputs first. */
function pickExamples(fn: ContractFunction, f: FunctionReport, max = 3): Example[] {
  const passed = new Set(f.tests.filter((t) => t.status === "pass").map((t) => t.id));
  const tests = fn.tests.filter((t) => passed.has(t.id) && (t.expect.kind === "returns" || t.expect.kind === "satisfies"));
  const random = tests.find((t) => t.expect.kind === "satisfies");
  // Contract order (canonical cases come first), but blank inputs and edge cases last.
  const blank = (t: { args: unknown[] }) => t.args.some((a) => typeof a === "string" && a.trim() === "");
  // An input that comes back unchanged shows little of what a formatter or cleaner does.
  const same = (t: (typeof tests)[number]) => t.expect.kind === "returns" && t.args.length === 1 && t.expect.value === t.args[0];
  const rank = (t: (typeof tests)[number]) => 2 * Number(blank(t)) + Number(same(t));
  const fixed = tests.filter((t) => t.expect.kind === "returns").sort((a, b) => rank(a) - rank(b));
  const out: Example[] = [];
  const seen = new Set<string>();
  for (const pass of [true, false]) {
    for (const t of fixed) {
      if (out.length >= max) break;
      const value = (t.expect as { value: unknown }).value;
      const key = JSON.stringify(value);
      if (out.some((e) => JSON.stringify(e.args) === JSON.stringify(t.args))) continue;
      if (pass && seen.has(key)) continue;
      seen.add(key);
      out.push({ args: t.args, value });
    }
  }
  if (random && out.length < max) out.push({ args: random.args });
  return out;
}

export interface ScaffoldInput {
  contract: Contract;
  lib: LibConfig;
  report: LibReport;
  /** Native return and parameter types by symbol (from the API snapshot). */
  natives: Map<string, { returns?: string; params: Array<{ type?: string }> }>;
  existing: UsageFiles;
  /** Sections documented elsewhere (the lib's reference page): no scaffold for them. */
  alsoDocumented?: UsageSection[];
}

/**
 * The usage files to write for a lib: for every function it implements without a usage
 * section, one scaffolded section in the domain's file. Existing content is kept as is; new
 * sections are appended. Returns file name → full new content (only files that change).
 */
export function scaffoldUsage(input: ScaffoldInput, read: (file: string) => string | undefined): Map<string, string> {
  const renderer = RENDERERS[input.lib.language];
  const out = new Map<string, string>();
  if (!renderer) return out;
  const documented = new Set([...input.existing.sections, ...(input.alsoDocumented ?? [])].filter((s) => s.locale === "en").map((s) => s.fn));
  const byDomain = new Map<string, string[]>();
  const order = (id: string) => opRank(input.contract.functions.get(id)?.operation ?? "");
  const fns = [...input.report.functions].sort((a, b) => a.id.split(".")[0].localeCompare(b.id.split(".")[0]) || order(a.id) - order(b.id) || a.id.localeCompare(b.id));
  for (const f of fns) {
    const fn = input.contract.functions.get(f.id);
    if (!fn || !f.symbol || documented.has(f.id) || !(f.status === "ok" || f.status === "failing")) continue;
    const examples = pickExamples(fn, f);
    if (!examples.length) continue;
    const native = input.natives.get(f.symbol);
    const code = renderer.render({
      lib: input.lib,
      fn,
      symbol: f.symbol,
      returns: native?.returns,
      paramTypes: native?.params.map((p) => p.type) ?? [],
      file: f.location?.file,
      examples
    });
    if (!code) continue;
    byDomain.set(fn.domain, [...(byDomain.get(fn.domain) ?? []), `## ${fn.operation}\n\n\`\`\`${renderer.fence}\n${code.join("\n")}\n\`\`\`\n`]);
  }
  // English sections only: a scaffold is English and never goes into `<slug>.pt-br.md`.
  const fileOf = new Map(input.existing.sections.filter((s) => s.locale === "en").map((s) => [input.contract.functions.get(s.fn)!.domain, s.file]));
  for (const [domain, sections] of byDomain) {
    const file = fileOf.get(domain) ?? `${slugOf(domain)}.md`;
    const current = read(file);
    const head = current?.trimEnd() ?? SCAFFOLD_HEADER;
    out.set(file, `${head}\n\n${sections.join("\n")}`);
  }
  return out;
}

const SCAFFOLD_HEADER =
  "<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.\n" +
  "     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->";

/**
 * A lib's usage sections (from its usage files, its reference page, or both) written out in the
 * usage-file format: `<slug>.md` and `<slug>.pt-br.md`, one `## <operation>` section each, in
 * the order the site shows them. Used to keep the site's fixtures current and to move a lib from
 * a reference page to usage files.
 */
export function materializeUsage(contract: Contract, sections: UsageSection[], source: string): Map<string, string> {
  const groups = new Map<string, UsageSection[]>();
  for (const s of sections) {
    const fn = contract.functions.get(s.fn);
    if (!fn) continue;
    const file = `${slugOf(fn.domain)}${s.locale === "pt-BR" ? ".pt-br" : ""}.md`;
    const list = groups.get(file) ?? [];
    if (!list.some((x) => x.fn === s.fn)) list.push(s);
    groups.set(file, list);
  }
  const out = new Map<string, string>();
  for (const [file, list] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const op = (s: UsageSection) => contract.functions.get(s.fn)!.operation;
    list.sort((a, b) => opRank(op(a)) - opRank(op(b)) || op(a).localeCompare(op(b)));
    out.set(file, [`<!-- Generated by \`docs usage --materialize\` from ${source}. -->`, "", ...list.map((s) => `## ${op(s)}\n\n${s.body}\n`)].join("\n"));
  }
  return out;
}
