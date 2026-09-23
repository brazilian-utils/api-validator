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
import type { ApiSurface, LibConfig, NativeSymbol, RunnerCall, TypeNode } from "../src/core/model.js";
import { lookupKey, snake, words } from "../src/core/naming.js";
import { getAdapter } from "../src/languages/registry.js";
import type { LanguageAdapter } from "../src/languages/types.js";

function tmpContract(files: Record<string, object>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-"));
  for (const [name, doc] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), JSON.stringify(doc));
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
  source: "libs/lib.json",
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
    assert.equal(checkParam(parseCType("string"), T.union(T.literal("SP"), T.literal("RJ"))).level, "warning"); // narrower
  });
  it("return: everything the lib returns must be allowed", () => {
    assert.equal(checkReturn(parseCType("string"), T.nullable(T.string)).level, "warning");
    assert.equal(checkReturn(parseCType("string?"), T.string).level, "warning");
    assert.equal(checkReturn(parseCType("number"), T.integer).level, "ok");
    assert.equal(checkReturn(parseCType("boolean"), T.string).level, "error");
    assert.equal(checkReturn(parseCType("string"), T.any).level, "unverified"); // `Any` claims nothing
    assert.notEqual(checkReturn(parseCType("string[]"), T.list(T.nullable(T.string))).level, "ok"); // nested null
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

// Structured native types, as the extractors report them.
const n = (name: string, ...args: TypeNode[]): TypeNode => (args.length ? { kind: "name", name, args } : { kind: "name", name });
const tuple = (...of: TypeNode[]): TypeNode => ({ kind: "tuple", of });
const un = (...of: TypeNode[]): TypeNode => ({ kind: "union", of });
const ref = (of: TypeNode, op: "*" | "&" = "&"): TypeNode => ({ kind: "ref", op, of });

describe("type mapping per language", () => {
  const m = (lang: string, t: TypeNode | undefined, pos: "param" | "return" = "return") =>
    format(getAdapter(lang).mapType(t, pos, { name: "x", params: [], meta: { module: "m" } }));
  it("maps idiomatic types to canonical ones", () => {
    assert.equal(m("python", n("Optional", n("str"))), "string?");
    assert.equal(m("python", un(n("list", n("Address")), n("None"))), "Address[]?");
    assert.equal(m("go", tuple(ref(n("Address", ), "*"), n("error"))), "Address?");
    assert.equal(m("go", tuple(n("string"), n("bool"))), "string?");
    assert.equal(m("go", undefined), "void");
    assert.equal(m("rust", n("Result", n("Option", n("String")), n("CepError"))), "string?");
    assert.equal(m("rust", ref(n("str"))), "string");
    assert.equal(m("rust", n("impl", n("Into", n("String"))), "param"), "string");
    const ok = (t: TypeNode) => tuple(n("ok"), t);
    assert.equal(m("erlang", un(ok({ kind: "name", name: "binary", call: true }), tuple(n("error"), n("invalid")))), "string?");
    assert.equal(m("erlang", un(n("mobile"), n("landline"))), '"mobile" | "landline"');
    assert.equal(m("typescript", n("Promise", un(n("AddressInfo"), n("undefined")))), "AddressInfo?");
    assert.equal(m("ruby", un(n("String"), n("nil"))), "string?");
    assert.equal(m("dotnet", n("option", n("string"))), "string?");
    assert.equal(m("dotnet", un(n("string"), n("null"))), "string?"); // C# string?
  });
});

describe("contract loader", () => {
  it("reports every problem with file and path", () => {
    const dir = tmpContract({
      "cpf.json": {
        domain: "cpf",
        functions: {
          isValid: { params: [{ name: "cpf", type: "strin g" }], returns: "boolean" },
          generate: { returns: "string", tests: [{ args: [], satisfies: "cpf.nope" }] }
        }
      },
      "cnpj.json": { domain: "cnpj", functions: { isValid: { returns: "boolean", tests: [{ args: [], returns: true, throws: true }] } } }
    });
    assert.throws(
      () => loadContract(dir),
      (e: ContractError) =>
        e.problems.some((p) => p.includes("tests.0") && p.includes("exactly one")) &&
        e.problems.some((p) => p.includes("param cpf")) &&
        e.problems.some((p) => p.includes('satisfies unknown function "cpf.nope"'))
    );
  });
  it("test ids are stable when vectors are added around them", () => {
    const mk = (tests: object[]) =>
      loadContract(tmpContract({ "cpf.json": { domain: "cpf", functions: { isValid: { params: [{ name: "c", type: "string" }], returns: "boolean", tests } } } }));
    const a = mk([{ args: ["1"], returns: false }]);
    const b = mk([{ args: ["0"], returns: false }, { args: ["1"], returns: false }, { name: "named", args: ["2"], returns: false }]);
    assert.equal(a.functions.get("cpf.isValid")!.tests[0].id, 'cpf.isValid#["1"]');
    assert.deepEqual(b.functions.get("cpf.isValid")!.tests.map((t) => t.id), ['cpf.isValid#["0"]', 'cpf.isValid#["1"]', "cpf.isValid#named"]);
  });
  it("derives flat names and alias spellings", () => {
    const dir = tmpContract({
      "legalProcess.json": {
        domain: "legalProcess",
        aliases: ["processoJuridico"],
        functions: { isValid: { aliases: ["lawsuit.check"], params: [{ name: "v", type: "string" }], returns: "boolean" } }
      }
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

/** Python-like fake symbols: "cpf:str", "x?:int"; "str | None" returns become a union. */
const pyNode = (t: string | undefined): TypeNode | undefined => {
  if (!t) return undefined;
  const parts = t.split("|").map((x) => n(x.trim()));
  return parts.length === 1 ? parts[0] : un(...parts);
};
const sym = (name: string, params: string[], returns: string, extra: Partial<NativeSymbol> = {}): NativeSymbol => ({
  name,
  params: params.map((p) => {
    const type = p.split(":")[1];
    return { name: p.replace("?", "").split(":")[0], type, typeNode: pyNode(type), optional: p.includes("?") };
  }),
  returns,
  returnsNode: pyNode(returns),
  ...extra
});

describe("matching", () => {
  const contract = loadContract(
    tmpContract({
      "cpf.json": {
        domain: "cpf",
        functions: {
          isValid: { params: [{ name: "cpf", type: "string" }], returns: "boolean" },
          format: { params: [{ name: "cpf", type: "string" }], returns: "string" }
        }
      }
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
    "cpf.json": {
      domain: "cpf",
      functions: {
        isValid: {
          level: "core",
          params: [{ name: "cpf", type: "string" }],
          returns: "boolean",
          tests: [
            { args: ["11111111111"], returns: false },
            { args: ["52998224725"], returns: true }
          ]
        },
        format: {
          params: [{ name: "cpf", type: "string" }],
          returns: "string?",
          tests: [
            { args: ["52998224725"], returns: "529.982.247-25" },
            { args: ["x"], returns: null }
          ]
        },
        generate: { params: [], returns: "string", tests: [{ args: [], satisfies: "cpf.isValid", repeat: 3 }] },
        parse: { params: [{ name: "v", type: "string" }], returns: "string" }
      }
    }
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
      ctx: { lib: lib({ knownFailures: { 'cpf.format#["x"]': "returns '' by design" } }), root: "/", workDir: "/tmp" },
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
    assert.deepEqual(diffBaseline(bad, baseline).regressions.map((r) => r.id), ['cpf.isValid#["11111111111"]']);
  });

  it("baseline: a runner crash (tests skipped) or a vanished function is a regression", async () => {
    const good = await analyzeLib({ contract, adapter: fakeAdapter(impls), ctx: { lib: lib(), root: "/", workDir: "/tmp" }, surface, runTests: true });
    const baseline = baselineFrom(good);
    const crashing = fakeAdapter(impls);
    crashing.runner = { requires: [], run: async (_c, calls) => calls.map((c) => ({ id: c.id, ok: false as const, error: "runner crashed", unsupported: true })) };
    const crashed = await analyzeLib({ contract, adapter: crashing, ctx: { lib: lib(), root: "/", workDir: "/tmp" }, surface, runTests: true });
    assert.ok(diffBaseline(crashed, baseline).regressions.length >= 4);
    // cpf.format fails one vector (so it is not in baseline.ok) but its passing vector is baselined.
    const gone = { ...surface, symbols: surface.symbols.filter((s) => s.name !== "cpf.format_cpf") };
    const now = await analyzeLib({ contract, adapter: fakeAdapter(impls), ctx: { lib: lib(), root: "/", workDir: "/tmp" }, surface: gone, runTests: true });
    assert.deepEqual(diffBaseline(now, baseline).regressions.map((r) => r.id), ['cpf.format#["52998224725"]']);
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
