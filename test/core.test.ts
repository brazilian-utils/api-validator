import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { analyzeLib } from "../src/core/analyze.js";
import { baselineFrom, diffBaseline } from "../src/core/baseline.js";
import { valuesEqual } from "../src/core/conformance.js";
import { ContractError, loadContract } from "../src/core/contract.js";
import { checkParam, checkReturn, format, parseCType, T } from "../src/core/ctype.js";
import { SymbolIndex, resolve, score } from "../src/core/match.js";
import type { ApiSurface, LibConfig, NativeSymbol, RunnerCall } from "../src/core/model.js";
import { lookupKey, snake, words } from "../src/core/naming.js";
import { getAdapter } from "../src/languages/registry.js";
import type { LanguageAdapter } from "../src/languages/types.js";

function tmpContract(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-"));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}

const lib = (over: Partial<LibConfig> = {}): LibConfig => ({
  name: "lib",
  language: "fake",
  entry: ".",
  bindings: {},
  ignore: [],
  waivers: {},
  knownFailures: {},
  options: {},
  source: "libs/lib.yaml",
  ...over
});

describe("canonical types", () => {
  it("parses and prints", () => {
    for (const src of ["string", "string?", "string[]", "(string | number)[]", "1 | 2 | Options", '"a" | "b"', "Address[]?"]) {
      assert.equal(format(parseCType(src)), src);
    }
  });
  it("param: lib must accept what callers may pass", () => {
    assert.equal(checkParam(parseCType("string | number"), T.string).level, "warning");
    assert.equal(checkParam(parseCType("string"), T.integer).level, "error");
    assert.equal(checkParam(parseCType("integer"), T.number).level, "ok");
    assert.equal(checkParam(parseCType("1 | 2"), T.integer).level, "ok");
    assert.equal(checkParam(parseCType("Options"), T.object("Other")).level, "ok"); // named objects are opaque
    assert.equal(checkParam(parseCType("string"), T.unknown).level, "unverified");
  });
  it("return: everything the lib returns must be allowed", () => {
    assert.equal(checkReturn(parseCType("string"), T.nullable(T.string)).level, "warning");
    assert.equal(checkReturn(parseCType("string?"), T.string).level, "warning");
    assert.equal(checkReturn(parseCType("number"), T.integer).level, "ok");
    assert.equal(checkReturn(parseCType("boolean"), T.string).level, "error");
  });
});

describe("naming", () => {
  it("splits identifiers in any convention", () => {
    assert.deepEqual(words("isValidCPF"), ["is", "valid", "cpf"]);
    assert.deepEqual(words("RENAVAMUtils"), ["renavam", "utils"]);
    assert.deepEqual(words("valid_voter_id?"), ["valid", "voter", "id"]);
    assert.equal(snake("getAddressInfoByCep"), "get_address_info_by_cep");
  });
  it("lookup keys ignore case and separators but keep predicates", () => {
    assert.equal(lookupKey("CPFUtils.valid?"), lookupKey("CpfUtils.valid?"));
    assert.notEqual(lookupKey("CpfUtils.valid?"), lookupKey("CpfUtils.valid"));
    assert.equal(lookupKey("cep.GetAddressFromCEP"), lookupKey("cep.get_address_from_cep"));
  });
});

describe("type mapping per language", () => {
  const m = (lang: string, t: string, pos: "param" | "return" = "return") => format(getAdapter(lang).mapType(t, pos, { name: "x", params: [], meta: { module: "m" } }));
  it("maps idiomatic types to canonical ones", () => {
    assert.equal(m("python", "Optional[str]"), "string?");
    assert.equal(m("python", "list[Address] | None"), "Address[]?");
    assert.equal(m("go", "(*Address, error)"), "Address?");
    assert.equal(m("go", "(string, bool)"), "string?");
    assert.equal(m("rust", "Result<Option<String>, CepError>"), "string?");
    assert.equal(m("rust", "&'static str"), "string");
    assert.equal(m("erlang", "{ok, binary()} | {error, invalid}"), "string?");
    assert.equal(m("erlang", "mobile | landline"), '"mobile" | "landline"');
    assert.equal(m("typescript", "Promise<AddressInfo | undefined>"), "AddressInfo?");
    assert.equal(m("ruby", "String, nil".split(", ").join(" | ")), "string?");
    assert.equal(m("dotnet", "string option"), "string?");
  });
});

describe("contract loader", () => {
  it("reports every problem with file and path", () => {
    const dir = tmpContract({
      "cpf.yaml": [
        "domain: cpf",
        "functions:",
        "  isValid:",
        "    params: [{ name: cpf, type: 'strin g' }]",
        "    returns: boolean",
        "  generate:",
        "    returns: string",
        "    tests: [{ args: [], satisfies: cpf.nope }]"
      ].join("\n"),
      "cnpj.yaml": "domain: cnpj\nfunctions:\n  isValid:\n    returns: boolean\n    tests:\n      - { args: [], returns: true, throws: true }\n"
    });
    assert.throws(
      () => loadContract(dir),
      (e: ContractError) =>
        e.problems.some((p) => p.includes("tests.0") && p.includes("exactly one")) &&
        e.problems.some((p) => p.includes("param cpf")) &&
        e.problems.some((p) => p.includes('satisfies unknown function "cpf.nope"'))
    );
  });
  it("derives flat names and alias spellings", () => {
    const dir = tmpContract({
      "legalProcess.yaml": "domain: legalProcess\naliases: [processoJuridico]\nfunctions:\n  isValid:\n    aliases: [lawsuit.check]\n    params: [{ name: v, type: string }]\n    returns: boolean\n"
    });
    const fn = loadContract(dir).functions.get("legalProcess.isValid")!;
    assert.equal(fn.flatName, "isValidLegalProcess");
    assert.deepEqual(fn.spellings.map((s) => s.flatName), ["isValidLegalProcess", "isValidProcessoJuridico", "checkLawsuit"]);
  });
});

// A fake language: symbols are given directly, the runner evaluates JS closures.
function fakeAdapter(impls: Record<string, (...a: unknown[]) => unknown>): LanguageAdapter {
  const base = getAdapter("python");
  return {
    ...base,
    id: "fake",
    extract: async () => ({ symbols: [], warnings: [] }),
    runner: {
      requires: [],
      async run(_ctx, calls: RunnerCall[]) {
        return calls.map((c) => {
          try {
            return { id: c.id, ok: true as const, value: impls[c.symbol.name](...c.args) };
          } catch (e) {
            return { id: c.id, ok: false as const, error: String(e) };
          }
        });
      }
    }
  };
}

const sym = (name: string, params: string[], returns: string, extra: Partial<NativeSymbol> = {}): NativeSymbol => ({
  name,
  params: params.map((p) => ({ name: p.replace("?", "").split(":")[0], type: p.split(":")[1], optional: p.includes("?") })),
  returns,
  ...extra
});

describe("matching", () => {
  const contract = loadContract(
    tmpContract({
      "cpf.yaml": "domain: cpf\nfunctions:\n  isValid:\n    params: [{ name: cpf, type: string }]\n    returns: boolean\n  format:\n    params: [{ name: cpf, type: string }]\n    returns: string\n"
    })
  );
  const isValid = contract.functions.get("cpf.isValid")!;
  const py = getAdapter("python");
  it("finds idiomatic names through conventions, preferring non-deprecated symbols", () => {
    const index = new SymbolIndex([sym("cpf.validate", ["cpf:str"], "bool"), sym("is_valid_cpf", ["cpf:str"], "bool", { deprecated: true }), sym("cpf.is_valid", ["cpf:str"], "bool")]);
    const r = resolve(isValid, lib(), py, index);
    assert.equal(r.overloads[0].name, "cpf.is_valid");
  });
  it("bindings win, and a broken binding is an error", () => {
    const index = new SymbolIndex([sym("cpf.is_valid", ["cpf:str"], "bool"), sym("cpf.check", ["cpf:str"], "bool")]);
    assert.equal(resolve(isValid, lib({ bindings: { "cpf.isValid": "cpf.check" } }), py, index).overloads[0].name, "cpf.check");
    const broken = resolve(isValid, lib({ bindings: { "cpf.isValid": "cpf.gone" } }), py, index);
    assert.equal(broken.overloads.length, 0);
    assert.equal(broken.issues[0].code, "binding-broken");
  });
  it("scores similar names high and other domains low", () => {
    assert.ok(score(isValid, "cpf.validate") > 0.7);
    assert.ok(score(isValid, "cnpj.validate") < 0.5);
  });
});

describe("analysis + conformance (fake lib)", () => {
  const dir = tmpContract({
    "cpf.yaml": [
      "domain: cpf",
      "functions:",
      "  isValid:",
      "    level: core",
      "    params: [{ name: cpf, type: string }]",
      "    returns: boolean",
      "    tests:",
      "      - { args: ['11111111111'], returns: false }",
      "      - { args: ['52998224725'], returns: true }",
      "  format:",
      "    params: [{ name: cpf, type: string }]",
      "    returns: string?",
      "    tests:",
      "      - { args: ['52998224725'], returns: '529.982.247-25' }",
      "      - { args: ['x'], returns: null }",
      "  generate:",
      "    params: []",
      "    returns: string",
      "    tests: [{ args: [], satisfies: cpf.isValid, repeat: 3 }]",
      "  parse:",
      "    params: [{ name: v, type: string }]",
      "    returns: string"
    ].join("\n")
  });
  const contract = loadContract(dir);
  const impls = {
    "cpf.is_valid": (c: unknown) => c === "52998224725",
    "cpf.format_cpf": (c: unknown) => (c === "x" ? "" : "529.982.247-25"), // bug: "" instead of null
    "cpf.generate": () => "52998224725",
    "cpf.gerar_parse": (c: unknown) => c
  };
  const surface: ApiSurface = {
    library: "lib",
    language: "fake",
    warnings: [],
    symbols: [
      sym("cpf.is_valid", ["cpf:str"], "bool"),
      sym("cpf.format_cpf", ["cpf:str"], "str | None"),
      sym("cpf.generate", [], "str"),
      sym("cpf.parse_digits", ["v:str"], "str")
    ]
  };

  it("classifies ok / failing / missing with suggestions, and runs satisfies checks", async () => {
    const report = await analyzeLib({ contract, adapter: fakeAdapter(impls), ctx: { lib: lib(), root: "/", workDir: "/tmp" }, surface, runTests: true });
    const by = new Map(report.functions.map((f) => [f.id, f]));
    assert.equal(by.get("cpf.isValid")?.status, "ok");
    assert.equal(by.get("cpf.generate")?.status, "ok");
    assert.equal(by.get("cpf.format")?.status, "failing");
    assert.match(by.get("cpf.format")!.tests.find((t) => t.status === "fail")!.message!, /expected null, got ""/);
    assert.equal(by.get("cpf.parse")?.status, "missing");
    assert.equal(by.get("cpf.parse")?.suggestions[0]?.symbol, "cpf.parse_digits");
    assert.equal(report.unmapped[0].symbol, "cpf.parse_digits");
    assert.equal(report.summary.testsPassed, 4);
    assert.equal(report.summary.testsFailed, 1);
  });

  it("knownFailures are reported but not counted as failures", async () => {
    const report = await analyzeLib({
      contract,
      adapter: fakeAdapter(impls),
      ctx: { lib: lib({ knownFailures: { "cpf.format#1": "returns '' by design" } }), root: "/", workDir: "/tmp" },
      surface,
      runTests: true
    });
    assert.equal(report.functions.find((f) => f.id === "cpf.format")?.status, "ok");
  });

  it("baseline: only regressions fail", async () => {
    const good = await analyzeLib({ contract, adapter: fakeAdapter(impls), ctx: { lib: lib(), root: "/", workDir: "/tmp" }, surface, runTests: true });
    const baseline = baselineFrom(good);
    assert.deepEqual(diffBaseline(good, baseline).regressions, []);
    const broken = { ...impls, "cpf.is_valid": () => true };
    const bad = await analyzeLib({ contract, adapter: fakeAdapter(broken), ctx: { lib: lib(), root: "/", workDir: "/tmp" }, surface, runTests: true });
    assert.deepEqual(diffBaseline(bad, baseline).regressions.map((r) => r.id), ["cpf.isValid#0"]);
  });

  it("baseline: new public API outside the contract is a regression (contract-first)", async () => {
    const good = await analyzeLib({ contract, adapter: fakeAdapter(impls), ctx: { lib: lib(), root: "/", workDir: "/tmp" }, surface, runTests: false });
    const baseline = baselineFrom(good);
    const grown = { ...surface, symbols: [...surface.symbols, sym("cpf.mask", ["v:str"], "str")] };
    const now = await analyzeLib({ contract, adapter: fakeAdapter(impls), ctx: { lib: lib(), root: "/", workDir: "/tmp" }, surface: grown, runTests: false });
    const r = diffBaseline(now, baseline).regressions;
    assert.deepEqual(r.map((x) => [x.kind, x.id]), [["surface", "cpf.mask"]]);
  });
});

describe("value comparison", () => {
  it("compares objects across naming conventions and treats absent as null", () => {
    assert.ok(valuesEqual({ zipCode: "1", street: null }, { zip_code: "1" }));
    assert.ok(valuesEqual([1, 2.0000000001], [1, 2]));
    assert.ok(!valuesEqual({ a: 1 }, { a: 2 }));
    assert.ok(!valuesEqual(null, ""));
  });
});
