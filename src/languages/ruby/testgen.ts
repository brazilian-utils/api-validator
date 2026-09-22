/**
 * Contract tests as an RSpec file (the Ruby lib's framework), `spec/api_contract_spec.rb`,
 * loaded through the lib's own `spec_helper`. One `describe <Module>, '.method'` per
 * function, one example per contract test.
 *
 * Calls mirror runner.rb: symbols resolve under the lib's root namespace (`options.namespace`,
 * else the single root module the loader finds), args are passed positionally as the
 * JSON-parsed values the runner gets (string-keyed hashes, Integer/Float), errors are any
 * StandardError. Structured results are compared after the runner's own normalisation
 * (`ApiValidatorLoader.to_json_value`, embedded verbatim from loader.rb) with valuesEqual's
 * rules (keys case/separator-insensitive, null field == absent, numbers within 1e-9).
 */
import fs from "node:fs";
import path from "node:path";
import type { ExportCase, ExportGroup, Rendered, Unexpressible } from "../../core/testgen.js";
import type { NativeSymbol } from "../../core/model.js";
import { LANGUAGES_DIR } from "../../core/paths.js";
import { runOrThrow } from "../../core/shell.js";
import type { AdapterContext, TestGenerator } from "../types.js";

export class Unexpressed extends Error {}

const SIMPLE_SQ = /^[^\x00-\x1f\x7f]*$/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** String -> Ruby literal: single-quoted when plain (the lib's style), else double-quoted escapes. */
export function rbString(s: string): string {
  if (LONE_SURROGATE.test(s)) throw new Unexpressed(`string ${JSON.stringify(s)} is not valid UTF-8`);
  if (SIMPLE_SQ.test(s)) {
    if (s.includes("'") && !/["\\#]/.test(s)) return `"${s}"`;
    return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }
  // JSON escapes (\n \t \" \\ \uXXXX ...) are valid in a Ruby double-quoted string; `#` must not interpolate.
  return JSON.stringify(s).replace(/#/g, "\\#");
}

/** JSON value -> Ruby literal of what runner.rb passes after JSON.parse. */
export function rbLiteral(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Unexpressed(`number ${v} is not JSON`);
    // Same spelling JSON.stringify sends the runner (1, 1.5, 1e+21), and Ruby reads it as the same Integer/Float.
    return String(v);
  }
  if (typeof v === "string") return rbString(v);
  if (Array.isArray(v)) return `[${v.map(rbLiteral).join(", ")}]`;
  const entries = Object.entries(v as Record<string, unknown>);
  return entries.length ? `{ ${entries.map(([k, x]) => `${rbString(k)} => ${rbLiteral(x)}`).join(", ")} }` : "{}";
}

/**
 * JS regex -> Ruby regex literal. Ruby's `^`/`$` are line anchors, JS's (without /m) are
 * string anchors: rewritten to `\A`/`\z` outside character classes.
 */
export function rbRegex(pattern: string): string {
  let out = "";
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\") {
      out += ch + (pattern[i + 1] ?? "");
      i++;
      continue;
    }
    if (inClass) {
      if (ch === "]") inClass = false;
      out += ch === "/" ? "\\/" : ch === "#" ? "\\#" : ch;
      continue;
    }
    if (ch === "[") {
      inClass = true;
      out += ch;
      if (pattern[i + 1] === "^") out += pattern[++i];
      if (pattern[i + 1] === "]") out += pattern[++i];
      continue;
    }
    out += ch === "^" ? "\\A" : ch === "$" ? "\\z" : ch === "/" ? "\\/" : ch === "#" ? "\\#" : ch;
  }
  return `/${out}/`;
}

const rootCache = new Map<string, string>();

/**
 * The module runner.rb resolves symbols against: `options.namespace`, else the single root
 * module the loader finds (symbols then carry no root prefix), else none (symbols are
 * prefixed with their root already).
 */
function rootModule(ctx: AdapterContext): string {
  const ns = ctx.lib.options.namespace;
  if (typeof ns === "string") return ns;
  const key = `${ctx.root}\0${ctx.lib.entry}`;
  if (!rootCache.has(key)) {
    const out = runOrThrow(
      "ruby",
      ["-r", path.join(LANGUAGES_DIR, "ruby", "loader.rb"), "-e", "r, _ = ApiValidatorLoader.load(*ARGV); puts(r.size == 1 ? r.first.name : '')", ctx.root, ctx.lib.entry],
      { cwd: ctx.root, env: { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } }
    );
    rootCache.set(key, out.trim());
  }
  return rootCache.get(key)!;
}

interface Ref {
  owner: string;
  method: string;
}

function refOf(symbol: NativeSymbol, root: string): Ref {
  const parts = symbol.name.split(".");
  const method = parts.pop()!;
  const owner = [root, ...parts].filter(Boolean).join("::");
  if (!owner) throw new Unexpressed(`${symbol.name} has no owner module`);
  return { owner, method };
}

function callOf(ref: Ref, args: string[]): string {
  const list = args.join(", ");
  // Setters and operators cannot be called with plain dot syntax.
  if (/^[a-z_][A-Za-z0-9_]*[?!]?$/.test(ref.method)) return `${ref.owner}.${ref.method}${args.length ? `(${list})` : ""}`;
  return `${ref.owner}.public_send(${[`:${JSON.stringify(ref.method)}`, ...args].join(", ")})`;
}

/** Scalars whose Ruby `==`/identity agrees with valuesEqual after normalisation. */
function body(c: ExportCase, call: string, root: string): string[] {
  const e = c.expect;
  switch (e.kind) {
    case "returns": {
      const v = e.value;
      if (v === null || v === undefined) return [`expect(${call}).to be_nil`];
      if (typeof v === "boolean") return [`expect(${call}).to be(${v})`];
      if (typeof v === "string" || (typeof v === "number" && Number.isInteger(v))) return [`expect(${call}).to eq(${rbLiteral(v)})`];
      return [`expect(${call}).to eq_contract(${rbLiteral(v)})`];
    }
    case "throws":
      return [`expect { ${call} }.to raise_error(StandardError)`];
    case "matches":
      return [`expect(${call}).to match(${rbRegex(e.pattern)})`];
    case "satisfies": {
      const target = callOf(refOf(c.target!, root), ["ApiContract.json(value)"]);
      return [`value = ${call}`, `expect(${target}).to be(true), "#{value.inspect} does not satisfy ${e.fn}"`];
    }
  }
}

/** `ApiValidatorLoader.to_json_value`, copied from loader.rb so both normalise identically. */
function toJsonValueSource(): string[] {
  const src = fs.readFileSync(path.join(LANGUAGES_DIR, "ruby", "loader.rb"), "utf8").split("\n");
  const start = src.findIndex((l) => l.startsWith("  def self.to_json_value("));
  const end = src.findIndex((l, i) => i > start && l === "  end");
  if (start < 0 || end < 0) throw new Error("loader.rb: to_json_value not found");
  return src.slice(start, end + 1).map((l) => l.replace(/to_json_value/g, "json"));
}

const comment = (s: string) => s.replace(/\s+/g, " ").trim();

function render(ctx: AdapterContext, groups: ExportGroup[], header: string[]): Rendered {
  const unexpressible: Unexpressible[] = [];
  const root = rootModule(ctx);
  const out: string[] = [
    ...header.map((h) => `# ${h}`.trimEnd()),
    "",
    "require 'spec_helper'",
    "",
    "# Results are compared like api-validator does: as JSON values, object keys",
    "# case/separator-insensitive, nil fields equal to absent ones, numbers within 1e-9.",
    "module ApiContract",
    ...toJsonValueSource(),
    "",
    "  def self.key(k) = k.to_s.sub(/[?!=]+\\z/, '').gsub(/[^a-zA-Z0-9]/, '').downcase",
    "",
    "  def self.same?(expected, actual)",
    "    case expected",
    "    when nil then actual.nil?",
    "    when Integer, Float",
    "      actual.is_a?(Numeric) && (expected - actual).abs <= 1e-9 * [1, expected.abs].max",
    "    when Array",
    "      actual.is_a?(Array) && actual.size == expected.size && expected.zip(actual).all? { |e, a| same?(e, a) }",
    "    when Hash",
    "      return false unless actual.is_a?(Hash)",
    "      e = expected.to_h { |k, v| [key(k), v] }",
    "      a = actual.to_h { |k, v| [key(k), v] }",
    "      (e.keys | a.keys).all? { |k| same?(e[k], a[k]) }",
    "    else expected == actual",
    "    end",
    "  end",
    "end",
    "",
    "RSpec::Matchers.define :eq_contract do |expected|",
    "  match { |actual| ApiContract.same?(expected, ApiContract.json(actual)) }",
    "  failure_message { |actual| \"expected #{expected.inspect}, got #{ApiContract.json(actual).inspect}\" }",
    "end"
  ];
  for (const g of groups) {
    let ref: Ref;
    try {
      ref = refOf(g.symbol, root);
    } catch (err) {
      out.push("", `# ${g.fnId}: not expressible: ${(err as Error).message}`);
      for (const c of g.cases) unexpressible.push({ id: c.id, reason: (err as Error).message });
      continue;
    }
    out.push("", `# ${g.fnId} -> ${g.symbol.name}`, `RSpec.describe ${ref.owner}, ${rbString(`.${ref.method}`)} do`);
    g.cases.forEach((c, i) => {
      let lines: string[];
      try {
        lines = body(c, callOf(ref, c.args.map(rbLiteral)), root);
      } catch (err) {
        if (!(err instanceof Unexpressed)) throw err;
        if (i > 0) out.push("");
        out.push(`  # ${c.id}: not expressible in Ruby: ${comment(err.message)}`);
        unexpressible.push({ id: c.id, reason: err.message });
        return;
      }
      if (i > 0) out.push("");
      out.push(`  # ${c.id}${c.note ? `: ${comment(c.note)}` : ""}`);
      out.push(`  it ${rbString(c.slug.join(" "))}${c.skip ? `, skip: ${rbString(c.skip)}` : ""} do`);
      if (c.repeat > 1) out.push(`    ${c.repeat}.times do`, ...lines.map((l) => `      ${l}`), "    end");
      else out.push(...lines.map((l) => `    ${l}`));
      out.push("  end");
    });
    out.push("end");
  }
  return { content: out.join("\n") + "\n", unexpressible };
}

export const rubyTestgen: TestGenerator = {
  framework: "RSpec",
  path: () => "spec/api_contract_spec.rb",
  command: (ctx) => `${fs.existsSync(path.join(ctx.root, "Gemfile")) ? "bundle exec " : ""}rspec spec/api_contract_spec.rb`,
  render
};
