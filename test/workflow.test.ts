import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { EQUALITY_SELF_TEST, domainFiles, skipsFor, suiteFiles } from "../src/core/cases.js";
import { changelog, changelogMarkdown } from "../src/core/changelog.js";
import { valuesEqual } from "../src/core/conformance.js";
import { loadContract } from "../src/core/contract.js";
import { diffDivergences, divergenceBaseline, partition, type DiffRow } from "../src/core/differential.js";
import type { LibConfig, LibReport } from "../src/core/model.js";
import { summarize } from "../src/core/analyze.js";
import { badgeSvg, buildSite } from "../src/reporters/site.js";

const lib = (over: Partial<LibConfig> = {}): LibConfig => ({
  name: "brazilian-utils-demo",
  language: "python",
  entry: ".",
  bindings: {},
  ignore: [],
  waivers: {},
  knownFailures: {},
  options: {},
  source: "libs/demo.json",
  ...over
});

type Domain = { domain: string; functions: Record<string, Record<string, unknown>> };

function contractFrom(doc: Domain) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-"));
  fs.writeFileSync(path.join(dir, `${doc.domain}.json`), JSON.stringify(doc));
  return loadContract(dir);
}

const string = [{ name: "cpf", type: "string" }];
const CPF: Domain = {
  domain: "cpf",
  functions: {
    isValid: {
      level: "core",
      params: string,
      returns: "boolean",
      tests: [
        { name: "valid-sample", args: ["40364478081"], returns: true },
        { args: ["123"], returns: false, note: "too short" }
      ]
    },
    format: {
      level: "core",
      params: string,
      returns: "string?",
      tests: [
        { args: ["40364478081"], returns: "403.644.780-81" },
        { args: ["1"], returns: null },
        { args: ["x"], throws: true },
        { name: "shape", args: ["40364478081"], matches: "^\\d{3}\\." }
      ]
    },
    generate: {
      level: "core",
      params: [],
      returns: "string",
      tests: [{ name: "generated-is-valid", args: [], satisfies: "cpf.isValid", repeat: 3 }]
    }
  }
};


describe("JSON conformance suite", () => {
  const contract = contractFrom(CPF);

  it("writes one file per domain with every case, in contract order", () => {
    const cpf = domainFiles(contract).get("cpf")!;
    assert.deepEqual(cpf.functions.map((f) => f.id), ["cpf.format", "cpf.generate", "cpf.isValid"]);
    const format = cpf.functions[0];
    assert.deepEqual(format.cases.map((c) => c.expect), [{ returns: "403.644.780-81" }, { returns: null }, { throws: true }, { matches: "^\\d{3}\\." }]);
    assert.deepEqual(cpf.functions[1].cases[0], { id: "cpf.generate#generated-is-valid", args: [], expect: { satisfies: "cpf.isValid" }, repeat: 3 });
    assert.equal(cpf.functions[2].cases[1].note, "too short");
  });

  it("ships the schema, an index with the comparison rules, and the equality self-test", () => {
    const files = suiteFiles(contract);
    assert.deepEqual([...files.keys()].sort(), ["cases.schema.json", "cases/cpf.json", "cases/equality.json", "cases/index.json"]);
    const index = files.get("cases/index.json") as { cases: number; comparison: string[]; digest: string };
    assert.equal(index.cases, 7);
    assert.ok(index.comparison.some((r) => r.startsWith("returns null")));
    assert.match(index.digest, /^[0-9a-f]{16}$/);
  });

  it("equality self-test agrees with the validator's own comparison", () => {
    for (const p of EQUALITY_SELF_TEST) assert.equal(valuesEqual(p.expected, p.actual), p.equal, p.id);
    assert.equal(new Set(EQUALITY_SELF_TEST.map((p) => p.id)).size, EQUALITY_SELF_TEST.length);
  });

  it("skip list: known failures, baseline gaps with the last failure, never cases the harness skips itself", () => {
    const skips = skipsFor(
      lib({ knownFailures: { 'cpf.format#["x"]': "throws nothing" } }),
      contract,
      new Set(["cpf.format", "cpf.generate"]),
      { library: "x", ok: [], tests: ['cpf.format#["40364478081"]'] },
      new Map([['cpf.format#["1"]', { status: "fail", message: 'expected null, got "1"' }]])
    );
    assert.deepEqual(skips, {
      'cpf.format#["1"]': 'fails today: expected null, got "1"',
      'cpf.format#["x"]': "known failure: throws nothing",
      "cpf.format#shape": "fails today (not in the api-validator baseline)"
    });
  });
});

describe("status site", () => {
  const contract = contractFrom(CPF);
  const report = (name: string, statuses: Record<string, LibReport["functions"][number]["status"]>): LibReport => {
    const functions = [...contract.functions.values()].map((f) => ({
      id: f.id,
      level: f.level,
      status: statuses[f.id] ?? "missing",
      symbol: statuses[f.id] && statuses[f.id] !== "missing" ? `sym_${f.operation}` : undefined,
      location: { file: "src/cpf.py", line: 3 },
      issues: [],
      suggestions: [],
      tests: f.tests.map((t) => ({ id: t.id, status: statuses[f.id] === "failing" && t.expect.kind === "throws" ? ("fail" as const) : ("pass" as const), expected: undefined, actual: "x" }))
    }));
    return { library: name, language: "python", revision: "abc123", functions, unmapped: [{ symbol: "extra", suggestions: [] }], configIssues: [], testsRan: true, summary: summarize(functions) };
  };
  const libs = [
    { lib: lib({ name: "brazilian-utils-a", repo: "https://github.com/o/a" }), report: report("brazilian-utils-a", { "cpf.isValid": "ok", "cpf.format": "failing", "cpf.generate": "ok" }) },
    { lib: lib({ name: "brazilian-utils-b" }), report: report("brazilian-utils-b", { "cpf.isValid": "ok" }) }
  ];
  const site = buildSite({ contract, libs, generatedAt: "2026-01-01T00:00:00Z", validatorRepo: "https://github.com/o/v", baseUrl: "https://o.github.io/v/" });

  it("has an overview, a page per lib and per function, badges and the suite", () => {
    for (const f of ["index.html", "site.css", "functions/index.html", "functions/cpf.isValid/index.html", "libs/a/index.html", "libs/b/index.html", "badges/a.svg", "badges/a.json", "api/libs/a.json", "cases/cpf.json", "cases/index.json"]) {
      assert.ok(site.has(f), f);
    }
  });

  it("lib page: comparison, work list ordered failing → missing, failures, API outside the contract, badge snippet", () => {
    const page = site.get("libs/a/index.html")!;
    assert.match(page, /Compared with the other libs/);
    assert.ok(page.indexOf("cpf.format") < page.indexOf("Failing cases"));
    assert.match(page, /cpf\.format#\[&quot;x&quot;\]|cpf\.format#\["x"\]/);
    assert.match(page, /<code>extra<\/code>/);
    assert.match(page, /\[!\[API contract\]\(https:\/\/o\.github\.io\/v\/badges\/a\.svg\)\]\(https:\/\/o\.github\.io\/v\/libs\/a\/\)/);
    const b = site.get("libs/b/index.html")!;
    assert.match(b, /cpf\.generate[\s\S]*1: a/);
  });

  it("function page: signature, implementations with source links, case × lib matrix", () => {
    const page = site.get("functions/cpf.format/index.html")!;
    assert.match(page, /formatCpf\(cpf: string\) -&gt; string\?/);
    assert.match(page, /https:\/\/github\.com\/o\/a\/blob\/abc123\/src\/cpf\.py#L3/);
    assert.match(page, /class="dot bad"/);
    assert.match(page, /Cases × libs/);
  });

  it("badge is a self-contained SVG", () => {
    const svg = badgeSvg(libs[0].report);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /api contract/);
  });
});

describe("contract changelog", () => {
  it("lists new functions, changed signatures and test vectors", () => {
    const before = contractFrom(CPF);
    const changed: Domain = structuredClone(CPF);
    changed.functions.format.returns = "string";
    (changed.functions.isValid.tests as unknown[])[1] = { args: ["123"], throws: true };
    changed.functions.isValidMasked = { level: "extended", params: string, returns: "boolean" };
    const after = contractFrom(changed);
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

