import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { ExportCase, ExportGroup } from "../src/core/testgen.js";
import type { Expectation, LibConfig, NativeSymbol, TypeNode } from "../src/core/model.js";
import { run, which } from "../src/core/shell.js";
import { rustTestgen, tidy } from "../src/languages/rust/testgen.js";

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "rust");
const hasCargo = !!which("cargo");

const n = (name: string, ...args: TypeNode[]): TypeNode => (args.length ? { kind: "name", name, args } : { kind: "name", name });
const strRef: TypeNode = { kind: "ref", op: "&", of: n("str") };

function sym(rustPath: string, params: TypeNode[], returnsNode?: TypeNode): NativeSymbol {
  return { name: rustPath.replaceAll("::", "."), params: params.map((typeNode, i) => ({ name: `p${i}`, typeNode, optional: false })), returnsNode, meta: { rustPath } } as NativeSymbol;
}

// Symbols of test/fixtures/rust (built by hand: no nightly rustdoc needed).
const isValid = sym("cpf::is_valid", [strRef], n("bool"));
const formatCpf = sym("cpf::format_cpf", [strRef], n("Option", n("String")));
const deep = sym("cpf::nested::deep", [n("i32")], n("i32"));
const rootFn = sym("root_fn", [strRef, n("Option", n("u8"))], n("Result", n("Vec", n("String")), n("String")));

let seq = 0;
function kase(symbol: NativeSymbol, args: unknown[], expect: Expectation, extra: Partial<ExportCase> = {}): ExportCase {
  const slug = extra.slug ?? [`case${++seq}`];
  return { id: `x.fn#${slug.join("-")}`, fnId: "x.fn", slug, symbol, args, expect, repeat: 1, ...extra };
}
const group = (fnId: string, cases: ExportCase[]): ExportGroup => ({ fnId, symbol: cases[0].symbol, cases: cases.map((c) => ({ ...c, fnId, id: `${fnId}#${c.slug.join("-")}` })) });

function ctxFor(root: string) {
  const lib: LibConfig = { name: "fixture", language: "rust", entry: "src/lib.rs", bindings: {}, ignore: [], waivers: {}, knownFailures: {}, options: {}, source: "" };
  return { lib, root, workDir: os.tmpdir() };
}
const render = (groups: ExportGroup[], root = FIXTURE) => rustTestgen.render(ctxFor(root), groups, ["Generated.", "Run: cargo test"]);

describe("rust test generator (cargo test)", { skip: !hasCargo && "cargo not installed" }, () => {
  it("path and command", () => {
    assert.equal(rustTestgen.path(ctxFor(FIXTURE)), "tests/api_contract.rs");
    assert.equal(rustTestgen.command(ctxFor(FIXTURE)), "cargo test --test api_contract");
    assert.deepEqual(rustTestgen.format!(ctxFor(FIXTURE)), [["rustfmt", "--edition", "2021", "{file}"]]);
  });

  it("header, imports and one mod per function", () => {
    const { content } = render([group("cpf.isValid", [kase(isValid, ["1"], { kind: "returns", value: false })]), group("root", [kase(rootFn, ["a", null], { kind: "returns", value: [] })])]);
    assert.ok(content.startsWith("// Generated.\n// Run: cargo test\n\nuse fixture_crate::{cpf, root_fn};\n"));
    assert.match(content, /\/\/\/ cpf\.isValid -> `fixture_crate::cpf::is_valid`\nmod cpf_is_valid \{\n    use super::\*;\n/);
  });

  it("returns: bool, String, Option, integers, Result", () => {
    const { content } = render([
      group("x.fn", [
        kase(isValid, ["12345678901"], { kind: "returns", value: true }, { slug: ["valid"], note: "a  multi\nline note" }),
        kase(isValid, ["1"], { kind: "returns", value: false }, { slug: ["123"] }),
        kase(formatCpf, ["1"], { kind: "returns", value: "1" }),
        kase(formatCpf, [""], { kind: "returns", value: null }),
        kase(deep, [2], { kind: "returns", value: 2 }),
        kase(sym("m::s", [], n("String")), [], { kind: "returns", value: 'a"b' }),
        kase(rootFn, ["a", 3], { kind: "returns", value: ["x"] }),
        kase(sym("m::f", [], n("f64")), [], { kind: "returns", value: 0.5 })
      ])
    ]);
    assert.match(content, /    \/\/ x\.fn#valid\n    \/\/ a multi line note\n    #\[test\]\n    fn valid\(\) \{\n        assert!\(cpf::is_valid\("12345678901"\)\);\n    \}/);
    assert.match(content, /fn case_123\(\) \{\n        assert!\(!cpf::is_valid\("1"\)\);/);
    assert.ok(content.includes('assert_eq!(cpf::format_cpf("1").as_deref(), Some("1"));'));
    assert.ok(content.includes('assert_eq!(cpf::format_cpf("").as_deref(), None);'));
    assert.ok(content.includes("assert_eq!(cpf::nested::deep(2i32), 2i32);"));
    assert.ok(content.includes('assert_eq!(m::s(), "a\\"b");'));
    assert.ok(content.includes('assert_eq!(root_fn("a", Some(3u8)).unwrap(), vec![String::from("x")]);'));
    assert.ok(content.includes("assert_close(m::f() as f64, 0.5);") && content.includes("fn assert_close(actual: f64, expected: f64)"));
  });

  it("throws: Err or panic for Result, panic otherwise (helpers only when used)", () => {
    const { content } = render([group("x.fn", [kase(rootFn, ["a", null], { kind: "throws" }), kase(isValid, ["x"], { kind: "throws" })])]);
    assert.ok(content.includes('assert!(fails(|| root_fn("a", None)));'));
    assert.ok(content.includes('assert!(panics(|| cpf::is_valid("x")));'));
    assert.ok(content.includes("fn fails<T, E>") && content.includes("fn panics<T>"));
    assert.ok(!render([group("x.fn", [kase(isValid, ["x"], { kind: "returns", value: true })])]).content.includes("fn panics"));
  });

  it("satisfies: the generated value is fed to the target (None fails)", () => {
    const { content } = render([group("x.fn", [kase(formatCpf, ["1"], { kind: "satisfies", fn: "cpf.isValid" }, { target: isValid, repeat: 3 })])]);
    assert.ok(
      content.includes(
        '        for _ in 0..3 {\n            let value = cpf::format_cpf("1").expect("returned None");\n            assert!(cpf::is_valid(&value), "{value:?} does not satisfy cpf.isValid");\n        }'
      )
    );
  });

  it("matches: regex when the lib depends on it, else unexpressible", () => {
    const c = kase(formatCpf, ["1"], { kind: "matches", pattern: "^\\d+$" });
    const none = render([group("x.fn", [c])]);
    assert.deepEqual(none.unexpressible.map((u) => u.id), [c.id]);
    assert.match(none.unexpressible[0].reason, /regex crate/);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "testgen-rust-"));
    fs.cpSync(FIXTURE, root, { recursive: true });
    fs.appendFileSync(path.join(root, "Cargo.toml"), '\n[dev-dependencies]\nregex = "1"\n');
    const { content, unexpressible } = render([group("x.fn", [c])], root);
    assert.deepEqual(unexpressible, []);
    assert.ok(content.includes("use regex::Regex;"));
    assert.ok(content.includes('let value = cpf::format_cpf("1").expect("returned None");'));
    assert.ok(content.includes('assert!(Regex::new("^\\\\d+$").unwrap().is_match(&value), "{value:?} does not match {}", "^\\\\d+$");'));
  });

  it("skip becomes #[ignore = reason]; unexpressible becomes a comment", () => {
    const { content, unexpressible } = render([
      group("x.fn", [
        kase(isValid, ["1"], { kind: "returns", value: true }, { slug: ["skipped"], skip: 'known failure: "x"' }),
        kase(isValid, [1], { kind: "returns", value: true }, { slug: ["bad"] }),
        kase(isValid, [], { kind: "returns", value: true }, { slug: ["arity"] })
      ]),
      group("only.bad", [kase(isValid, [1], { kind: "returns", value: true }, { slug: ["bad2"] })])
    ]);
    assert.ok(content.includes('    #[test]\n    #[ignore = "known failure: \\"x\\""]\n    fn skipped() {'));
    assert.deepEqual(
      unexpressible.map((u) => u.id),
      ["x.fn#bad", "x.fn#arity", "only.bad#bad2"]
    );
    assert.ok(content.includes("    // x.fn#bad\n    // not expressible in Rust: expected string, got 1\n"));
    assert.ok(content.includes("mod only_bad {\n    // only.bad#bad2\n"), "no `use super::*` in a mod without tests");
    assert.ok(!/fn bad\(/.test(content));
  });

  it("names: digits, keywords, helpers and duplicates become valid unique identifiers", () => {
    const { content } = render([
      group("x.fn", [
        kase(isValid, ["1"], { kind: "returns", value: true }, { slug: ["type"] }),
        kase(isValid, ["1"], { kind: "returns", value: true }, { slug: ["panics"] }),
        kase(isValid, ["1"], { kind: "returns", value: true }, { slug: ["a"] }),
        kase(isValid, ["1"], { kind: "returns", value: true }, { slug: ["A"] })
      ])
    ]);
    for (const f of ["case_type", "case_panics", "a", "a_2"]) assert.ok(content.includes(`fn ${f}() {`), f);
  });

  it("tidy strips the literal builders' parentheses outside strings only", () => {
    assert.equal(tidy('f((2u8), "(3u8)", \'(\', Some((-1i32)), vec![(1.5f64)])'), 'f(2u8, "(3u8)", \'(\', Some(-1i32), vec![1.5f64])');
    assert.equal(tidy("f(2u8)"), "f(2u8)");
  });

  it("is deterministic", () => {
    const groups = [group("x.fn", [kase(isValid, ["1"], { kind: "returns", value: true }, { slug: ["d"] })])];
    assert.equal(render(groups).content, render(groups).content);
  });

  it("runs natively against the fixture crate with the validator's outcomes", { timeout: 300_000 }, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "testgen-rust-run-"));
    fs.cpSync(FIXTURE, root, { recursive: true });
    const groups = [
      group("cpf.isValid", [
        kase(isValid, ["12345678901"], { kind: "returns", value: true }, { slug: ["valid"] }),
        kase(isValid, ["1"], { kind: "returns", value: false }, { slug: ["short"] }),
        kase(isValid, ["1"], { kind: "throws" }, { slug: ["never", "throws"] }),
        kase(isValid, [1], { kind: "returns", value: true }, { slug: ["number"] })
      ]),
      group("cpf.format", [
        kase(formatCpf, ["1"], { kind: "returns", value: "1" }, { slug: ["same"] }),
        kase(formatCpf, ["1"], { kind: "returns", value: null }, { slug: ["null"], skip: "known failure: returns Some" }),
        kase(formatCpf, ["12345678901"], { kind: "satisfies", fn: "cpf.isValid" }, { slug: ["valid", "output"], target: isValid, repeat: 3 })
      ]),
      group("cpf.deep", [kase(deep, [2], { kind: "returns", value: 2 }, { slug: ["identity"] })])
    ];
    const { content, unexpressible } = render(groups, root);
    assert.deepEqual(unexpressible.map((u) => u.id), ["cpf.isValid#number"]);
    fs.mkdirSync(path.join(root, "tests"));
    fs.writeFileSync(path.join(root, "tests", "api_contract.rs"), content);
    const r = run("cargo", ["test", "--offline", "--test", "api_contract"], { cwd: root, env: { ...process.env, CARGO_TARGET_DIR: path.join(root, "target") }, timeoutMs: 280_000 });
    assert.ok(/test result/.test(r.stdout), r.stderr);
    const outcomes = Object.fromEntries([...r.stdout.matchAll(/^test (\S+) \.\.\. (\w+)/gm)].map((m) => [m[1], m[2]]));
    assert.deepEqual(outcomes, {
      "cpf_is_valid::valid": "ok",
      "cpf_is_valid::short": "ok",
      "cpf_is_valid::never_throws": "FAILED", // the validator fails it too: is_valid never panics
      "cpf_format::same": "ok",
      "cpf_format::null": "ignored",
      "cpf_format::valid_output": "ok",
      "cpf_deep::identity": "ok"
    });
  });
});
