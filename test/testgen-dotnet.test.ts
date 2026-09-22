import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { ExportCase, ExportGroup } from "../src/core/testgen.js";
import type { LibConfig, NativeSymbol, TypeNode } from "../src/core/model.js";
import { run, which } from "../src/core/shell.js";
import { getAdapter } from "../src/languages/registry.js";
import { dotnetTestgen, findTestProject, wireFsproj } from "../src/languages/dotnet/testgen.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const n = (name: string, ...args: TypeNode[]): TypeNode => (args.length ? { kind: "name", name, args } : { kind: "name", name });

const lib = (options: Record<string, unknown> = {}): LibConfig => ({
  name: "lib",
  language: "dotnet",
  entry: "Lib",
  bindings: {},
  ignore: [],
  waivers: {},
  knownFailures: {},
  options,
  source: ""
});

function sym(name: string, params: TypeNode[], returnsNode?: TypeNode, groups?: number[]): NativeSymbol {
  return {
    name,
    params: params.map((typeNode, i) => ({ name: `p${i}`, typeNode })),
    returnsNode,
    meta: { qualified: `Lib.${name}`, groups: groups ?? [params.length || 0] }
  };
}

const isValid = sym("Cpf.IsValid", [n("string")], n("bool"));
const format = sym("Cpf.Format", [n("string")], n("option", n("string")));
const parse = sym("Cpf.Parse", [n("string")], n("FSharpResult", n("int"), n("string")));
const ratio = sym("Cpf.Ratio", [n("int"), n("int")], n("float"), [1, 1]);
const csFormat = sym("Cnpj.Format", [n("string")], { kind: "union", of: [n("string"), n("null")] });
const generate = sym("Cpf.Generate", [], n("string"));
const generateOpt = sym("Cpf.TryGenerate", [], n("option", n("string")));
const codes = sym("Cpf.Codes", [], n("list", n("int")));
const record = sym("Cep.Lookup", [n("string")], n("Address"));

let seq = 0;
const kase = (symbol: NativeSymbol, args: unknown[], expect: ExportCase["expect"], over: Partial<ExportCase> = {}): ExportCase => ({
  id: `${symbol.name}#${seq}`,
  fnId: symbol.name.toLowerCase(),
  slug: [`case`, String(seq++)],
  symbol,
  args,
  expect,
  repeat: 1,
  ...over
});

function render(...cases: ExportCase[]) {
  const groups: ExportGroup[] = [];
  for (const c of cases) {
    const g = groups.find((x) => x.fnId === c.fnId);
    if (g) g.cases.push(c);
    else groups.push({ fnId: c.fnId, symbol: c.symbol, cases: [c] });
  }
  const ctx = { lib: lib(), root: fs.mkdtempSync(path.join(os.tmpdir(), "tg-dotnet-")), workDir: os.tmpdir() };
  return dotnetTestgen.render(ctx, groups, ["Generated.", "Run: x"]);
}

describe(".NET test generator: rendering", () => {
  it("returns: bool asserts, option / C# nullable / Result values, null, float tolerance", () => {
    const { content, unexpressible } = render(
      kase(isValid, ["123"], { kind: "returns", value: true }),
      kase(isValid, [""], { kind: "returns", value: false }),
      kase(format, ["1"], { kind: "returns", value: "1" }),
      kase(format, ["x"], { kind: "returns", value: null }),
      kase(csFormat, ["x"], { kind: "returns", value: "x" }),
      kase(parse, ["7"], { kind: "returns", value: 7 }),
      kase(ratio, [1, 3], { kind: "returns", value: 0.333333333333 }),
      kase(codes, [], { kind: "returns", value: [1, 2] })
    );
    assert.deepEqual(unexpressible, []);
    assert.match(content, /^\/\/ Generated\.\n\/\/ Run: x\n\nmodule ApiContractTests\n\nopen Xunit\n/);
    assert.ok(content.includes('Assert.True(Lib.Cpf.IsValid ("123"))'));
    assert.ok(content.includes('Assert.False(Lib.Cpf.IsValid (""))'));
    assert.ok(content.includes('Assert.Equal((Some "1"), Lib.Cpf.Format ("1"))'));
    assert.ok(content.includes('Assert.Null(box (Lib.Cpf.Format ("x")))'));
    assert.ok(content.includes('Assert.Equal("x", Lib.Cnpj.Format ("x"))'));
    assert.ok(content.includes('Assert.Equal(7, ok (Lib.Cpf.Parse ("7")))'));
    assert.ok(content.includes("let private ok (r: Result<'T, 'E>) : 'T ="));
    assert.ok(content.includes("close 0.333333333333 (float (Lib.Cpf.Ratio (1) (3)))"));
    assert.ok(content.includes("Assert.Equal<int>([ 1; 2 ], Lib.Cpf.Codes ())"));
    assert.ok(content.includes("let private close (expected: float) (actual: float) ="));
  });

  it("throws, matches and satisfies (with repeat and option -> string conversion)", () => {
    const { content } = render(
      kase(parse, ["x"], { kind: "throws" }),
      kase(format, ["1"], { kind: "matches", pattern: '^\\d"$' }),
      kase(generate, [], { kind: "satisfies", fn: "cpf.isValid" }, { target: isValid, repeat: 5 }),
      kase(generateOpt, [], { kind: "satisfies", fn: "cpf.isValid" }, { target: isValid })
    );
    assert.ok(content.includes('Assert.ThrowsAny<exn>(fun () -> ok (Lib.Cpf.Parse ("x")) |> ignore) |> ignore'));
    assert.ok(content.includes('Assert.Matches(@"^\\d""$", Option.toObj (Lib.Cpf.Format ("1")))'));
    assert.ok(
      content.includes(
        [
          "        for _ in 1 .. 5 do",
          "            let value = Lib.Cpf.Generate ()",
          '            Assert.True(Lib.Cpf.IsValid (value), sprintf "%A" value)'
        ].join("\n")
      )
    );
    assert.ok(content.includes('Assert.True(Lib.Cpf.IsValid ((Option.toObj value)), sprintf "%A" value)'));
  });

  it("skip with reason, test name from the slug, id and note as comments", () => {
    const { content } = render(kase(isValid, ["1"], { kind: "returns", value: true }, { slug: ["valid", "sample"], skip: 'known failure: "x"', note: "a\n note" }));
    assert.ok(
      content.includes(
        [
          '    [<Fact(Skip = "known failure: \\"x\\"")>]',
          "    let ``valid sample`` () =",
          `        // ${"Cpf.IsValid#" + (seq - 1)}`,
          "        // a note",
          '        Assert.True(Lib.Cpf.IsValid ("1"))'
        ].join("\n")
      )
    );
  });

  it("unexpressible cases become comments (a module with none left is only comments)", () => {
    const { content, unexpressible } = render(
      kase(isValid, [1], { kind: "returns", value: true }, { fnId: "a" }),
      kase(record, ["1"], { kind: "returns", value: { street: "x" } }, { fnId: "b" }),
      kase(isValid, ["1", "2"], { kind: "returns", value: true }, { fnId: "b" }),
      kase(isValid, ["1"], { kind: "returns", value: true }, { fnId: "b" })
    );
    assert.deepEqual(
      unexpressible.map((u) => u.reason),
      ["1 is not a string", "object results are compared field by field (case-insensitive keys), no F# literal", "2 args for 1 params"]
    );
    assert.ok(!content.includes("module A ="));
    assert.ok(content.includes("module B ="));
    assert.ok(content.includes("// not expressible in F#: 1 is not a string"));
    assert.ok(content.includes("    // not expressible in F#: 2 args for 1 params"));
  });

  it("is deterministic", () => {
    const cases = [kase(isValid, ["1"], { kind: "returns", value: true })];
    assert.equal(render(...cases).content, render(...cases).content);
  });
});

describe(".NET test generator: location and wiring", () => {
  it("finds the lib's F# test project and derives path, module and command", () => {
    const root = path.join(FIXTURES, "dotnet");
    assert.equal(findTestProject(root), path.join("Lib.Tests", "Lib.Tests.fsproj"));
    const ctx = { lib: lib(), root, workDir: os.tmpdir() };
    assert.equal(dotnetTestgen.path(ctx), "Lib.Tests/ApiContractTests.fs");
    assert.equal(dotnetTestgen.command(ctx), "dotnet test Lib.Tests/Lib.Tests.fsproj --filter FullyQualifiedName~Lib.Tests.ApiContractTests");
    assert.match(dotnetTestgen.render(ctx, [], []).content, /^\nmodule Lib\.Tests\.ApiContractTests\n/);
  });

  it("adds the <Compile Include> before the entry file, once", () => {
    const proj = ['<Project Sdk="Microsoft.NET.Sdk">', "  <ItemGroup>", '    <Compile Include="A.fs" />', '    <Compile Include="Main.fs" />', "  </ItemGroup>", "</Project>"].join("\n");
    const wired = wireFsproj(proj, "ApiContractTests.fs")!;
    assert.ok(wired.includes('    <Compile Include="A.fs" />\n    <Compile Include="ApiContractTests.fs" />\n    <Compile Include="Main.fs" />'));
    assert.equal(wireFsproj(wired, "ApiContractTests.fs"), undefined);
  });

  it("appends after the last Compile Include without an entry file", () => {
    const proj = ["<Project>", "  <ItemGroup>", '    <Compile Include="A.fs" />', '    <Compile Include="B.fs" />', "  </ItemGroup>", "</Project>"].join("\n");
    assert.ok(wireFsproj(proj, "Sub\\T.fs")!.includes('    <Compile Include="B.fs" />\n    <Compile Include="Sub\\T.fs" />\n  </ItemGroup>'));
  });
});

describe(".NET test generator: native run on the fixture", { skip: !which("dotnet") && "no dotnet", timeout: 600_000 }, () => {
  it("generates into a copy of the fixture, wires it and passes under dotnet test", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tg-dotnet-fixture-"));
    fs.cpSync(path.join(FIXTURES, "dotnet"), root, { recursive: true, filter: (src) => !/[\\/](bin|obj)$/.test(src) });
    const ctx = { lib: lib(), root, workDir: fs.mkdtempSync(path.join(os.tmpdir(), "tg-dotnet-work-")) };
    const { symbols } = await getAdapter("dotnet").extract(ctx);
    const s = (name: string) => symbols.find((x) => x.name === name)!;
    const cases = [
      kase(s("Cpf.IsValid"), ["x"], { kind: "returns", value: true }),
      kase(s("Cpf.IsValid"), [""], { kind: "returns", value: false }),
      kase(s("Cpf.Format"), ["1"], { kind: "returns", value: "1" }),
      kase(s("Cpf.Format"), ["12"], { kind: "matches", pattern: "^\\d+$" }),
      kase(s("Cpf.Codes"), [], { kind: "returns", value: [1, 2] }),
      kase(s("Nested.Inner"), [1, 2], { kind: "returns", value: 3 }),
      kase(s("Cpf.Generate"), [], { kind: "satisfies", fn: "cpf.isValid" }, { target: s("Cpf.IsValid"), repeat: 3 }),
      kase(s("Cpf.IsValid"), ["x"], { kind: "throws" }, { skip: "does not throw" }),
      kase(s("Cpf.IsValid"), [1], { kind: "returns", value: true })
    ];
    const groups: ExportGroup[] = cases.map((c, i) => ({ fnId: `f${i}`, symbol: c.symbol, cases: [c] }));
    const rel = dotnetTestgen.path(ctx);
    const rendered = dotnetTestgen.render(ctx, groups, ["generated"]);
    assert.deepEqual(rendered.unexpressible.map((u) => u.reason), ["1 is not a string"]);
    fs.writeFileSync(path.join(root, rel), rendered.content);
    for (const w of dotnetTestgen.wire!(ctx, rel)) fs.writeFileSync(path.join(root, w.path), w.content);
    assert.deepEqual(dotnetTestgen.wire!(ctx, rel), []);
    const [bin, ...args] = dotnetTestgen.command(ctx).split(" ");
    const r = run(bin, args, { cwd: root, env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" }, timeoutMs: 600_000 });
    const out = r.stdout + r.stderr;
    assert.equal(r.status, 0, out.slice(-3000));
    assert.match(out, /Failed:\s+0, Passed:\s+7, Skipped:\s+1, Total:\s+8/);
  });
});
