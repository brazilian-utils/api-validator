/**
 * Contract tests as a vitest suite next to the lib's entry point, importing the public entry
 * (`import * as lib from "./index"`), so only exported API is exercised. When the lib has a
 * cross-runtime test shim (`src/_internals/test/runtime.ts`, which runs the same suite on
 * vitest, Bun and Deno) it is used instead of importing vitest directly.
 *
 * Values are compared like the conformance runner does: undefined == null, objects
 * with keys compared case/separator-insensitively and null fields dropped.
 */
import fs from "node:fs";
import path from "node:path";
import { checkParam, type CType } from "../../core/ctype.js";
import type { NativeSymbol, TypeNode } from "../../core/model.js";
import type { ExportCase, ExportGroup, Rendered } from "../../core/testgen.js";
import type { AdapterContext, TestGenerator } from "../types.js";

const SHIM = "src/_internals/test/runtime.ts";

function testPath(ctx: AdapterContext): string {
  const entry = ctx.lib.entry;
  return path.posix.join(path.posix.dirname(entry), "api-contract.test.ts");
}

function importPath(from: string, to: string): string {
  let rel = path.posix.relative(path.posix.dirname(from), to).replace(/\.[cm]?[tj]sx?$/, "");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

const ref = (s: NativeSymbol) => `lib.${s.name}`;
const lit = (v: unknown) => JSON.stringify(v);

const isPromise = (s: NativeSymbol) => s.returnsNode?.kind === "name" && s.returnsNode.name === "Promise";

type MapType = (t: TypeNode | undefined) => CType;

/** Assert the argument type only when the checker cannot prove it fits (the lib lints needless assertions). */
function feed(value: string, from: NativeSymbol, to: NativeSymbol, mapType: MapType): string {
  const produced = isPromise(from) && from.returnsNode?.kind === "name" ? from.returnsNode.args?.[0] : from.returnsNode;
  return checkParam(mapType(produced), mapType(to.params[0]?.typeNode)).level === "ok" ? value : `${value} as never`;
}

function body(c: ExportCase, call: string, mapType: MapType): string[] {
  const e = c.expect;
  const v = isPromise(c.symbol) ? `(await ${call})` : call;
  switch (e.kind) {
    case "returns":
      if (e.value === null) return [`expect(${v} ?? null).toBeNull();`];
      if (typeof e.value === "number" && !Number.isInteger(e.value)) return [`expect(${v}).toBeCloseTo(${lit(e.value)}, 9);`];
      if (typeof e.value === "object") return [`expect(norm(${v})).toEqual(norm(${lit(e.value)}));`];
      return [`expect(${v}).toBe(${lit(e.value)});`];
    case "throws":
      return isPromise(c.symbol) ? [`await expect(${call}).rejects.toThrow();`] : [`expect(() => ${call}).toThrow();`];
    case "matches":
      return [`expect(${v}).toMatch(new RegExp(${lit(e.pattern)}));`];
    case "satisfies":
      return [`const value = ${v};`, `expect(${ref(c.target!)}(${feed("value", c.symbol, c.target!, mapType)})).toBe(true);`];
  }
}

const NORM = [
  "/** Compare like the api-validator: keys case/separator-insensitive, null fields dropped. */",
  "const norm = (v: unknown): unknown => {",
  "\tif (v instanceof Date) return v.toISOString();",
  "\tif (Array.isArray(v)) return v.map(norm);",
  "\tif (v !== null && typeof v === \"object\")",
  "\t\treturn Object.fromEntries(",
  "\t\t\tObject.entries(v)",
  "\t\t\t\t.filter(([, x]) => x !== null && x !== undefined)",
  "\t\t\t\t.map(([k, x]) => [k.toLowerCase().replaceAll(/[^a-z0-9]/g, \"\"), norm(x)]),",
  "\t\t);",
  "\treturn v;",
  "};",
  ""
];

function render(ctx: AdapterContext, groups: ExportGroup[], header: string[], mapType: MapType): Rendered {
  const file = testPath(ctx);
  const shim = fs.existsSync(path.join(ctx.root, SHIM));
  const out: string[] = [
    ...header.map((h) => `// ${h}`.trimEnd()),
    "",
    `import { describe, expect, it } from ${lit(shim ? importPath(file, SHIM) : "vitest")};`,
    `import * as lib from ${lit(importPath(file, ctx.lib.entry))};`,
    ""
  ];
  const used = (kind: string, f: (c: ExportCase) => boolean) => groups.some((g) => g.cases.some((c) => c.expect.kind === kind && f(c)));
  if (used("returns", (c) => c.expect.kind === "returns" && c.expect.value !== null && typeof c.expect.value === "object")) out.push(...NORM);
  groups.forEach((g, gi) => {
    out.push(...(gi > 0 ? [""] : []), `describe(${lit(`${g.fnId} -> ${g.symbol.name}`)}, () => {`);
    g.cases.forEach((c, i) => {
      const call = `${ref(c.symbol)}(${c.args.map(lit).join(", ")})`;
      let lines = body(c, call, mapType);
      if (c.repeat > 1) lines = [`for (let i = 0; i < ${c.repeat}; i++) {`, ...lines.map((l) => `\t${l}`), "}"];
      const test = [`it(${lit(c.slug.join(" "))}, ${lines.some((l) => l.includes("await ")) ? "async " : ""}() => {`, `\t// ${c.id}`, ...lines.map((l) => `\t${l}`), "});"];
      if (i > 0) out.push("");
      if (c.note) out.push(`\t// ${c.note.replace(/\s+/g, " ")}`);
      // describe.skip: the one skip every runtime of the shim (vitest, Bun, Deno) provides.
      const block = c.skip ? [`describe.skip(${lit(`skipped: ${c.skip}`)}, () => {`, ...test.map((l) => `\t${l}`), "});"] : test;
      out.push(...block.map((l) => `\t${l}`));
    });
    out.push("});");
  });
  return { content: out.join("\n") + "\n", unexpressible: [] };
}

export function typescriptTestgen(mapType: MapType): TestGenerator {
  return {
    framework: "vitest",
    path: testPath,
    command: (ctx) => `npm test -- ${testPath(ctx)}`,
    render: (ctx, groups, header) => render(ctx, groups, header, mapType)
  };
}
