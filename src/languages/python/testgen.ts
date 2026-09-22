/**
 * Contract tests as a unittest module (the Python lib's framework; pytest runs it too).
 * Values are compared after the same normalisation the conformance runner applies
 * (dataclasses/objects -> dicts, keys compared case/separator-insensitively, None fields
 * dropped), so the file passes exactly when `check --tests` does.
 */
import type { ExportCase, ExportGroup, Rendered, Unexpressible } from "../../core/testgen.js";
import type { NativeSymbol } from "../../core/model.js";
import { pascal, snake } from "../../core/naming.js";
import type { AdapterContext, TestGenerator } from "../types.js";

/** JSON value -> Python literal. */
export function pyLiteral(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "string") return JSON.stringify(v); // JSON string escapes are valid Python
  if (Array.isArray(v)) return `[${v.map(pyLiteral).join(", ")}]`;
  return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${JSON.stringify(k)}: ${pyLiteral(x)}`).join(", ")}}`;
}

interface Imported {
  lines: string[];
  ref(symbol: NativeSymbol): string;
}

/** `from pkg.sub import mod` per module used, aliased when last components collide. */
function imports(groups: ExportGroup[]): Imported {
  const modules = new Set<string>();
  for (const c of groups.flatMap((g) => g.cases)) for (const s of [c.symbol, c.target]) if (s) modules.add(moduleOf(s));
  const sorted = [...modules].sort();
  const lastCount = new Map<string, number>();
  for (const m of sorted) lastCount.set(m.split(".").pop()!, (lastCount.get(m.split(".").pop()!) ?? 0) + 1);
  const alias = new Map<string, string>();
  const lines: string[] = [];
  for (const m of sorted) {
    const parts = m.split(".");
    const last = parts[parts.length - 1];
    if (parts.length === 1) {
      lines.push(`import ${m}`);
      alias.set(m, m);
      continue;
    }
    const name = lastCount.get(last)! > 1 ? parts.slice(1).join("_") : last;
    lines.push(`from ${parts.slice(0, -1).join(".")} import ${last}${name !== last ? ` as ${name}` : ""}`);
    alias.set(m, name);
  }
  return { lines, ref: (s) => `${alias.get(moduleOf(s))}.${attrOf(s)}` };
}

const moduleOf = (s: NativeSymbol) => String(s.meta?.module);
const attrOf = (s: NativeSymbol) => String(s.meta?.attr ?? s.name.split(".").pop());

const needsNorm = (v: unknown) => v !== null && (typeof v === "object" || (typeof v === "number" && !Number.isInteger(v)));

function body(c: ExportCase, call: string, ref: Imported["ref"]): string[] {
  const e = c.expect;
  switch (e.kind) {
    case "returns":
      if (e.value === null) return [`self.assertIsNone(${call})`];
      if (typeof e.value === "boolean") return [`self.assertIs(${call}, ${pyLiteral(e.value)})`];
      if (needsNorm(e.value)) return [`self.assertEqual(_norm(${call}), _norm(${pyLiteral(e.value)}))`];
      return [`self.assertEqual(${call}, ${pyLiteral(e.value)})`];
    case "throws":
      return ["with self.assertRaises(Exception):", `    ${call}`];
    case "matches":
      return [`self.assertRegex(${call}, ${JSON.stringify(e.pattern)})`];
    case "satisfies":
      return [`value = ${call}`, `self.assertIs(${ref(c.target!)}(value), True, value)`];
  }
}

function render(_ctx: AdapterContext, groups: ExportGroup[], header: string[]): Rendered {
  const unexpressible: Unexpressible[] = [];
  const imp = imports(groups);
  const out: string[] = [
    ...header.map((h) => `# ${h}`.trimEnd()),
    "",
    "import dataclasses",
    "import decimal",
    "import enum",
    "import re",
    "import unittest",
    "",
    ...imp.lines,
    "",
    "",
    "def _norm(v):",
    '    """Compare like the api-validator: objects as dicts, keys case/separator-insensitive."""',
    "    if isinstance(v, enum.Enum):",
    "        return _norm(v.value)",
    "    if isinstance(v, (bool, str)) or v is None:",
    "        return v",
    "    if isinstance(v, (int, float, decimal.Decimal)):",
    "        return round(float(v), 9)",
    "    if dataclasses.is_dataclass(v) and not isinstance(v, type):",
    "        v = dataclasses.asdict(v)",
    '    elif hasattr(v, "_asdict"):',
    "        v = v._asdict()",
    '    elif not isinstance(v, (dict, list, tuple, set, frozenset)) and hasattr(v, "__dict__"):',
    '        v = {k: x for k, x in vars(v).items() if not k.startswith("_")}',
    "    if isinstance(v, dict):",
    '        return {re.sub(r"[^a-z0-9]", "", str(k).lower()): _norm(x) for k, x in v.items() if x is not None}',
    "    return [_norm(x) for x in v]"
  ];
  for (const g of groups) {
    out.push("", "", `class Test${pascal(g.fnId.replace(".", " "))}(unittest.TestCase):`, `    """${g.fnId} -> ${g.symbol.name}"""`);
    for (const c of g.cases) {
      const call = `${imp.ref(c.symbol)}(${c.args.map(pyLiteral).join(", ")})`;
      const lines = body(c, call, imp.ref);
      out.push("");
      if (c.note) out.push(`    # ${c.note.replace(/\s+/g, " ")}`);
      if (c.skip) out.push(`    @unittest.skip(${JSON.stringify(c.skip)})`);
      out.push(`    def test_${snake(c.slug.join(" "))}(self):`, `        # ${c.id}`);
      if (c.repeat > 1) out.push(`        for _ in range(${c.repeat}):`, ...lines.map((l) => `            ${l}`));
      else out.push(...lines.map((l) => `        ${l}`));
    }
  }
  out.push("", "", 'if __name__ == "__main__":', "    unittest.main()");
  return { content: out.join("\n") + "\n", unexpressible };
}

export const pythonTestgen: TestGenerator = {
  framework: "unittest",
  path: () => "tests/test_api_contract.py",
  command: () => "python -m unittest tests/test_api_contract.py",
  // ruff is the formatter and import sorter of the Python lib (and the de facto standard).
  format: () => [
    ["ruff", "check", "--fix", "--select", "I", "--quiet", "{file}"],
    ["ruff", "format", "--quiet", "{file}"]
  ],
  render
};
