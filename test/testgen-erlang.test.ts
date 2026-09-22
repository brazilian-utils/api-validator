import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { ExportCase, ExportGroup } from "../src/core/testgen.js";
import type { Expectation, LibConfig, NativeSymbol, TypeNode } from "../src/core/model.js";
import { which } from "../src/core/shell.js";
import { getAdapter } from "../src/languages/registry.js";
import { erlangTestgen } from "../src/languages/erlang/testgen.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

const lib = (options: Record<string, unknown> = {}): LibConfig => ({
  name: "erl",
  language: "erlang",
  entry: "src",
  bindings: {},
  ignore: [],
  waivers: {},
  knownFailures: {},
  options,
  source: ""
});
const ctx = (options: Record<string, unknown> = {}) => ({ lib: lib(options), root: "/nowhere", workDir: "/nowhere" });

const call = (name: string): TypeNode => ({ kind: "name", name, call: true });
const atom = (name: string): TypeNode => ({ kind: "name", name });
const okOrError = (t: TypeNode): TypeNode => ({ kind: "union", of: [{ kind: "tuple", of: [atom("ok"), t] }, { kind: "tuple", of: [atom("error"), atom("invalid")] }] });

function sym(name: string, arity: number, returnsNode?: TypeNode): NativeSymbol {
  const [module] = name.split(".");
  return { name, params: Array.from({ length: arity }, (_, i) => ({ name: `arg${i}` })), returnsNode, meta: { module, arity } } as NativeSymbol;
}

const isValid = sym("m.is_valid", 1, call("boolean"));
const format = sym("m.format", 1, okOrError(call("binary")));
const kind = sym("m.kind", 1, { kind: "union", of: [atom("mobile"), atom("landline")] });
const count = sym("m.count", 1, call("integer"));
const info = sym("m.info", 1, call("map"));
const generate = sym("m.generate", 0, call("binary"));

function kase(symbol: NativeSymbol, args: unknown[], expect: Expectation, extra: Partial<ExportCase> = {}): ExportCase {
  const slug = extra.slug ?? ["case", String(Math.abs(JSON.stringify([args, expect]).length))];
  return { id: `x.fn#${slug.join("-")}`, fnId: "x.fn", slug, symbol, args, expect, repeat: 1, ...extra };
}

const render = (cases: ExportCase[], options: Record<string, unknown> = {}) =>
  erlangTestgen.render(ctx(options), [{ fnId: "x.fn", symbol: cases[0].symbol, cases }], ["Generated.", "Run: x"]);

describe("erlang test generator (EUnit)", () => {
  it("path, command and module name", () => {
    assert.equal(erlangTestgen.path(ctx()), "test/brutils_api_contract_tests.erl");
    assert.equal(erlangTestgen.path(ctx({ app: "demo" })), "test/demo_api_contract_tests.erl");
    assert.equal(erlangTestgen.command(ctx()), "rebar3 eunit --module=brutils_api_contract_tests");
    const { content } = render([kase(isValid, ["1"], { kind: "returns", value: true })], { app: "demo" });
    assert.match(content, /^%% Generated\.\n%% Run: x\n-module\(demo_api_contract_tests\)\.\n\n-include_lib\("eunit\/include\/eunit.hrl"\)\./);
  });

  it("returns: the term the spec pins", () => {
    const { content } = render([
      kase(isValid, ["1"], { kind: "returns", value: true }, { slug: ["a"], note: "a note" }),
      kase(isValid, ["2"], { kind: "returns", value: false }, { slug: ["b"] }),
      kase(format, ["123"], { kind: "returns", value: "1-23" }, { slug: ["c"] }),
      kase(kind, ["x"], { kind: "returns", value: "mobile" }, { slug: ["d"] }),
      kase(count, ["x"], { kind: "returns", value: 3 }, { slug: ["e"] })
    ]);
    assert.ok(content.includes('%% a note\nx_fn_a_test() ->\n    %% x.fn#a\n    ?assert(m:is_valid(<<"1"/utf8>>)).'));
    assert.ok(content.includes('?assertNot(m:is_valid(<<"2"/utf8>>)).'));
    assert.ok(content.includes('?assertEqual(<<"1-23"/utf8>>, value(m:format(<<"123"/utf8>>))).'));
    assert.ok(content.includes('?assertEqual(mobile, m:kind(<<"x"/utf8>>)).'));
    assert.ok(content.includes('?assertEqual(3, m:count(<<"x"/utf8>>)).'));
    assert.ok(content.includes("value({error, _} = Error) -> erlang:error({no_result, Error});"));
    assert.ok(!content.includes("same("), "no unused helpers (warnings_as_errors)");
  });

  it("returns: the api-validator's JSON view when the spec pins no term", () => {
    const { content } = render([
      kase(info, ["x"], { kind: "returns", value: { zipCode: "1", n: 0.5 } }, { slug: ["a"] }),
      kase(kind, ["x"], { kind: "returns", value: "LLLNLNN" }, { slug: ["b"] }),
      kase(sym("m.any", 0), [], { kind: "returns", value: "x" }, { slug: ["c"] })
    ]);
    assert.ok(content.includes('?assert(same(#{<<"zipCode"/utf8>> => <<"1"/utf8>>, <<"n"/utf8>> => 0.5}, canon(value(m:info(<<"x"/utf8>>))))).'));
    assert.ok(content.includes('?assert(same(<<"LLLNLNN"/utf8>>, canon(value(m:kind(<<"x"/utf8>>))))).'));
    assert.ok(content.includes('?assert(same(<<"x"/utf8>>, canon(value(m:any())))).'));
    assert.ok(content.includes("same(Expected, Actual) when is_number(Expected), is_number(Actual) ->"));
    assert.ok(content.includes("canon_key(Key) when is_atom(Key)"));
  });

  it("returns null, throws, matches", () => {
    const { content } = render([
      kase(format, ["x"], { kind: "returns", value: null }, { slug: ["a"] }),
      kase(format, ["x"], { kind: "throws" }, { slug: ["b"] }),
      kase(generate, [], { kind: "matches", pattern: "^\\d{3}\\u0041$" }, { slug: ["c"] }),
      kase(kind, ["x"], { kind: "matches", pattern: "^mob" }, { slug: ["d"] })
    ]);
    assert.ok(content.includes('?assert(no_result(m:format(<<"x"/utf8>>))).'));
    assert.ok(content.includes('?assertMatch({failed, _}, attempt(fun() -> m:format(<<"x"/utf8>>) end)).'));
    assert.ok(content.includes('?assertMatch({match, _}, re:run(m:generate(), <<"^\\\\d{3}\\\\x{0041}$"/utf8>>, [unicode, dollar_endonly])).'));
    assert.ok(content.includes('re:run(text(value(m:kind(<<"x"/utf8>>))), <<"^mob"/utf8>>'));
    for (const h of ["no_result(", "attempt(Fun) ->", "text(Value) when is_binary"]) assert.ok(content.includes(h), h);
  });

  it("satisfies with repeat: a loop feeding the lib's own function", () => {
    const { content } = render([kase(generate, [], { kind: "satisfies", fn: "x.isValid" }, { slug: ["gen"], repeat: 5, target: isValid })]);
    assert.ok(
      content.includes(
        [
          "x_fn_gen_test() ->",
          "    %% x.fn#gen",
          "    lists:foreach(",
          "      fun(_) ->",
          "              Value = m:generate(),",
          "              ?assert(m:is_valid(Value))",
          "      end,",
          "      lists:seq(1, 5))."
        ].join("\n")
      )
    );
    const loose = render([kase(sym("m.gen", 0, okOrError(call("term"))), [], { kind: "satisfies", fn: "x.v" }, { slug: ["g"], target: sym("m.v", 1) })]).content;
    assert.ok(loose.includes("Value = value(m:gen()),\n    ?assert(value(m:v(canon(Value))))."));
  });

  it("skip: an empty titled group with the reason, the assertion kept as a comment", () => {
    const { content } = render([kase(isValid, ['a"b'], { kind: "returns", value: false }, { slug: ["s"], skip: 'known failure: "quoted"' })]);
    assert.ok(
      content.includes(
        ['x_fn_s_test_() ->', "    %% x.fn#s", '    %% ?assertNot(m:is_valid(<<"a\\"b"/utf8>>))', '    {"SKIPPED: known failure: \\"quoted\\"", []}.'].join("\n")
      )
    );
    assert.ok(!content.includes("value("), "helpers used only by skipped tests are not emitted");
  });

  it("unexpressible cases are reported and left as a comment", () => {
    const r = render([
      kase(isValid, ["a", "b"], { kind: "returns", value: true }, { slug: ["a"] }),
      kase(generate, [], { kind: "matches", pattern: "^[^]$" }, { slug: ["b"] })
    ]);
    assert.deepEqual(
      r.unexpressible.map((u) => u.id),
      ["x.fn#a", "x.fn#b"]
    );
    assert.match(r.unexpressible[0].reason, /m\.is_valid\/1 called with 2 argument/);
    assert.ok(r.content.includes("%% x.fn#a: not expressible in Erlang: m.is_valid/1 called with 2 argument(s)"));
    assert.ok(!r.content.includes("x_fn_a_test"));
  });

  it("is deterministic", () => {
    const cases = [kase(info, ["x"], { kind: "returns", value: { a: 1 } }), kase(format, ["x"], { kind: "throws" }, { slug: ["t"] })];
    assert.equal(render(cases).content, render(cases).content);
  });
});

/** eunit.hrl ships in a separate package on some distros (erlang-dev). */
function eunitAvailable(): boolean {
  if (!which("erlc") || !which("erl")) return false;
  const r = spawnSync("erl", ["-noshell", "-eval", 'io:format("~s", [code:lib_dir(eunit)]), halt().'], { encoding: "utf8" });
  return r.status === 0 && fs.existsSync(path.join(r.stdout.trim(), "include", "eunit.hrl"));
}

describe("erlang test generator against the fixture (erlc + EUnit)", { skip: !eunitAvailable() && "erlang/eunit not installed" }, () => {
  it("generates a module that compiles with warnings_as_errors and passes, failing on a wrong expectation", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "testgen-erlang-"));
    fs.cpSync(path.join(FIXTURES, "erlang"), root, { recursive: true });
    const c = { lib: lib({ app: "demo" }), root, workDir: fs.mkdtempSync(path.join(os.tmpdir(), "testgen-erlang-work-")) };
    const { symbols } = await getAdapter("erlang").extract(c);
    const s = (name: string, arity: number) => symbols.find((x) => x.name === name && x.params.length === arity)!;
    const cases: ExportCase[] = [
      kase(s("demo.is_valid", 1), ["12345678901"], { kind: "returns", value: true }, { slug: ["valid"] }),
      kase(s("demo.is_valid", 1), ["1"], { kind: "returns", value: false }, { slug: ["invalid"] }),
      kase(s("demo.format", 1), ["x"], { kind: "returns", value: "x" }, { slug: ["format"] }),
      kase(s("demo.codes", 0), [], { kind: "returns", value: [61, 62.0000000001] }, { slug: ["codes"] }),
      kase(s("demo.generate", 0), [], { kind: "matches", pattern: "^0{11}$" }, { slug: ["matches"] }),
      kase(s("demo.generate", 0), [], { kind: "satisfies", fn: "demo.isValid" }, { slug: ["gen"], repeat: 3, target: s("demo.is_valid", 1) }),
      kase(s("demo.is_valid", 1), ["1"], { kind: "returns", value: true }, { slug: ["skipped"], skip: "known failure: demo" })
    ];
    const groups = (cs: ExportCase[]): ExportGroup[] => [{ fnId: "demo.fn", symbol: cs[0].symbol, cases: cs }];
    const { content, unexpressible } = erlangTestgen.render(c, groups(cases), ["h"]);
    assert.deepEqual(unexpressible, []);
    assert.ok(content.includes('?assertEqual(<<"x"/utf8>>, value(demo:format(<<"x"/utf8>>))).'), "local type cpf() resolves to binary");

    const runModule = (file: string, text: string) => {
      fs.writeFileSync(path.join(root, "test", file), text);
      const ebin = path.join(c.workDir, "ebin-test");
      fs.mkdirSync(ebin, { recursive: true });
      // The generated module compiles under the lib's erl_opts (warnings_as_errors); the fixture has a deliberate unused function.
      for (const args of [["-o", ebin, path.join(root, "src", "demo.erl")], ["+warnings_as_errors", "-o", ebin, path.join(root, "test", file)]]) {
        const build = spawnSync("erlc", ["+debug_info", ...args], { encoding: "utf8" });
        assert.equal(build.status, 0, build.stdout + build.stderr);
      }
      const mod = path.basename(file, ".erl");
      return spawnSync("erl", ["-noshell", "-pa", ebin, "-eval", `case eunit:test(${mod}, [verbose]) of ok -> halt(0); _ -> halt(1) end.`], { encoding: "utf8" });
    };
    fs.mkdirSync(path.join(root, "test"), { recursive: true });
    const ok = runModule("demo_api_contract_tests.erl", content);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /All 6 tests passed/);
    assert.match(ok.stdout, /SKIPPED: known failure: demo/);

    const wrong = erlangTestgen.render({ ...c, lib: lib({ app: "demo", testFile: "test/wrong_tests.erl" }) }, groups([kase(s("demo.codes", 0), [], { kind: "returns", value: [61] })]), ["h"]);
    const bad = runModule("wrong_tests.erl", wrong.content);
    assert.notEqual(bad.status, 0, bad.stdout);
  });
});
