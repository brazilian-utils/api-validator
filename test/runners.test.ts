import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { LibConfig, RunnerResult, TypeNode } from "../src/core/model.js";
import { which } from "../src/core/shell.js";
import { goLiteral } from "../src/languages/go/runner.js";
import { getAdapter } from "../src/languages/registry.js";
import { fsharpLiteral } from "../src/languages/dotnet/runner.js";
import { erlangTerm } from "../src/languages/erlang/runner.js";
import { rustLiteral } from "../src/languages/rust/runner.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Extract the fixture, then call `symbol(args)` for each case through the real runner. */
async function run(language: string, entry: string, cases: Array<[string, unknown[]]>, options: Record<string, unknown> = {}) {
  const adapter = getAdapter(language);
  const lib: LibConfig = { name: language, language, entry, bindings: {}, ignore: [], waivers: {}, knownFailures: {}, options, source: "" };
  const ctx = { lib, root: path.join(FIXTURES, language), workDir: fs.mkdtempSync(path.join(os.tmpdir(), `runner-${language}-`)) };
  const { symbols } = await adapter.extract(ctx);
  const calls = cases.map(([name, args], i) => {
    const symbol = symbols.find((s) => s.name === name);
    assert.ok(symbol, `fixture symbol ${name}`);
    return { id: `c${i}`, symbol, args };
  });
  const results = await adapter.runner!.run(ctx, calls);
  return results.map((r: RunnerResult) => (r.ok ? r.value : r.unsupported ? "<unsupported>" : "<error>"));
}

const n = (name: string, ...args: TypeNode[]): TypeNode => (args.length ? { kind: "name", name, args } : { kind: "name", name });

describe("literal builders (from structured types)", () => {
  it("go", () => {
    const self = "example.com/x/cpf";
    assert.equal(goLiteral(n("string"), 'a"b', "p0", self), '"a\\"b"');
    assert.equal(goLiteral({ kind: "ref", op: "*", of: n("int") }, 3, "p0", self), "ptr(int(3))");
    assert.equal(goLiteral({ kind: "list", of: n("string") }, ["a"], "p0", self), '[]string{"a"}');
    assert.equal(goLiteral({ kind: "name", name: "UF", pkg: self }, "SP", "p0", self), 'p0.UF("SP")');
    assert.equal(goLiteral({ kind: "ref", op: "*", of: n("string") }, null, "p0", self), "nil");
    assert.throws(() => goLiteral(n("int"), "x", "p0", self));
    assert.throws(() => goLiteral({ kind: "name", name: "time.Time", pkg: "time" }, "x", "p0", self));
  });
  it("rust", () => {
    const str: TypeNode = { kind: "ref", op: "&", of: n("str") };
    assert.equal(rustLiteral(str, "a"), '"a"');
    assert.equal(rustLiteral(n("Option", n("u8")), null), "None");
    assert.equal(rustLiteral(n("Option", n("u8")), 2), "Some((2u8))");
    assert.equal(rustLiteral({ kind: "ref", op: "&", of: { kind: "list", of: n("String") } }, ["a"]), '&[String::from("a")]');
    assert.equal(rustLiteral(n("impl", n("Into", n("String"))), "a"), 'String::from("a")');
    assert.throws(() => rustLiteral(n("u8"), -1));
    assert.equal(rustLiteral(str, "a\bb\u0001"), '"a\\u{8}b\\u{1}"');
    assert.equal(rustLiteral(n("char"), "'"), "'\\''");
  });
  it("erlang", () => {
    assert.equal(erlangTerm("a\"b"), '<<"a\\"b"/utf8>>');
    assert.equal(erlangTerm(null), "undefined");
    assert.equal(erlangTerm([1, true]), "[1, true]");
    assert.equal(erlangTerm(0.5), "0.5");
    assert.equal(erlangTerm(1e-7), "1.0e-7");
  });
  it("f#", () => {
    assert.equal(fsharpLiteral(n("option", n("string")), null), "None");
    assert.equal(fsharpLiteral(n("option", n("string")), "a"), '(Some "a")');
    assert.equal(fsharpLiteral(n("float"), 2), "2.0");
    assert.equal(fsharpLiteral(undefined, "x"), '"x"');
    assert.equal(fsharpLiteral({ kind: "union", of: [n("string"), n("null")] }, null), "null");
  });
});

describe("runners (same protocol, every language)", () => {
  it("python", { skip: !which("python3") && "no python3" }, async () => {
    assert.deepEqual(await run("python", "pkg", [["is_valid_cpf", ["12345678901"]], ["cpf.format_cpf", ["x"]], ["cpf.generate", []], ["cep.format", ["1"]], ["is_valid_cpf", []], ["is_valid_cpf", ["1", "2", "3"]]]), [true, "x", [], null, "<unsupported>", "<unsupported>"]);
  });
  it("typescript", async () => {
    assert.deepEqual(await run("typescript", "src/index.ts", [["isValidCpf", ["12345678901"]], ["formatCpf", [5]], ["generateCpf", []]]), [true, "5", "00000000000"]);
  });
  it("ruby", { skip: !which("ruby") && "no ruby" }, async () => {
    assert.deepEqual(
      await run("ruby", "lib", [["CPFUtils.valid?", ["12345678901"]], ["CPFUtils.generate", []], ["CPFUtils.valid?", []], ["CPFUtils.format_cpf", ["1", { pad: true }]], ["CPFUtils.format_cpf", ["1", { nope: 1 }]]], { namespace: "Demo" }),
      [true, "00000000000", "<unsupported>", "1", "<unsupported>"]
    );
  });
  it("go (generated program in a go.work)", { skip: !which("go") && "no go" }, async () => {
    assert.deepEqual(
      await run("go", ".", [["cpf.IsValid", ["12345678901"]], ["cpf.Format", ["1"]], ["cpf.Lookup", [1]], ["cpf.Join", ["-", "a", "b"]], ["cpf.IsValid", [1]]]),
      [true, "<error>", null, "-", "<unsupported>"]
    );
  });
  it("erlang (erlc + escript)", { skip: !which("erlc") && "no erlang" }, async () => {
    assert.deepEqual(
      await run("erlang", "src", [["demo.is_valid", ["12345678901"]], ["demo.is_valid", ["1"]], ["demo.format", ["x"]], ["demo.generate", []], ["demo.is_valid", ["a", "b"]], ["demo.codes", []], ["demo.is_valid", [0.5]]]),
      [true, false, "x", "00000000000", "<unsupported>", [61, 62], false]
    );
  });
  it(".NET (generated F# project)", { skip: !which("dotnet") && "no dotnet", timeout: 300_000 }, async () => {
    assert.deepEqual(
      await run("dotnet", "Lib", [["Cpf.IsValid", ["x"]], ["Cpf.Format", ["1"]], ["Cpf.Generate", []], ["Nested.Inner", [1, 2]], ["Cpf.IsValid", [1]], ["Cpf.Codes", []]]),
      [true, "1", "00000000000", 3, "<unsupported>", [1, 2]]
    );
  });
  it("rust (generated crate)", { skip: !which("cargo") && "no cargo", timeout: 240_000 }, async () => {
    assert.deepEqual(
      await run("rust", "src/lib.rs", [["cpf.is_valid", ["12345678901"]], ["cpf.format_cpf", ["1"]], ["is_valid_cpf", ["1"]], ["cpf.nested.deep", [2]], ["cpf.is_valid", [1]]]),
      [true, "1", false, 2, "<unsupported>"]
    );
  });
});
