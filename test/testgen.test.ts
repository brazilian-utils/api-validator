import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { changelog, changelogMarkdown } from "../src/core/changelog.js";
import { loadContract } from "../src/core/contract.js";
import { diffDivergences, divergenceBaseline, partition, type DiffRow } from "../src/core/differential.js";
import type { ContractFunction, LibConfig, NativeSymbol, TypeNode } from "../src/core/model.js";
import { casesDigest, exportCases, headerLines, slugOf } from "../src/core/testgen.js";
import { pythonTestgen } from "../src/languages/python/testgen.js";
import { typescriptTestgen } from "../src/languages/typescript/testgen.js";
import { T } from "../src/core/ctype.js";

const lib = (over: Partial<LibConfig> = {}): LibConfig => ({
  name: "brazilian-utils-demo",
  language: "python",
  entry: "src/index.ts",
  bindings: {},
  ignore: [],
  waivers: {},
  knownFailures: {},
  options: {},
  source: "libs/demo.yaml",
  ...over
});

function contractFrom(yaml: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-"));
  fs.writeFileSync(path.join(dir, "cpf.yaml"), yaml);
  return loadContract(dir);
}

const CPF = `domain: cpf
functions:
  isValid:
    level: core
    params: [{ name: cpf, type: string }]
    returns: boolean
    tests:
      - { name: valid-sample, args: ["40364478081"], returns: true }
      - { args: ["123"], returns: false, note: too short }
  format:
    level: core
    params: [{ name: cpf, type: string }]
    returns: string?
    tests:
      - { args: ["40364478081"], returns: "403.644.780-81" }
      - { args: ["1"], returns: null }
      - { args: ["x"], throws: true }
      - { args: ["40364478081"], matches: "^\\\\d{3}\\\\." , name: shape }
  generate:
    level: core
    params: []
    returns: string
    tests:
      - { args: [], satisfies: cpf.isValid, repeat: 3, name: generated-is-valid }
`;

const str: TypeNode = { kind: "name", name: "str" };
const py = (name: string, module: string, attr: string, ret: TypeNode = str): NativeSymbol => ({
  name,
  params: [{ name: "cpf", typeNode: str }],
  returnsNode: ret,
  meta: { module, attr }
});

function bound(contract: ReturnType<typeof contractFrom>) {
  const syms: Record<string, NativeSymbol> = {
    "cpf.isValid": py("cpf.is_valid", "brutils.cpf", "is_valid"),
    "cpf.format": py("cpf.format_cpf", "brutils.cpf", "format_cpf"),
    "cpf.generate": { ...py("generate_cpf", "brutils", "generate_cpf"), params: [] }
  };
  const list = [...contract.functions.values()].map((fn) => ({ fn: fn as ContractFunction, symbol: syms[fn.id] }));
  return { list, byId: new Map(Object.entries(syms)) };
}

describe("export-tests core", () => {
  const contract = contractFrom(CPF);
  const { list, byId } = bound(contract);

  it("names tests from their name or arguments, short and unique", () => {
    const t = contract.functions.get("cpf.isValid")!.tests;
    assert.deepEqual(slugOf(t[0]), ["valid", "sample"]);
    assert.deepEqual(slugOf(t[1]), ["123"]);
    const long = slugOf({ ...t[1], id: 'x#["a very long argument that goes on and on and on for ever and ever"]', name: undefined });
    assert.ok(long.join("_").length <= 48 && /^[0-9a-f]{8}$/.test(long[long.length - 1]));
  });

  it("groups by function, marks known failures and non-baseline tests as skipped", () => {
    const groups = exportCases(list, byId, lib({ knownFailures: { "cpf.format#[\"1\"]": "returns the input" } }), {
      library: "x",
      ok: [],
      tests: ["cpf.isValid#valid-sample", "cpf.format#[\"40364478081\"]", "cpf.format#[\"x\"]", "cpf.format#shape", "cpf.generate#generated-is-valid"]
    });
    assert.deepEqual(groups.map((g) => g.fnId), ["cpf.format", "cpf.generate", "cpf.isValid"]);
    const skip = Object.fromEntries(groups.flatMap((g) => g.cases).map((c) => [c.id, c.skip]));
    assert.match(skip['cpf.format#["1"]']!, /known failure: returns the input/);
    assert.match(skip['cpf.isValid#["123"]']!, /baseline/);
    assert.equal(skip["cpf.isValid#valid-sample"], undefined);
    assert.equal(groups[1].cases[0].target?.name, "cpf.is_valid");
  });

  it("drops satisfies tests whose target the lib lacks, and network functions", () => {
    const noValid = new Map(byId);
    noValid.delete("cpf.isValid");
    const groups = exportCases(list.filter((b) => b.fn.id !== "cpf.isValid"), noValid, lib());
    assert.deepEqual(groups.map((g) => g.fnId), ["cpf.format"]);
  });

  it("digest changes exactly when exported tests change", () => {
    const a = exportCases(list, byId, lib());
    const b = exportCases(list, byId, lib({ knownFailures: { "cpf.isValid#valid-sample": "bug" } }));
    assert.equal(casesDigest(a), casesDigest(exportCases(list, byId, lib())));
    assert.notEqual(casesDigest(a), casesDigest(b));
    assert.match(headerLines(lib(), a, "run it").join("\n"), /DO NOT EDIT[\s\S]*export-tests --lib brazilian-utils-demo --path \.[\s\S]*Run: run it/);
  });
});

describe("python test generator", () => {
  const contract = contractFrom(CPF);
  const { list, byId } = bound(contract);
  const groups = exportCases(list, byId, lib({ knownFailures: { "cpf.format#[\"1\"]": "returns the input" } }));
  const ctx = { lib: lib(), root: "/nowhere", workDir: "/tmp" };
  const out = pythonTestgen.render(ctx, groups, ["header"]).content;

  it("renders every expectation kind as unittest", () => {
    assert.match(out, /^# header\n/);
    assert.match(out, /^import brutils$/m);
    assert.match(out, /^from brutils import cpf$/m);
    assert.match(out, /self\.assertIs\(cpf\.is_valid\("40364478081"\), True\)/);
    assert.match(out, /self\.assertEqual\(cpf\.format_cpf\("40364478081"\), "403\.644\.780-81"\)/);
    assert.match(out, /@unittest\.skip\("known failure: returns the input"\)\n {4}def test_1\(self\):\n {8}# cpf\.format#\["1"\]\n {8}self\.assertIsNone\(cpf\.format_cpf\("1"\)\)/);
    assert.match(out, /with self\.assertRaises\(Exception\):\n {12}cpf\.format_cpf\("x"\)/);
    assert.match(out, /self\.assertRegex\(cpf\.format_cpf\("40364478081"\), "\^\\\\d\{3\}\\\\\."\)/);
    assert.match(out, /for _ in range\(3\):\n {12}value = brutils\.generate_cpf\(\)\n {12}self\.assertIs\(cpf\.is_valid\(value\), True, value\)/);
    assert.match(out, /# too short\n/);
  });

  it("runs, and passes/fails like the validator would", { skip: !hasPython() }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pygen-"));
    fs.mkdirSync(path.join(dir, "brutils"));
    fs.writeFileSync(
      path.join(dir, "brutils", "__init__.py"),
      "import random\nfrom . import cpf\ndef generate_cpf():\n    return '40364478081'\n"
    );
    fs.writeFileSync(
      path.join(dir, "brutils", "cpf.py"),
      "def is_valid(c):\n    return c == '40364478081'\ndef format_cpf(c):\n    if c == 'x':\n        raise ValueError(c)\n    return '403.644.780-81' if len(c) == 11 else c\n"
    );
    fs.writeFileSync(path.join(dir, "test_contract.py"), out);
    const r = runPy(["-m", "unittest", "-v", "test_contract.py"], dir);
    assert.match(r, /Ran 7 tests/);
    assert.match(r, /OK \(skipped=1\)/);
  });
});

describe("typescript test generator", () => {
  const contract = contractFrom(CPF);
  const s = (name: string, ret: TypeNode, params: NativeSymbol["params"] = [{ name: "cpf", typeNode: { kind: "name", name: "string" } }]): NativeSymbol => ({ name, params, returnsNode: ret });
  const syms: Record<string, NativeSymbol> = {
    "cpf.isValid": s("isValidCpf", { kind: "name", name: "boolean" }),
    "cpf.format": s("formatCpf", { kind: "name", name: "string" }),
    "cpf.generate": s("generateCpf", { kind: "union", of: [{ kind: "name", name: "string" }, { kind: "name", name: "null" }] }, [])
  };
  const list = [...contract.functions.values()].map((fn) => ({ fn, symbol: syms[fn.id] }));
  const groups = exportCases(list, new Map(Object.entries(syms)), lib());
  const map = (t: TypeNode | undefined) =>
    t?.kind === "union" ? { k: "union" as const, of: [T.string, T.null] } : t?.kind === "name" && t.name === "boolean" ? T.boolean : T.string;
  const out = typescriptTestgen(map).render({ lib: lib(), root: "/nowhere", workDir: "/tmp" }, groups, ["header"]).content;

  it("imports the public entry and renders expectations with vitest", () => {
    assert.match(out, /import \{ describe, expect, it \} from "vitest";\nimport \* as lib from "\.\/index";/);
    assert.match(out, /expect\(lib\.formatCpf\("1"\) \?\? null\)\.toBeNull\(\);/);
    assert.match(out, /expect\(\(\) => lib\.formatCpf\("x"\)\)\.toThrow\(\);/);
    assert.match(out, /expect\(lib\.isValidCpf\("40364478081"\)\)\.toBe\(true\);/);
    // string | null does not fit a string parameter: asserted, so the lib's typecheck passes.
    assert.match(out, /expect\(lib\.isValidCpf\(value as never\)\)\.toBe\(true\);/);
    assert.doesNotMatch(out, /async/);
    assert.doesNotMatch(out, /const norm/);
  });
});

describe("contract changelog", () => {
  it("lists new functions, changed signatures and test vectors", () => {
    const before = contractFrom(CPF);
    const after = contractFrom(
      CPF.replace("returns: string?", "returns: string")
        .replace('- { args: ["123"], returns: false, note: too short }', '- { args: ["123"], throws: true }')
        .replace("  generate:", "  isValidMasked:\n    level: extended\n    params: [{ name: cpf, type: string }]\n    returns: boolean\n  generate:")
    );
    const log = changelog(before, after);
    assert.deepEqual(log.added.map((f) => f.id), ["cpf.isValidMasked"]);
    assert.deepEqual(log.changed.map((c) => c.id), ["cpf.format", "cpf.isValid"]);
    assert.match(log.changed[0].changes[0], /string\?` → `.*string`/);
    assert.equal(log.changed[1].testsChanged.length, 1);
    const md = changelogMarkdown(log, "v1", "v2");
    assert.match(md, /\*\*1\*\* new functions/);
    assert.match(md, /⚠️ 1 breaking/);
    assert.match(md, /✏️ `\["123"\]` → false ⇒ `\["123"\]` → throws/);
  });
});

describe("divergence baseline", () => {
  const row = (fn: string, args: unknown[], ...groups: string[][]): DiffRow => ({
    fn,
    args,
    answers: groups.map((libs, i) => ({ answer: String(i), value: i, libs: libs.map((l) => `brazilian-utils-${l}`) })),
    agree: groups.length === 1
  });

  it("records how libs split, independent of input and answer order", () => {
    assert.equal(partition(row("f", [1], ["ruby", "go"], ["python"])), "go,ruby | python");
    assert.equal(partition(row("f", [2], ["python"], ["go", "ruby"])), "go,ruby | python");
    assert.deepEqual(divergenceBaseline([row("f", [1], ["go"], ["python"]), row("f", [2], ["python"], ["go"]), row("g", [1], ["go", "python"])]), {
      f: ["go | python"]
    });
  });

  it("flags only unknown splits; reports splits that went away", () => {
    const base = { f: ["go | python"], g: ["go | rust"] };
    const rows = [row("f", ["random-1"], ["python"], ["go"]), row("f", ["x"], ["go", "python"], ["rust"]), row("g", [1], ["go", "rust"])];
    const d = diffDivergences(rows, base, ["f", "g"]);
    assert.deepEqual(d.fresh.map((x) => x.split), ["go,python | rust"]);
    assert.deepEqual(d.gone, [{ fn: "g", split: "go | rust" }]);
  });
});

function hasPython(): boolean {
  try {
    execFileSync("python3", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

function runPy(args: string[], cwd: string): string {
  const r = spawnSync("python3", args, { cwd, encoding: "utf8" });
  return `${r.stdout}${r.stderr}`;
}
