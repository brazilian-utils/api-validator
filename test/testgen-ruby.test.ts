import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runConformance, type Bound } from "../src/core/conformance.js";
import type { ContractFunction, ContractTest, Expectation, LibConfig, NativeSymbol } from "../src/core/model.js";
import { run } from "../src/core/shell.js";
import { exportCases, headerLines, type ExportCase, type ExportGroup } from "../src/core/testgen.js";
import { ruby } from "../src/languages/ruby/index.js";
import { rbLiteral, rbRegex, rbString } from "../src/languages/ruby/testgen.js";

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "ruby");
const gen = ruby.testgen!;

const lib = (options: Record<string, unknown> = { namespace: "BrazilianUtils" }, knownFailures: Record<string, string> = {}): LibConfig => ({
  name: "lib",
  language: "ruby",
  entry: "lib",
  bindings: {},
  ignore: [],
  waivers: {},
  knownFailures,
  options,
  source: ""
});
const ctx = (l = lib()) => ({ lib: l, root: FIXTURE, workDir: os.tmpdir() });
const sym = (name: string): NativeSymbol => ({ name, params: [] }) as unknown as NativeSymbol;

function one(expect: Expectation, extra: Partial<ExportCase> = {}): string {
  const c: ExportCase = { id: "cpf.isValid#x", fnId: "cpf.isValid", slug: ["x"], symbol: sym("CPFUtils.valid?"), args: ["1"], expect, repeat: 1, ...extra };
  return gen.render(ctx(), [{ fnId: c.fnId, symbol: c.symbol, cases: [c] }], ["hdr"]).content;
}

describe("ruby testgen: literals", () => {
  it("strings, numbers, hashes", () => {
    assert.equal(rbString("abc"), "'abc'");
    assert.equal(rbString("it's"), `"it's"`);
    assert.equal(rbString("a\\'#{x}"), `'a\\\\\\'#{x}'`);
    assert.equal(rbString("a\n#{x}"), `"a\\n\\#{x}"`);
    assert.equal(rbLiteral([1, 1.5, null, true, { zip_code: "1" }, {}]), "[1, 1.5, nil, true, { 'zip_code' => '1' }, {}]");
  });
  it("regexes: JS string anchors become \\A / \\z, not inside classes", () => {
    assert.equal(rbRegex("^\\d{3}[$^/]x/$"), "/\\A\\d{3}[$^\\/]x\\/\\z/");
    assert.equal(rbRegex("a#{b}\\$"), "/a\\#{b}\\$/");
  });
});

describe("ruby testgen: rendering", () => {
  it("header, spec_helper and one describe per function", () => {
    const out = one({ kind: "returns", value: true }, { note: "a\nnote" });
    assert.match(out, /^# hdr\n\nrequire 'spec_helper'\n/);
    assert.match(out, /# cpf\.isValid -> CPFUtils\.valid\?\nRSpec\.describe BrazilianUtils::CPFUtils, '\.valid\?' do\n  # cpf\.isValid#x: a note\n  it 'x' do\n/);
    assert.match(out, /expect\(BrazilianUtils::CPFUtils\.valid\?\('1'\)\)\.to be\(true\)/);
  });
  it("each expectation kind", () => {
    assert.match(one({ kind: "returns", value: null }), /expect\(BrazilianUtils::CPFUtils\.valid\?\('1'\)\)\.to be_nil/);
    assert.match(one({ kind: "returns", value: "1.2" }), /\.to eq\('1\.2'\)/);
    assert.match(one({ kind: "returns", value: 3 }), /\.to eq\(3\)/);
    assert.match(one({ kind: "returns", value: 1.5 }), /\.to eq_contract\(1\.5\)/);
    assert.match(one({ kind: "returns", value: { zipCode: "1" } }), /\.to eq_contract\(\{ 'zipCode' => '1' \}\)/);
    assert.match(one({ kind: "throws" }), /expect \{ BrazilianUtils::CPFUtils\.valid\?\('1'\) \}\.to raise_error\(StandardError\)/);
    assert.match(one({ kind: "matches", pattern: "^\\d+$" }), /\.to match\(\/\\A\\d\+\\z\/\)/);
    const sat = one({ kind: "satisfies", fn: "cpf.isValid" }, { symbol: sym("CPFUtils.generate"), args: [], target: sym("CPFUtils.valid?") });
    assert.match(sat, /value = BrazilianUtils::CPFUtils\.generate\n    expect\(BrazilianUtils::CPFUtils\.valid\?\(ApiContract\.json\(value\)\)\)\.to be\(true\)/);
  });
  it("skip and repeat", () => {
    const out = one({ kind: "returns", value: true }, { skip: "known failure: bug", repeat: 3 });
    assert.match(out, /it 'x', skip: 'known failure: bug' do\n    3\.times do\n      expect\(.*\)\.to be\(true\)\n    end\n  end/);
  });
  it("unexpressible cases become a comment", () => {
    const c: ExportCase = { id: "cpf.isValid#bad", fnId: "cpf.isValid", slug: ["bad"], symbol: sym("CPFUtils.valid?"), args: ["\uD800"], expect: { kind: "returns", value: true }, repeat: 1 };
    const r = gen.render(ctx(), [{ fnId: c.fnId, symbol: c.symbol, cases: [c] }], []);
    assert.deepEqual(r.unexpressible.map((u) => u.id), ["cpf.isValid#bad"]);
    assert.match(r.content, /  # cpf\.isValid#bad: not expressible in Ruby: string "\\ud800" is not valid UTF-8\nend/);
    assert.doesNotMatch(r.content, /it 'bad'/);
  });
  it("is deterministic, and the path/command are the lib's", () => {
    assert.equal(one({ kind: "throws" }), one({ kind: "throws" }));
    assert.equal(gen.path(ctx()), "spec/api_contract_spec.rb");
    assert.equal(gen.command(ctx()), "rspec spec/api_contract_spec.rb");
  });
});

const hasRspec = run("ruby", ["-e", "require 'rspec/core'"]).status === 0;

describe("ruby testgen: fixture", () => {
  it("native RSpec results match the validator", { skip: !hasRspec && "no ruby/rspec" }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "testgen-ruby-"));
    fs.cpSync(FIXTURE, dir, { recursive: true });
    // No namespace: the root module (Demo) is found the way the runner finds it.
    const l = lib({}, { "cpf.format#known": "demo bug" });
    const c = { lib: l, root: dir, workDir: dir };
    const { symbols } = await ruby.extract(c);
    const byName = new Map(symbols.map((s) => [s.name, s]));
    const t = (fnId: string, name: string, args: unknown[], expect: Expectation, repeat = 1): ContractTest => ({ id: `${fnId}#${name}`, name, args, expect, repeat });
    const fn = (id: string, symbol: string, tests: ContractTest[]): Bound => ({
      fn: { id, domain: "cpf", operation: id.split(".")[1], flatName: id, spellings: [], level: "core", params: [], returns: "any", tests, source: "" } as ContractFunction,
      symbol: byName.get(symbol)!
    });
    const bound = [
      fn("cpf.isValid", "CPFUtils.valid?", [
        t("cpf.isValid", "eleven", ["12345678901"], { kind: "returns", value: true }),
        t("cpf.isValid", "one", ["1"], { kind: "returns", value: false }),
        t("cpf.isValid", "no-args", [], { kind: "throws" }),
        t("cpf.isValid", "no-args-returns", [], { kind: "returns", value: true })
      ]),
      fn("cpf.format", "CPFUtils.format_cpf", [
        t("cpf.format", "same", ["x"], { kind: "returns", value: "x" }),
        t("cpf.format", "nil", [null], { kind: "returns", value: null }),
        t("cpf.format", "hash", [{ zip_code: 1, other: null }], { kind: "returns", value: { zipCode: 1 } }),
        t("cpf.format", "hash-differs", [{ zip_code: 1 }], { kind: "returns", value: { zipCode: 2 } }),
        t("cpf.format", "float", [1.5000000000001], { kind: "returns", value: 1.5 }),
        t("cpf.format", "list", [[1, "a"]], { kind: "returns", value: [1, "a"] }),
        t("cpf.format", "quotes", ["it's #{x}\n"], { kind: "returns", value: "it's #{x}\n" }),
        t("cpf.format", "anchored", ["abc\nx"], { kind: "matches", pattern: "^abc$" }),
        t("cpf.format", "hash-sign", ["a#b/c"], { kind: "matches", pattern: "^a#b/c$" }),
        t("cpf.format", "known", ["x"], { kind: "returns", value: "y" }),
        t("cpf.format", "lone", ["\uD800"], { kind: "returns", value: "x" })
      ]),
      fn("cpf.generate", "CPFUtils.generate", [
        t("cpf.generate", "valid", [], { kind: "satisfies", fn: "cpf.isValid" }, 3),
        t("cpf.generate", "digits", [], { kind: "matches", pattern: "^\\d{11}$" })
      ])
    ];
    const boundById = new Map(bound.map((b) => [b.fn.id, b.symbol]));
    const groups: ExportGroup[] = exportCases(bound, boundById, l);
    const rendered = gen.render(c, groups, headerLines(l, groups, gen.command(c)));
    assert.deepEqual(rendered.unexpressible.map((u) => u.id), ["cpf.format#lone"]);
    fs.writeFileSync(path.join(dir, gen.path(c)), rendered.content);

    const r = run("ruby", ["-e", "require 'rspec/core'; exit RSpec::Core::Runner.run(ARGV)", "--", "--format", "json", gen.path(c)], { cwd: dir });
    const json = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))) as { examples: Array<{ description: string; status: string }> };
    const native = new Map(json.examples.map((e) => [e.description, e.status]));

    // (the lone surrogate is not valid JSON for the Ruby runner either)
    const validator = new Map(
      [...(await runConformance(bound, boundById, l, ruby, c, (x) => !x.id.endsWith("#lone"))).values()].flat().map((o) => [o.id.split("#")[1], o.status])
    );
    const expected = new Map<string, string>();
    for (const [name, status] of validator) {
      expected.set(name.replace(/-/g, " "), status === "pass" ? "passed" : status === "known-failure" ? "pending" : "failed");
    }
    assert.deepEqual(Object.fromEntries(native), Object.fromEntries(expected));
    assert.deepEqual(
      [...native].filter(([, s]) => s === "failed").map(([n]) => n).sort(),
      ["anchored", "hash differs", "no args returns"]
    );
  });
});
