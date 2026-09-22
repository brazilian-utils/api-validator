import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { LibConfig, RunnerResult } from "../src/core/model.js";
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

describe("literal builders", () => {
  it("go", () => {
    assert.equal(goLiteral("string", 'a"b', "p0"), '"a\\"b"');
    assert.equal(goLiteral("*int", 3, "p0"), "ptr(int(3))");
    assert.equal(goLiteral("[]string", ["a"], "p0"), '[]string{"a"}');
    assert.equal(goLiteral("UF", "SP", "p0"), 'p0.UF("SP")');
    assert.equal(goLiteral("*string", null, "p0"), "nil");
    assert.throws(() => goLiteral("int", "x", "p0"));
  });
  it("rust", () => {
    assert.equal(rustLiteral("&str", "a"), '"a"');
    assert.equal(rustLiteral("Option<u8>", null), "None");
    assert.equal(rustLiteral("Option<u8>", 2), "Some((2u8))");
    assert.equal(rustLiteral("&[String]", ["a"]), '&[String::from("a")]');
    assert.throws(() => rustLiteral("u8", -1));
    assert.equal(rustLiteral("&str", "a\bb\u0001"), '"a\\u{8}b\\u{1}"');
    assert.equal(rustLiteral("char", "'"), "'\\''");
  });
  it("erlang", () => {
    assert.equal(erlangTerm("a\"b"), '<<"a\\"b"/utf8>>');
    assert.equal(erlangTerm(null), "undefined");
    assert.equal(erlangTerm([1, true]), "[1, true]");
    assert.equal(erlangTerm(0.5), "0.5");
    assert.equal(erlangTerm(1e-7), "1.0e-7");
  });
  it("f#", () => {
    assert.equal(fsharpLiteral("string option", null), "None");
    assert.equal(fsharpLiteral("string option", "a"), '(Some "a")');
    assert.equal(fsharpLiteral("float", 2), "2.0");
    assert.equal(fsharpLiteral(undefined, "x"), '"x"');
  });
});

describe("runners (same protocol, every language)", () => {
  it("python", { skip: !which("python3") && "no python3" }, async () => {
    assert.deepEqual(await run("python", "pkg", [["is_valid_cpf", ["12345678901"]], ["cpf.format_cpf", ["x"]], ["cpf.generate", []], ["cep.format", ["1"]]]), [true, "x", [], null]);
  });
  it("typescript", async () => {
    assert.deepEqual(await run("typescript", "src/index.ts", [["isValidCpf", ["12345678901"]], ["formatCpf", [5]], ["generateCpf", []]]), [true, "5", "00000000000"]);
  });
  it("ruby", { skip: !which("ruby") && "no ruby" }, async () => {
    assert.deepEqual(await run("ruby", "lib", [["CPFUtils.valid?", ["12345678901"]], ["CPFUtils.generate", []], ["CPFUtils.valid?", []]], { namespace: "Demo" }), [true, "00000000000", "<error>"]);
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
