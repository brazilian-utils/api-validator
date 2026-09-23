/**
 * The contract's test vectors as plain JSON, one file per domain: the shared conformance
 * suite every lib runs with its own small harness (the pattern of JSON-Schema-Test-Suite or
 * the WHATWG URL tests). The suite knows nothing about any language; a lib's harness maps
 * contract function ids to its functions and compares results with the rules below.
 *
 *   cases/index.json         domains, counts, digest, the comparison rules
 *   cases/<domain>.json      functions with signature, summary and cases
 *   cases/equality.json      self-test for a harness's comparison function
 *   cases.schema.json        JSON Schema of the domain files
 *
 * Each lib vendors the files (plus its own `skip.json`), refreshed by `export-cases`
 * (a nightly bot PR); `export-cases --check` tells when the copy is stale.
 */
import crypto from "node:crypto";
import type { Baseline } from "./baseline.js";
import type { Contract, ContractFunction, ContractTest, LibConfig } from "./model.js";

export const CASES_FORMAT = 1;

export interface CaseJson {
  id: string;
  args: unknown[];
  expect: { returns: unknown } | { throws: true } | { matches: string } | { satisfies: string };
  repeat?: number;
  note?: string;
}

export interface FunctionJson {
  id: string;
  level: "core" | "extended";
  summary?: string;
  description?: string;
  params: Array<{ name: string; type: string; optional?: boolean }>;
  returns: string;
  network?: boolean;
  deprecated?: boolean;
  cases: CaseJson[];
}

export interface DomainJson {
  $schema: string;
  format: number;
  domain: string;
  title?: string;
  functions: FunctionJson[];
}

export const COMPARISON_RULES = [
  "returns: the result equals the value. Numbers: |a - b| <= 1e-9 * max(1, |a|). Objects: keys compared after lowercasing and removing every character that is not a-z or 0-9 (zipCode == zip_code == ZipCode); a null field equals an absent one. Arrays: same length, element-wise.",
  "returns null: the idiomatic 'no result' (null, None, nil, Option::None, undefined, an Erlang {error, _}).",
  "throws: the call fails the idiomatic way (exception, Err, (T, error) with error, {error, _}).",
  "matches: the result is a string matching the regular expression (ECMAScript syntax; the suite only uses the subset common to PCRE, RE2, Onigmo and .NET; results never contain line breaks, so ^ and $ mean start and end of the string).",
  "satisfies: calling the named contract function with the result returns true (skip the case when the lib does not implement that function).",
  "repeat: run the case that many times (generators); every run must pass.",
  "Results are compared in their JSON form: dates as ISO-8601 strings, enums as their value, structs/records/maps as objects, tuples/sets as arrays."
];

function caseJson(t: ContractTest): CaseJson {
  const e = t.expect;
  const expect: CaseJson["expect"] =
    e.kind === "returns" ? { returns: e.value ?? null } : e.kind === "throws" ? { throws: true } : e.kind === "matches" ? { matches: e.pattern } : { satisfies: e.fn };
  return { id: t.id, args: t.args, expect, ...(t.repeat > 1 ? { repeat: t.repeat } : {}), ...(t.note ? { note: t.note } : {}) };
}

function functionJson(f: ContractFunction): FunctionJson {
  return {
    id: f.id,
    level: f.level,
    ...(f.summary ? { summary: f.summary } : {}),
    ...(f.description ? { description: f.description } : {}),
    params: f.params.map((p) => ({ name: p.name, type: p.type, ...(p.optional ? { optional: true } : {}) })),
    returns: f.returns,
    ...(f.network ? { network: true } : {}),
    ...(f.deprecated ? { deprecated: true } : {}),
    cases: f.tests.map(caseJson)
  };
}

export function domainFiles(contract: Contract): Map<string, DomainJson> {
  const out = new Map<string, DomainJson>();
  for (const [domain, info] of [...contract.domains].sort(([a], [b]) => a.localeCompare(b))) {
    const functions = [...contract.functions.values()].filter((f) => f.domain === domain).sort((a, b) => a.id.localeCompare(b.id));
    out.set(domain, {
      $schema: "../cases.schema.json",
      format: CASES_FORMAT,
      domain,
      ...(info.title ? { title: info.title } : {}),
      functions: functions.map(functionJson)
    });
  }
  return out;
}

/** Pairs a harness's comparison function must judge like the validator does. */
const EQUALITY_PAIRS: Array<{ expected: unknown; actual: unknown; equal: boolean; why: string }> = [
  { expected: "a", actual: "a", equal: true, why: "same string" },
  { expected: "a", actual: "A", equal: false, why: "strings are case-sensitive" },
  { expected: 1, actual: 1.0000000001, equal: true, why: "numbers within 1e-9" },
  { expected: 1, actual: 1.001, equal: false, why: "numbers beyond 1e-9" },
  { expected: 12.34, actual: 12.34, equal: true, why: "decimals" },
  { expected: true, actual: 1, equal: false, why: "booleans are not numbers" },
  { expected: 1, actual: true, equal: false, why: "numbers are not booleans" },
  { expected: 1, actual: 1.0, equal: true, why: "integer and float of the same value" },
  { expected: [true], actual: [1], equal: false, why: "booleans are not numbers inside arrays" },
  { expected: { a: false }, actual: { a: 0 }, equal: false, why: "booleans are not numbers inside objects" },
  { expected: "1", actual: 1, equal: false, why: "strings are not numbers" },
  { expected: null, actual: null, equal: true, why: "null" },
  { expected: null, actual: "", equal: false, why: "empty string is a value, not null" },
  { expected: [1, 2], actual: [1, 2], equal: true, why: "arrays element-wise" },
  { expected: [1, 2], actual: [2, 1], equal: false, why: "array order matters" },
  { expected: { zipCode: "01310-200" }, actual: { zip_code: "01310-200" }, equal: true, why: "keys: case and separators ignored" },
  { expected: { zipCode: "1", city: null }, actual: { ZIP_CODE: "1" }, equal: true, why: "null field equals absent field" },
  { expected: { zipCode: "1" }, actual: { zipCode: "1", city: "SP" }, equal: false, why: "extra non-null field" },
  { expected: { a: { bB: [1] } }, actual: { A: { b_b: [1] } }, equal: true, why: "nested keys" }
];

/** Pairs a harness's comparison function must judge like the validator does, with stable ids. */
export const EQUALITY_SELF_TEST = EQUALITY_PAIRS.map((p) => ({ id: `equality#${p.why.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`, ...p }));

export function digestOf(files: Map<string, DomainJson>): string {
  return crypto.createHash("sha256").update(JSON.stringify([...files])).digest("hex").slice(0, 16);
}

export function indexJson(contract: Contract, files: Map<string, DomainJson>) {
  const fns = [...files.values()].flatMap((d) => d.functions);
  return {
    format: CASES_FORMAT,
    generatedBy: "brazilian-utils/api-validator from contract/*.yaml. Do not edit: change the contract.",
    digest: digestOf(files),
    functions: fns.length,
    cases: fns.reduce((n, f) => n + f.cases.length, 0),
    domains: [...files.keys()],
    files: [...files.keys()].map((d) => `${d}.json`),
    comparison: COMPARISON_RULES
  };
}

/** Latest outcome of each case in a lib (from its report), to explain skips. */
export type Outcomes = Map<string, { status: string; message?: string }>;

/**
 * Cases a lib is not expected to pass yet, with the reason (its harness skips them): known
 * failures, and cases outside the lib's baseline — explained with the latest failure message
 * when a report is available. Cases the harness skips by itself (a `satisfies` target the lib
 * lacks) are not listed.
 */
export function skipsFor(lib: LibConfig, contract: Contract, implemented: Set<string>, baseline?: Baseline, outcomes?: Outcomes): Record<string, string> {
  const passing = baseline && baseline.tests.length ? new Set(baseline.tests) : undefined;
  const out: Record<string, string> = {};
  for (const f of [...contract.functions.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!implemented.has(f.id)) continue;
    for (const t of f.tests) {
      if (t.expect.kind === "satisfies" && !implemented.has(t.expect.fn)) continue;
      const known = lib.knownFailures[t.id] ?? lib.knownFailures[f.id];
      const last = outcomes?.get(t.id);
      const detail = last && last.status !== "pass" && last.message ? `: ${last.message.replace(/ \[known: .*\]$/, "")}` : "";
      if (known) out[t.id] = `known failure: ${known}`;
      else if (passing && !passing.has(t.id)) {
        out[t.id] =
          last?.status === "skip"
            ? `not verified by the api-validator runner (${last.message ?? "unsupported"})`
            : `fails today${detail || " (not in the api-validator baseline)"}`;
      }
    }
  }
  return out;
}

export const CASES_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "cases.schema.json",
  title: "brazilian-utils contract cases (one domain)",
  type: "object",
  required: ["format", "domain", "functions"],
  properties: {
    $schema: { type: "string" },
    format: { const: CASES_FORMAT },
    domain: { type: "string" },
    title: { type: "string" },
    functions: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "level", "params", "returns", "cases"],
        properties: {
          id: { type: "string", pattern: "^[a-z][A-Za-z0-9]*\\.[a-z][A-Za-z0-9]*$" },
          level: { enum: ["core", "extended"] },
          summary: { type: "string" },
          description: { type: "string" },
          params: {
            type: "array",
            items: { type: "object", required: ["name", "type"], properties: { name: { type: "string" }, type: { type: "string" }, optional: { type: "boolean" } } }
          },
          returns: { type: "string" },
          network: { type: "boolean" },
          deprecated: { type: "boolean" },
          cases: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "args", "expect"],
              properties: {
                id: { type: "string" },
                args: { type: "array" },
                expect: {
                  oneOf: [
                    { type: "object", required: ["returns"], properties: { returns: {} }, additionalProperties: false },
                    { type: "object", required: ["throws"], properties: { throws: { const: true } }, additionalProperties: false },
                    { type: "object", required: ["matches"], properties: { matches: { type: "string" } }, additionalProperties: false },
                    { type: "object", required: ["satisfies"], properties: { satisfies: { type: "string" } }, additionalProperties: false }
                  ]
                },
                repeat: { type: "integer", minimum: 2 },
                note: { type: "string" }
              },
              additionalProperties: false
            }
          }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
};

/** Every file of the suite, as path (relative to the suite dir) -> JSON value. */
export function suiteFiles(contract: Contract): Map<string, unknown> {
  const files = domainFiles(contract);
  const out = new Map<string, unknown>();
  out.set("cases.schema.json", CASES_SCHEMA);
  out.set("cases/index.json", indexJson(contract, files));
  out.set("cases/equality.json", EQUALITY_SELF_TEST);
  for (const [d, json] of files) out.set(`cases/${d}.json`, json);
  return out;
}

export const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
