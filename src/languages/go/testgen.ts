/**
 * Contract tests as a `go test` file in a test-only package of the lib's module
 * (`apicontract/api_contract_test.go`), importing the lib's packages like any user would,
 * so only exported API is exercised. One `TestXxx` per contract function, one `t.Run`
 * sub-test per contract test.
 *
 * Calls are rendered by the conformance runner's own builders (`callBody`, `goLiteral`), so
 * arguments and result mapping are the same: `(T, error)` err -> error, `(T, bool)` false ->
 * nil, a panic counts as an error. Results are compared in their JSON form, like the
 * validator does (object keys case/separator-insensitive, null field == absent, numbers
 * with 1e-9 tolerance); the helpers doing that are written at the end of the file.
 */
import fs from "node:fs";
import path from "node:path";
import type { NativeSymbol } from "../../core/model.js";
import { pascal } from "../../core/naming.js";
import type { ExportCase, ExportGroup, Rendered, Unexpressible } from "../../core/testgen.js";
import type { AdapterContext, TestGenerator } from "../types.js";
import { callBody, goType, Unsupported, type Meta } from "./runner.js";

const DEFAULT_PATH = "apicontract/api_contract_test.go";

function testPath(ctx: AdapterContext): string {
  return typeof ctx.lib.options.testFile === "string" ? ctx.lib.options.testFile : DEFAULT_PATH;
}

/** JSON value -> Go expression of type `any` (compared after a JSON round trip). */
export function goValue(v: unknown): string {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v); // JSON string escapes are valid Go
  if (Array.isArray(v)) return `[]any{${v.map(goValue).join(", ")}}`;
  return `map[string]any{${Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${JSON.stringify(k)}: ${goValue(x)}`)
    .join(", ")}}`;
}

/** Go string literal, raw when that reads better (regexps). */
const goString = (s: string) => (/[`\r\n]/.test(s) || !/\\/.test(s) ? JSON.stringify(s) : `\`${s}\``);

/** Package clause: the package of the directory (external `_test` package), else its name. */
function packageName(ctx: AdapterContext, rel: string): string {
  const dir = path.posix.dirname(rel.split(path.sep).join("/"));
  const abs = path.join(ctx.root, dir);
  const sources = fs.existsSync(abs) ? fs.readdirSync(abs).filter((f) => f.endsWith(".go") && !f.endsWith("_test.go")).sort() : [];
  for (const f of sources) {
    const m = /^package\s+(\w+)/m.exec(fs.readFileSync(path.join(abs, f), "utf8"));
    if (m) return `${m[1]}_test`;
  }
  const base = (dir === "." ? "apicontract" : path.posix.basename(dir)).toLowerCase().replace(/[^a-z0-9_]/g, "");
  return /^[a-z_]/.test(base) ? base : `p${base}`;
}

/** Identifiers of the generated file a package alias must not shadow. */
const TAKEN = new Set([
  ...["fmt", "json", "math", "reflect", "regexp", "strings", "testing"],
  ...["call", "convert", "equal", "flat", "normalize", "show", "wantReturns", "wantError", "wantMatch", "wantSatisfies"],
  ...["t", "got", "err", "value", "i", "v0", "v1", "v2", "ptr"]
]);

interface Imports {
  alias(meta: Meta): string;
  lines(used: Set<string>): string[];
}

/** One import per lib package, named after the package unless that collides. */
function imports(groups: ExportGroup[]): Imports {
  const metas = new Map<string, Meta>();
  for (const c of groups.flatMap((g) => g.cases)) {
    for (const s of [c.symbol, c.target]) {
      const m = metaOf(s);
      if (m) metas.set(m.importPath, m);
    }
  }
  const paths = [...metas.keys()].sort();
  const count = new Map<string, number>();
  for (const p of paths) count.set(metas.get(p)!.package, (count.get(metas.get(p)!.package) ?? 0) + 1);
  const alias = new Map<string, string>();
  const used = new Set<string>();
  for (const p of paths) {
    const pkg = metas.get(p)!.package;
    let name = count.get(pkg)! > 1 ? p.split("/").slice(-2).join("").replace(/[^A-Za-z0-9_]/g, "").toLowerCase() : pkg;
    if (TAKEN.has(name)) name = `${name}pkg`;
    while (used.has(name)) name = `${name}_`;
    used.add(name);
    alias.set(p, name);
  }
  return {
    alias: (m) => alias.get(m.importPath)!,
    lines: (usedPaths) =>
      paths.filter((p) => usedPaths.has(p)).map((p) => (alias.get(p) === p.split("/").pop() ? `\t${JSON.stringify(p)}` : `\t${alias.get(p)} ${JSON.stringify(p)}`))
  };
}

function metaOf(s: NativeSymbol | undefined): Meta | undefined {
  const m = s?.meta as unknown as Meta | undefined;
  return m?.importPath && m.package && m.func ? m : undefined;
}

/** The runner's `func() (any, error)` body as gofmt'd lines (one-line `if`s expanded). */
function block(body: string): string[] {
  const lines = body
    .split("\n")
    .map((l) => l.replace(/^\t+/, ""))
    .flatMap((l) => {
      const m = /^if (.*) \{ (.*) \}$/.exec(l);
      return m ? [`if ${m[1]} {`, `\t${m[2]}`, "}"] : [l];
    });
  // `v0 := f(x)` + `return v0, nil` reads better as `return f(x), nil`.
  const single = lines.length === 2 && /^v0 := (.*)$/.exec(lines[0]);
  if (single && lines[1] === "return v0, nil") return [`return ${single[1]}, nil`];
  return lines;
}

/** JS-only regexp syntax RE2 (Go's regexp) rejects. */
const NOT_RE2 = /\(\?<?[=!]|\\[1-9]|\\k</;

/** Body lines of one sub-test (without the skip/repeat wrapping). Throws Unsupported. */
function caseBody(c: ExportCase, imp: Imports, usedPaths: Set<string>): string[] {
  const meta = metaOf(c.symbol);
  if (!meta) throw new Unsupported("symbol has no Go metadata");
  const alias = imp.alias(meta);
  const out = ["got, err := call(func() (any, error) {", ...block(callBody(c.symbol, meta, c.args, alias)).map((l) => `\t${l}`), "})"];
  usedPaths.add(meta.importPath);
  const e = c.expect;
  switch (e.kind) {
    case "returns":
      return [...out, `wantReturns(t, got, err, ${goValue(e.value)})`];
    case "throws":
      return [...out, "wantError(t, got, err)"];
    case "matches":
      if (NOT_RE2.test(e.pattern)) throw new Unsupported(`pattern /${e.pattern}/ uses syntax Go's regexp (RE2) does not support`);
      return [...out, `wantMatch(t, got, err, ${goString(e.pattern)})`];
    case "satisfies": {
      const tm = metaOf(c.target);
      if (!tm) throw new Unsupported("satisfies target has no Go metadata");
      const ta = imp.alias(tm);
      const check = callBody(c.target!, tm, ["value"], ta, (t) => `convert[${goType(t, ta, tm.importPath)}](t, value)`);
      usedPaths.add(tm.importPath);
      return [
        ...out,
        `wantSatisfies(t, got, err, ${JSON.stringify(c.target!.name)}, func(value any) (any, error) {`,
        ...block(check).map((l) => `\t${l}`),
        "})"
      ];
    }
  }
}

/** Header comment, first line in Go's `// Code generated ... DO NOT EDIT.` form (tools skip such files). */
function goHeader(header: string[]): string[] {
  const [first = "", ...rest] = header;
  const lines = /^Generated .* DO NOT EDIT\.$/.test(first) ? [`Code g${first.slice(1)}`, ...rest] : ["Code generated by brazilian-utils/api-validator. DO NOT EDIT.", ...header];
  return lines.map((h) => `// ${h}`.trimEnd());
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function render(ctx: AdapterContext, groups: ExportGroup[], header: string[]): Rendered {
  const unexpressible: Unexpressible[] = [];
  const imp = imports(groups);
  const usedPaths = new Set<string>();
  const tests: string[] = [];
  const funcNames = new Set<string>();
  for (const g of groups) {
    let name = `Test${pascal(g.fnId)}`;
    while (funcNames.has(name)) name = `${name}_`;
    funcNames.add(name);
    tests.push("", `// ${g.fnId} -> ${g.symbol.name}`, `func ${name}(t *testing.T) {`);
    g.cases.forEach((c, i) => {
      if (i > 0) tests.push("");
      let lines: string[];
      try {
        lines = caseBody(c, imp, usedPaths);
      } catch (e) {
        if (!(e instanceof Unsupported)) throw e;
        const reason = `not expressible in Go: ${e.message}`;
        unexpressible.push({ id: c.id, reason: e.message });
        tests.push(`\t// ${c.id}: ${reason}`);
        if (c.note) tests.push(`\t// ${oneLine(c.note)}`);
        return;
      }
      tests.push(`\tt.Run(${JSON.stringify(c.slug.join("_"))}, func(t *testing.T) {`, `\t\t// ${c.id}`);
      if (c.note) tests.push(`\t\t// ${oneLine(c.note)}`);
      if (c.skip) tests.push(`\t\tt.Skip(${JSON.stringify(c.skip)})`);
      if (c.repeat > 1) tests.push(`\t\tfor i := 0; i < ${c.repeat}; i++ {`, ...lines.map((l) => `\t\t\t${l}`), "\t\t}");
      else tests.push(...lines.map((l) => `\t\t${l}`));
      tests.push("\t})");
    });
    tests.push("}");
  }

  const libImports = imp.lines(usedPaths);
  const out = [
    ...goHeader(header),
    "",
    `package ${packageName(ctx, testPath(ctx))}`,
    "",
    "import (",
    '\t"encoding/json"',
    '\t"fmt"',
    '\t"math"',
    '\t"reflect"',
    '\t"regexp"',
    '\t"strings"',
    '\t"testing"',
    ...(libImports.length ? ["", ...libImports] : []),
    ")",
    ...tests,
    "",
    HELPERS
  ];
  return { content: out.join("\n"), unexpressible };
}

/** Comparison helpers: the Go version of the validator's result handling and valuesEqual. */
const HELPERS = `// ptr is used by calls taking pointer arguments.
func ptr[T any](v T) *T { return &v }

// call runs f, turning a panic into an error: the api-validator counts both as the call failing.
func call(f func() (any, error)) (v any, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic: %v", r)
		}
	}()
	return f()
}

// normalize returns v in its JSON form, which is what the api-validator compares. A result
// that is not JSON-serializable skips the test, as it does in the validator.
func normalize(t *testing.T, v any) any {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Skipf("result not JSON-serializable: %v", err)
	}
	var out any
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("result is not valid JSON: %v", err)
	}
	return out
}

// convert feeds a result to another function: its JSON value as that function's parameter type.
func convert[T any](t *testing.T, value any) T {
	t.Helper()
	var out T
	if value == nil {
		switch reflect.TypeOf(&out).Elem().Kind() {
		case reflect.Pointer, reflect.Slice, reflect.Map, reflect.Interface:
			return out
		}
		t.Skipf("cannot pass null as %T", out)
	}
	b, _ := json.Marshal(value)
	if err := json.Unmarshal(b, &out); err != nil {
		t.Skipf("cannot pass %s as %T: %v", b, out, err)
	}
	return out
}

// flat is the key used to compare object fields: \`zipCode\` == \`ZipCode\` == \`zip_code\`.
func flat(key string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			return r
		case r >= 'A' && r <= 'Z':
			return r + 'a' - 'A'
		}
		return -1
	}, strings.TrimRight(key, "?!="))
}

// equal compares JSON values like the api-validator: numbers with a 1e-9 tolerance, object
// keys case/separator-insensitively, and a null field equal to an absent one.
func equal(want, got any) bool {
	switch w := want.(type) {
	case nil:
		return got == nil
	case float64:
		g, ok := got.(float64)
		return ok && math.Abs(w-g) <= 1e-9*math.Max(1, math.Abs(w))
	case []any:
		g, ok := got.([]any)
		if !ok || len(g) != len(w) {
			return false
		}
		for i := range w {
			if !equal(w[i], g[i]) {
				return false
			}
		}
		return true
	case map[string]any:
		g, ok := got.(map[string]any)
		if !ok {
			return false
		}
		wf, gf := map[string]any{}, map[string]any{}
		for k, v := range w {
			wf[flat(k)] = v
		}
		for k, v := range g {
			gf[flat(k)] = v
		}
		for k := range wf {
			if !equal(wf[k], gf[k]) {
				return false
			}
		}
		for k := range gf {
			if !equal(wf[k], gf[k]) {
				return false
			}
		}
		return true
	}
	return want == got
}

func show(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%#v", v)
	}
	return string(b)
}

func wantReturns(t *testing.T, got any, err error, want any) {
	t.Helper()
	w := normalize(t, want)
	if err != nil {
		t.Fatalf("expected %s, got error: %v", show(w), err)
	}
	if g := normalize(t, got); !equal(w, g) {
		t.Fatalf("expected %s, got %s", show(w), show(g))
	}
}

func wantError(t *testing.T, got any, err error) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected an error, got %s", show(normalize(t, got)))
	}
}

func wantMatch(t *testing.T, got any, err error, pattern string) {
	t.Helper()
	if err != nil {
		t.Fatalf("expected /%s/, got error: %v", pattern, err)
	}
	g := normalize(t, got)
	if s, ok := g.(string); !ok || !regexp.MustCompile(pattern).MatchString(s) {
		t.Fatalf("expected /%s/, got %s", pattern, show(g))
	}
}

// wantSatisfies checks that the result, passed to the lib's own \`name\`, gives true.
func wantSatisfies(t *testing.T, got any, err error, name string, check func(value any) (any, error)) {
	t.Helper()
	if err != nil {
		t.Fatalf("expected a result, got error: %v", err)
	}
	g := normalize(t, got)
	ok, err := call(func() (any, error) { return check(g) })
	if err != nil {
		t.Fatalf("%s does not satisfy %s (error: %v)", show(g), name, err)
	}
	if o := normalize(t, ok); o != true {
		t.Fatalf("%s does not satisfy %s (got %s)", show(g), name, show(o))
	}
}
`;

export const goTestgen: TestGenerator = {
  framework: "go test",
  path: testPath,
  command: (ctx) => `go test ./${path.posix.dirname(testPath(ctx).split(path.sep).join("/"))}`.replace(/\/\.$/, "/."),
  render,
  // The file is rendered gofmt-clean already; gofmt keeps it so if the rendering drifts.
  format: () => [["gofmt", "-w", "{file}"]]
};
