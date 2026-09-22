import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { LibConfig, NativeSymbol } from "../src/core/model.js";
import { which } from "../src/core/shell.js";
import { getAdapter } from "../src/languages/registry.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function extract(language: string, entry: string, options: Record<string, unknown> = {}) {
  const lib: LibConfig = { name: language, language, entry, bindings: {}, ignore: [], waivers: {}, knownFailures: {}, options, source: "" };
  const { symbols, warnings } = await getAdapter(language).extract({ lib, root: path.join(FIXTURES, language), workDir: path.join(FIXTURES, "..", "..", ".cache", "test") });
  assert.deepEqual(warnings, []);
  return new Map(symbols.map((s) => [s.name, s]));
}

const names = (m: Map<string, NativeSymbol>) => [...m.keys()].sort();
const params = (s: NativeSymbol | undefined) => s?.params.map((p) => `${p.rest ? "..." : ""}${p.name}${p.optional ? "?" : ""}${p.keyword ? "(kw)" : ""}${p.type ? `: ${p.type}` : ""}`);

describe("python extractor (ast)", async () => {
  const s = await extract("python", "pkg");
  it("finds module functions and facade re-exports, skips private modules/functions", () => {
    assert.deepEqual(names(s), ["cep.format", "cpf.format_cpf", "cpf.generate", "cpf.is_valid", "cpf.validate", "format_cep", "format_cpf", "is_valid_cpf"]);
  });
  it("links re-exports to their target and keeps the signature", () => {
    assert.equal(s.get("is_valid_cpf")?.aliasOf, "cpf.is_valid");
    assert.equal(s.get("format_cep")?.aliasOf, "cep.format"); // relative import
    assert.deepEqual(params(s.get("is_valid_cpf")), ["cpf: str"]);
  });
  it("reads defaults, *args, keyword-only params and annotations", () => {
    assert.deepEqual(params(s.get("cpf.format_cpf")), ["cpf: str", "pad?(kw): bool"]);
    assert.deepEqual(params(s.get("cpf.generate")), ["count?: int", "...more?: str"]);
    assert.equal(s.get("cpf.format_cpf")?.returns, "Optional[str]");
  });
  it("detects DeprecationWarning", () => assert.equal(s.get("cpf.validate")?.deprecated, true));
});

describe("rust extractor (module tree scanner)", async () => {
  const s = await extract("rust", "src/lib.rs");
  it("follows mod declarations and keeps only externally reachable fns", () => {
    assert.deepEqual(names(s), ["cpf.format_cpf", "cpf.is_valid", "cpf.nested.deep", "cpf.validate", "format_cpf", "is_valid_cpf", "renamed", "root_fn"]);
  });
  it("resolves braced, renamed and private-module re-exports", () => {
    assert.equal(s.get("is_valid_cpf")?.aliasOf, "cpf.is_valid");
    assert.equal(s.get("renamed")?.aliasOf, "private_mod.reexported");
  });
  it("parses generics, lifetimes and where clauses", () => {
    assert.deepEqual(params(s.get("root_fn")), ["value: &'a str", "count: Option<u8>"]);
    assert.equal(s.get("root_fn")?.returns, "Result<Vec<String>, String>");
  });
  it("reads #[deprecated]", () => assert.equal(s.get("cpf.validate")?.deprecated, true));
});

describe("erlang extractor", async () => {
  const s = await extract("erlang", "src");
  const all = [...s.values()];
  it("uses the multi-line export list, one symbol per arity", async () => {
    const r = await getAdapter("erlang").extract({
      lib: { name: "e", language: "erlang", entry: "src", bindings: {}, ignore: [], waivers: {}, knownFailures: {}, options: {}, source: "" },
      root: path.join(FIXTURES, "erlang"),
      workDir: "/tmp"
    });
    assert.deepEqual(r.symbols.map((x) => `${x.name}/${x.params.length}`).sort(), ["demo.codes/0", "demo.format/1", "demo.generate/0", "demo.generate/1", "demo.is_valid/1"]);
    assert.equal(r.symbols.find((x) => x.name === "demo.generate" && x.params.length === 1)?.deprecated, true);
    assert.ok(all.length > 0);
  });
  it("takes types from -spec and names from clause heads / annotations", () => {
    assert.deepEqual(params(s.get("demo.format")), ["cpf: binary()"]);
    assert.equal(s.get("demo.format")?.returns, "{ok, cpf()} | {error, invalid}");
  });
});

describe(".NET extractor (F# + C#)", async () => {
  const s = await extract("dotnet", "Lib");
  it("reads F# module lets (BOM, private, nested modules, values excluded) and C# public statics", () => {
    assert.deepEqual(names(s), ["Cnpj.Format", "Cnpj.Generate", "Cnpj.IsValid", "Cnpj.Validate", "Cpf.Codes", "Cpf.Format", "Cpf.Generate", "Cpf.IsValid", "Cpf.Validate", "Nested.Inner"]);
  });
  it("parses F# annotations, unit and tupled params", () => {
    assert.deepEqual(params(s.get("Cpf.Format")), ["cpf: string"]);
    assert.equal(s.get("Cpf.Format")?.returns, "string option");
    assert.deepEqual(params(s.get("Cpf.Generate")), []);
    assert.deepEqual(params(s.get("Nested.Inner")), ["a: int", "b: int"]);
  });
  it("parses C# defaults, params arrays and [Obsolete]", () => {
    assert.deepEqual(params(s.get("Cnpj.Format")), ["cnpj: string", "pad?: bool"]);
    assert.equal(s.get("Cnpj.Generate")?.params[0].rest, true);
    assert.equal(s.get("Cnpj.Validate")?.deprecated, true);
    assert.equal(s.get("Cpf.Validate")?.deprecated, true);
  });
});

describe("typescript extractor (type checker)", async () => {
  const s = await extract("typescript", "src/index.ts");
  it("follows re-exports, skips types/classes/constants", () => {
    assert.deepEqual(names(s), ["formatCpf", "generateCpf", "isValidCPF", "isValidCpf"]);
  });
  it("expands aliases of primitive unions and infers missing return types", () => {
    assert.deepEqual(params(s.get("generateCpf")), ["state?: string"]);
    assert.equal(s.get("generateCpf")?.returns, "string");
  });
  it("marks @deprecated aliases", () => {
    assert.equal(s.get("isValidCPF")?.deprecated, true);
    assert.equal(s.get("isValidCPF")?.aliasOf, "isValidCpf");
  });
});

describe("go extractor (go/parser)", { skip: !which("go") && "go not installed" }, async () => {
  const s = await extract("go", ".");
  it("exported top-level funcs only (no methods, tests, internal/)", () => {
    assert.deepEqual(names(s), ["cpf.Format", "cpf.IsValid", "cpf.Join", "cpf.Lookup", "cpf.Validate"]);
  });
  it("records results, variadics and Deprecated: docs", () => {
    assert.equal(s.get("cpf.Format")?.returns, "(string, error)");
    assert.deepEqual(params(s.get("cpf.Join")), ["sep: string", "...parts?: string"]);
    assert.equal(s.get("cpf.Validate")?.deprecated, true);
    assert.equal(s.get("cpf.Format")?.meta?.importPath, "example.com/fixture/cpf");
  });
});

describe("ruby extractor (reflection)", { skip: !which("ruby") && "ruby not installed" }, async () => {
  const s = await extract("ruby", "lib", { namespace: "Demo" });
  it("public singleton methods incl. class << self; private_class_method and exception classes excluded", () => {
    assert.deepEqual(names(s), ["CPFUtils.format_cpf", "CPFUtils.generate", "CPFUtils.valid?", "CPFUtils.validate"]);
  });
  it("reads YARD types and keyword params", () => {
    assert.deepEqual(params(s.get("CPFUtils.format_cpf")), ["cpf: String", "pad?(kw)"]);
    assert.equal(s.get("CPFUtils.format_cpf")?.returns, "String | nil");
    assert.equal(s.get("CPFUtils.validate")?.deprecated, true);
  });
});
