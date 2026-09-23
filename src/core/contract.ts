import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { parseCType } from "./ctype.js";
import { camel, pascal } from "./naming.js";
import type { Contract, ContractFunction, ContractTest, Expectation } from "./model.js";

/** Markdown text: a string, or an array of lines (how the formatter writes multi-line text). */
const markdown = z.union([z.string(), z.array(z.string())]).transform((v) => (Array.isArray(v) ? v.join("\n") : v));

/** Text in the site's languages. */
const localized = z.object({ en: z.string().min(1), "pt-BR": z.string().min(1) }).strict();

/**
 * Prose in English only, or in each site language: `"…"` or `{ "en": "…", "pt-BR": "…" }`.
 * The validator (issues, briefs, reports, the exported suite) uses the English text; the docs site
 * reads the contract files directly and shows the page's language.
 */
const english = (v: string | { en: string }) => (typeof v === "string" ? v : v.en);
const translatableText = z.union([z.string(), z.object({ en: z.string(), "pt-BR": z.string().optional() }).strict()]).transform(english);
const translatableMarkdown = z.union([markdown, z.object({ en: markdown, "pt-BR": markdown.optional() }).strict()]).transform(english);

const identifier = z.string().regex(/^[a-z][A-Za-z0-9]*$/, "must be lowerCamelCase");

const TestSchema = z
  .object({
    name: z.string().optional(),
    args: z.array(z.unknown()).default([]),
    returns: z.unknown().optional(),
    throws: z.literal(true).optional(),
    matches: z.string().optional(),
    satisfies: z.string().optional(),
    repeat: z.number().int().min(1).max(50).default(1),
    note: z.string().optional()
  })
  .strict()
  .superRefine((t, ctx) => {
    const kinds = ["returns", "throws", "matches", "satisfies"].filter((k) => k in t && (t as never)[k] !== undefined);
    if (kinds.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: `a test needs exactly one of returns | throws | matches | satisfies (got ${kinds.join(", ") || "none"})`
      });
    }
  });

const ParamSchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1),
    optional: z.boolean().optional(),
    description: z.string().optional()
  })
  .strict();

const FunctionSchema = z
  .object({
    flatName: identifier.optional(),
    aliases: z.array(z.string().regex(/^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/, "must be domain.operation")).default([]),
    summary: translatableText.optional(),
    /** Name of the operation on the docs site (default: derived from the operation id). */
    label: localized.optional(),
    /** Language-agnostic spec in markdown (a string, or one string per line): rules, edge cases, bad-input behaviour. */
    description: translatableMarkdown.optional(),
    /** Links to authoritative sources (official specs, manuals). */
    references: z.array(z.string().url()).default([]),
    level: z.enum(["core", "extended"]).default("extended"),
    params: z.array(ParamSchema).default([]),
    returns: z.string().min(1),
    fallible: z.boolean().optional(),
    network: z.boolean().optional(),
    deprecated: z.boolean().optional(),
    tests: z.array(TestSchema).default([])
  })
  .strict();

export const DomainFileSchema = z
  .object({
    $schema: z.string().optional(),
    domain: identifier,
    /** Short name, for the sidebar and page title. */
    title: z.union([z.string(), localized]).optional(),
    /** One or two sentences: what this is. */
    summary: localized.optional(),
    /** Docs site sidebar group (contract/_categories.json) and position in it. */
    category: z.string().optional(),
    order: z.number().int().optional(),
    /** Domains worth linking from this one. */
    related: z.array(identifier).default([]),
    aliases: z.array(identifier).default([]),
    functions: z.record(identifier, FunctionSchema)
  })
  .strict();

export class ContractError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid contract:\n  - ${problems.join("\n  - ")}`);
  }
}

function toExpectation(t: z.infer<typeof TestSchema>): Expectation {
  if (t.throws) return { kind: "throws" };
  if (t.matches !== undefined) return { kind: "matches", pattern: t.matches };
  if (t.satisfies !== undefined) return { kind: "satisfies", fn: t.satisfies };
  return { kind: "returns", value: t.returns };
}

function defaultFlatName(domain: string, operation: string): string {
  return camel(operation) + pascal(domain);
}

/** Load every `*.json` in the contract dir (files starting with `_` are skipped). */
export function loadContract(dir: string): Contract {
  const problems: string[] = [];
  const contract: Contract = { functions: new Map(), domains: new Map() };
  const categoriesFile = path.join(dir, "_categories.json");
  const categories = fs.existsSync(categoriesFile)
    ? new Set((JSON.parse(fs.readFileSync(categoriesFile, "utf8")) as { categories: Array<{ id: string }> }).categories.map((c) => c.id))
    : undefined;
  const flatNames = new Map<string, string>();

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort();

  for (const file of files) {
    const rel = path.join(path.basename(dir), file);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch (e) {
      problems.push(`${rel}: JSON error: ${(e as Error).message}`);
      continue;
    }
    const parsed = DomainFileSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push(`${rel}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      continue;
    }
    const doc = parsed.data;
    const expectedFile = `${doc.domain}.json`;
    if (file !== expectedFile) problems.push(`${rel}: domain "${doc.domain}" must live in ${expectedFile}`);
    if (contract.domains.has(doc.domain)) problems.push(`${rel}: duplicate domain "${doc.domain}"`);
    const title = typeof doc.title === "string" ? { en: doc.title, "pt-BR": doc.title } : doc.title;
    if (categories && !doc.category) problems.push(`${rel}: "category" is required (one of ${[...categories].join(", ")})`);
    if (categories && doc.category && !categories.has(doc.category)) problems.push(`${rel}: unknown category "${doc.category}" (contract/_categories.json has ${[...categories].join(", ")})`);
    contract.domains.set(doc.domain, {
      title,
      summary: doc.summary,
      category: doc.category,
      order: doc.order,
      related: doc.related,
      aliases: doc.aliases,
      source: rel
    });

    for (const [operation, fn] of Object.entries(doc.functions)) {
      const id = `${doc.domain}.${operation}`;
      const where = `${rel}: ${id}`;
      for (const p of fn.params) {
        try {
          parseCType(p.type);
        } catch (e) {
          problems.push(`${where}: param ${p.name}: ${(e as Error).message}`);
        }
      }
      try {
        parseCType(fn.returns);
      } catch (e) {
        problems.push(`${where}: returns: ${(e as Error).message}`);
      }
      let seenOptional = false;
      for (const p of fn.params) {
        if (p.optional) seenOptional = true;
        else if (seenOptional) problems.push(`${where}: required param "${p.name}" after an optional one`);
      }

      const flatName = fn.flatName ?? defaultFlatName(doc.domain, operation);
      const clash = flatNames.get(flatName);
      if (clash) problems.push(`${where}: flatName "${flatName}" already used by ${clash}`);
      flatNames.set(flatName, id);

      // Test ids must survive vectors being added or removed around them (baselines and
      // knownFailures refer to them): a name if given, else the arguments themselves.
      const ids = new Map<string, number>();
      const tests: ContractTest[] = fn.tests.map((t) => {
        let key = t.name ?? JSON.stringify(t.args);
        const seen = ids.get(key) ?? 0;
        ids.set(key, seen + 1);
        if (seen > 0) key = `${key}~${seen + 1}`;
        return { ...t, key };
      }).map((t) => ({
        id: `${id}#${t.key}`,
        name: t.name,
        args: t.args,
        expect: toExpectation(t),
        repeat: t.repeat,
        note: t.note
      }));
      for (const t of tests) {
        if (t.args.length > fn.params.length) {
          problems.push(`${where}: test ${t.id} passes ${t.args.length} args, function takes ${fn.params.length}`);
        }
        const required = fn.params.filter((p) => !p.optional).length;
        if (t.args.length < required) {
          problems.push(`${where}: test ${t.id} passes ${t.args.length} args, function requires ${required}`);
        }
        if (t.expect.kind === "matches") {
          try {
            new RegExp(t.expect.pattern);
          } catch (e) {
            problems.push(`${where}: test ${t.id}: bad regex: ${(e as Error).message}`);
          }
        }
      }
      if (new Set(fn.tests.filter((t) => t.name).map((t) => t.name)).size !== fn.tests.filter((t) => t.name).length) {
        problems.push(`${where}: duplicate test names`);
      }

      const spellings = [{ domain: doc.domain, operation, flatName }];
      for (const d of doc.aliases) spellings.push({ domain: d, operation, flatName: defaultFlatName(d, operation) });
      for (const alias of fn.aliases) {
        const [d, op] = alias.split(".");
        spellings.push({ domain: d, operation: op, flatName: defaultFlatName(d, op) });
      }
      const entry: ContractFunction = {
        id,
        domain: doc.domain,
        operation,
        flatName,
        spellings,
        summary: fn.summary,
        label: fn.label,
        description: fn.description,
        references: fn.references,
        level: fn.level,
        params: fn.params,
        returns: fn.returns,
        fallible: fn.fallible,
        network: fn.network,
        deprecated: fn.deprecated,
        tests,
        source: rel
      };
      contract.functions.set(id, entry);
    }
  }

  // Cross references.
  for (const [domain, info] of contract.domains) {
    for (const r of info.related) if (!contract.domains.has(r)) problems.push(`${info.source}: related domain "${r}" does not exist (in ${domain})`);
  }
  for (const fn of contract.functions.values()) {
    for (const t of fn.tests) {
      if (t.expect.kind !== "satisfies") continue;
      const target = contract.functions.get(t.expect.fn);
      if (!target) problems.push(`${fn.source}: ${t.id}: satisfies unknown function "${t.expect.fn}"`);
      else if (target.params.filter((p) => !p.optional).length !== 1) {
        problems.push(`${fn.source}: ${t.id}: satisfies target "${t.expect.fn}" must take exactly one required arg`);
      }
    }
  }

  if (problems.length > 0) throw new ContractError(problems);
  return contract;
}
