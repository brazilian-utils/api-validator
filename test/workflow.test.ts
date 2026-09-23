import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { EQUALITY_SELF_TEST, domainFiles, skipsFor, suiteFiles } from "../src/core/cases.js";
import { changelog, changelogMarkdown, contractAt } from "../src/core/changelog.js";
import { valuesEqual } from "../src/core/conformance.js";
import { loadContract } from "../src/core/contract.js";
import { diffDivergences, divergenceBaseline, partition, type DiffRow } from "../src/core/differential.js";
import type { LibConfig, LibReport } from "../src/core/model.js";
import { summarize } from "../src/core/analyze.js";
import { badgeSvg } from "../src/reporters/badge.js";
import { siteDataFiles } from "../src/reporters/sitedata.js";
import { closeReason, keyOf, marker, scopeFrom, wantedIssues } from "../src/core/issues.js";
import { materializeUsage, ownUsage, parseReference, parseUsageDir, scaffoldUsage, summarizeUsage, usageStatus } from "../src/core/usage.js";
import { operationLabel, resolveOperation } from "../site/src/lib/usage-format.mjs";
import { execFileSync } from "node:child_process";

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
  fs.mkdirSync(path.join(dir, doc.domain));
  fs.writeFileSync(path.join(dir, doc.domain, "contract.json"), JSON.stringify(doc));
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


describe("contract at a git ref", () => {
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });
  const repo = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-repo-"));
    git(dir, "init", "-q");
    git(dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "before the contract");
    return dir;
  };
  it("is empty at a ref without contract/ (a base branch from before the contract)", () => {
    const dir = repo();
    const at = contractAt(dir, path.join(dir, "contract"), "HEAD");
    assert.equal(at.functions.size, 0);
  });
  it("reads the old flat layout (<domain>.json) into today's folders", () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, "contract"));
    fs.writeFileSync(path.join(dir, "contract", "licensePlate.json"), JSON.stringify({ domain: "licensePlate", functions: { isValid: { params: [{ name: "v", type: "string" }], returns: "boolean" } } }));
    git(dir, "add", ".");
    git(dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "flat");
    assert.ok(contractAt(dir, path.join(dir, "contract"), "HEAD").functions.has("licensePlate.isValid"));
  });
});

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

describe("site data", () => {
  const contract = contractFrom(CPF);
  const report = (name: string, statuses: Record<string, LibReport["functions"][number]["status"]>): LibReport => {
    const functions = [...contract.functions.values()].map((f) => ({
      id: f.id,
      level: f.level,
      status: statuses[f.id] ?? ("missing" as const),
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
  const files = siteDataFiles({ contract, libs, generatedAt: "2026-01-01T00:00:00Z" });

  it("writes the status for the site, badges and the JSON suite", () => {
    for (const f of [".generated/status.json", "public/badges/a.svg", "public/badges/a.json", "public/cases/cpf.json", "public/cases/index.json"]) assert.ok(files.has(f), f);
  });

  it("status: per lib and function, with source links and failing cases", () => {
    const status = JSON.parse(files.get(".generated/status.json")!);
    const a = status.libs.a.functions;
    assert.equal(a["cpf.isValid"].status, "ok");
    assert.equal(a["cpf.isValid"].source, "https://github.com/o/a/blob/abc123/src/cpf.py#L3");
    assert.equal(a["cpf.format"].failed, 1);
    assert.equal(a["cpf.format"].failures[0].id, 'cpf.format#["x"]');
    assert.equal(status.libs.b.functions["cpf.generate"].status, "missing");
    assert.deepEqual(status.libs.a.unmapped, [{ symbol: "extra", suggestions: [] }]);
  });

  it("badge is a self-contained SVG", () => {
    assert.match(badgeSvg(libs[0].report), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[\s\S]*api contract/);
  });
});

describe("usage files", () => {
  const contract = contractFrom(CPF);
  const report: LibReport = {
    library: "brazilian-utils-demo",
    language: "python",
    functions: [...contract.functions.values()].map((f) => ({
      id: f.id,
      level: f.level,
      status: f.operation === "format" ? ("missing" as const) : ("ok" as const),
      symbol: f.operation === "format" ? undefined : `${f.operation === "isValid" ? "is_valid" : "generate"}_cpf`,
      issues: [],
      suggestions: [],
      tests: f.tests.map((t) => ({ id: t.id, status: "pass" as const }))
    })),
    unmapped: [],
    configIssues: [],
    testsRan: true,
    summary: summarize([])
  };
  const usageDir = (files: Record<string, string>) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "usage-"));
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
    return dir;
  };

  it("resolves headings to contract functions (op id, kebab case, legacy alias) and reports the rest", () => {
    const files = parseUsageDir(contract, usageDir({ "cpf.md": "intro\n\n## validate\n\n```py\nis_valid_cpf('1')\n```\n\n## remove-symbols\n\nx\n", "nope.md": "## isValid\n" }));
    assert.deepEqual(files.sections.map((s) => s.fn), ["cpf.isValid"]);
    assert.match(files.warnings.join("\n"), /nope\.md: no contract domain/);
    assert.match(files.warnings.join("\n"), /"## remove-symbols" is not an operation of cpf/);
  });

  it("flags sections for functions the lib lacks and examples that never call the function", () => {
    const files = parseUsageDir(contract, usageDir({ "cpf.md": "## isValid\n\n```py\nvalidate('1')\n```\n\n## format\n\n```py\nformat_cpf('1')\n```\n" }));
    const usage = usageStatus(contract, report, files);
    assert.equal(usage["cpf.isValid"].documented, true);
    assert.match(usage["cpf.isValid"].problems[0], /never calls `is_valid_cpf`/);
    assert.deepEqual(usage["cpf.format"].problems, ["documents a function the lib does not implement"]);
    assert.equal(usage["cpf.generate"].documented, false);
  });

  it("reads a reference page whose headings are the lib's symbols, and writes it back as usage files", () => {
    const page = "---\ntitle: API\n---\n\nRules for every function.\n\n## CPF\n\n### is_valid_cpf\n\nChecks it.\n\n```py\nis_valid_cpf('1')\n```\n\n### helper\n\nnot in the contract\n";
    const { sections, intro } = parseReference(report, "docs/api.md", page, "en");
    assert.equal(intro, "Rules for every function.");
    assert.deepEqual(sections.map((s) => [s.fn, s.body.split("\n")[0]]), [["cpf.isValid", "Checks it."]]);
    const files = materializeUsage(contract, [...sections, { file: "x", locale: "pt-BR", fn: "cpf.generate", body: "gera" }], "o/demo@abc");
    assert.deepEqual([...files.keys()], ["cpf.md", "cpf.pt-br.md"]);
    assert.match(files.get("cpf.md")!, /^<!-- Generated by `api-validator usage --materialize` from o\/demo@abc\. -->\n\n## isValid\n\nChecks it\./);
  });

  it("scaffolds the missing sections from passing cases, keeping what is there", () => {
    const dir = usageDir({ "cpf.md": "## isValid\n\n```python\nis_valid_cpf('40364478081')  # True\n```\n" });
    const out = scaffoldUsage(
      { contract, lib: lib({ site: { label: "Demo", order: 1, package: "brutils", install: "", registry: "", usage: { ref: "main", path: "docs/usage", assets: [] } } }), report, natives: new Map(), existing: parseUsageDir(contract, dir) },
      (f) => fs.readFileSync(path.join(dir, f), "utf8")
    );
    const cpf = out.get("cpf.md")!;
    assert.ok(cpf.startsWith("## isValid\n\n```python\nis_valid_cpf('40364478081')  # True"), "existing content first, untouched");
    assert.match(cpf, /## generate\n\n```python\nfrom brutils import generate_cpf\n\ngenerate_cpf\(\)  # random valid value\n```/);
    assert.doesNotMatch(cpf, /## format/, "not implemented: no section");
  });

  const site = { label: "Demo", order: 1, package: "brutils", install: "", registry: "", usage: { ref: "main", path: "docs/usage", assets: [] } };

  it("scaffolds English sections into the English file, even when only a pt-BR file exists", () => {
    const dir = usageDir({ "cpf.pt-br.md": "## isValid\n\n```python\nis_valid_cpf('1')  # Verdadeiro\n```\n" });
    const out = scaffoldUsage({ contract, lib: lib({ site }), report, natives: new Map(), existing: parseUsageDir(contract, dir) }, (f) =>
      fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : undefined
    );
    assert.deepEqual([...out.keys()], ["cpf.md"]);
    assert.match(out.get("cpf.md")!, /## isValid[\s\S]*## generate/);
  });

  it("own usage: the usage files, plus the reference page for what they leave out", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lib-"));
    fs.mkdirSync(path.join(root, "docs/usage"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs/api.md"), "Conventions.\n\n## CPF helpers\n\n### is_valid_cpf\n\nFrom the page.\n\n### generate_cpf\n\n```py\ngenerate_cpf()\n```\n");
    const withRef = lib({ site: { ...site, usage: { ...site.usage, reference: { en: "docs/api.md" } } } });
    const onlyPage = ownUsage(contract, withRef, root, report);
    assert.equal(onlyPage.dir, path.join(root, "docs/api.md"));
    assert.deepEqual(onlyPage.sections.map((s) => s.fn), ["cpf.isValid", "cpf.generate"]);
    fs.writeFileSync(path.join(root, "docs/usage/cpf.md"), "## isValid\n\n```py\nis_valid_cpf('1')\n```\n");
    const both = ownUsage(contract, withRef, root, report);
    assert.equal(both.dir, path.join(root, "docs/usage"));
    assert.deepEqual(both.sections.map((s) => [s.fn, s.file]), [["cpf.isValid", "cpf.md"], ["cpf.generate", "docs/api.md"]]);
  });

  it("resolves headings like the site: default labels too (`## Decode` is getInfo)", () => {
    const info = contractFrom({ domain: "cnh", functions: { getInfo: { params: string, returns: "string?" }, isValid: { params: string, returns: "boolean" } } });
    const files = parseUsageDir(info, usageDir({ "cnh.md": "## Decode\n\n```js\nx\n```\n\n## Validate\n\n```js\ny\n```\n" }));
    assert.deepEqual(files.sections.map((s) => s.fn), ["cnh.getInfo", "cnh.isValid"]);
    assert.deepEqual(files.warnings, []);
    const ops = ["getInfo", "isValid"].map((id) => ({ id, label: operationLabel(id) }));
    assert.equal(resolveOperation(ops, "Decode"), "getInfo");
  });

  it("summary counts contract functions only", () => {
    const extra: LibReport = { ...report, functions: [...report.functions, { id: "cpf.gone", level: "core", status: "ok", symbol: "gone", issues: [], suggestions: [], tests: [] }] };
    const sum = summarizeUsage(extra, usageStatus(contract, extra, { sections: [], warnings: [] }));
    assert.deepEqual(sum, { implemented: 2, documented: 0, problems: 0, undocumented: ["cpf.isValid", "cpf.generate"] });
  });

  it("usage --materialize --out needs exactly one lib", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "out-"));
    const run = () => execFileSync(process.execPath, ["--import", "tsx", "src/cli.ts", "usage", "--materialize", "--out", out], { stdio: "pipe" });
    assert.throws(run, (e: { status: number; stderr: Buffer }) => e.status === 2 && /--out needs exactly one --lib/.test(String(e.stderr)));
    assert.deepEqual(fs.readdirSync(out), []);
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


describe("per-function issues", () => {
  const contract = contractFrom(CPF);
  const report = (statuses: Record<string, LibReport["functions"][number]["status"]>, failing: string[] = []): LibReport => {
    const functions = [...contract.functions.values()].map((f) => ({
      id: f.id,
      level: f.level,
      status: statuses[f.id] ?? ("missing" as const),
      symbol: statuses[f.id] ? `sym_${f.operation}` : undefined,
      issues: [],
      suggestions: [],
      tests: f.tests.map((t) => ({ id: t.id, status: failing.includes(t.id) ? ("fail" as const) : ("pass" as const) }))
    }));
    return { library: "x", language: "python", functions, unmapped: [], configIssues: [], testsRan: true, summary: summarize(functions) };
  };

  it("opens 'implement' only for functions the change added, 'fix' only for cases it added or changed", () => {
    const r = report({ "cpf.isValid": "ok", "cpf.format": "failing" }, ['cpf.format#["1"]']);
    const none = wantedIssues(contract, r, { added: new Set(), cases: new Set() });
    assert.deepEqual(none, []);
    const wanted = wantedIssues(contract, r, { added: new Set(["cpf.generate"]), cases: new Set(['cpf.format#["1"]']) });
    assert.deepEqual(wanted.map((w) => w.title), ["[api-contract] Fix cpf.format: 1 failing case", "[api-contract] Implement cpf.generate"]);
  });

  it("backfill covers what was already missing or failing; waived and signature-mismatch are left alone", () => {
    const r = report({ "cpf.isValid": "signature", "cpf.format": "waived" });
    assert.deepEqual(wantedIssues(contract, r, { added: new Set(), cases: new Set() }, "core").map((w) => w.key), ["implement:cpf.generate"]);
  });

  it("closes issues once done, with the reason; keeps the rest", () => {
    const done = report({ "cpf.isValid": "ok", "cpf.generate": "ok", "cpf.format": "failing" }, ['cpf.format#["1"]']);
    assert.match(closeReason("implement:cpf.generate", contract, done)!, /implemented as `sym_generate`, and every shared case passes/);
    assert.match(closeReason("implement:cpf.format", contract, done)!, /some cases still fail/);
    assert.equal(closeReason("fix:cpf.format", contract, done), undefined);
    assert.match(closeReason("fix:cpf.isValid", contract, done)!, /passes now/);
    assert.match(closeReason("implement:cpf.gone", contract, done)!, /no longer in the contract/);
  });

  it("finds its issues again by the marker in the body", () => {
    assert.equal(keyOf(`${marker("implement:cpf.isValid")}\nbody`), "implement:cpf.isValid");
    assert.equal(keyOf("an issue someone wrote by hand"), undefined);
  });

  it("scope comes from the contract changelog", () => {
    const changed: Domain = structuredClone(CPF);
    (changed.functions.isValid.tests as unknown[]).push({ args: ["9"], returns: false });
    changed.functions.isMasked = { params: string, returns: "boolean", tests: [{ args: ["1"], returns: false }] };
    const scope = scopeFrom(changelog(contract, contractFrom(changed)));
    assert.deepEqual([...scope.added], ["cpf.isMasked"]);
    assert.deepEqual([...scope.cases].sort(), ['cpf.isMasked#["1"]', 'cpf.isValid#["9"]']);
  });
});
