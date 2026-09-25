/**
 * Mines shared test cases from a JavaScript library's own test suite: every assertion of the
 * form `expect(fn(<literals>)).toBe(<literal>)` on a function bound to the contract becomes a
 * case (`args`, `returns`; `throws` for `.toThrow()`), with the test's name as the note. Only
 * what can be written in the contract is taken: literal inputs and outputs (strings, numbers,
 * booleans, null, arrays and objects of those), read by ts-morph, never evaluated; a loop over a
 * literal array (`for (const cpf of REPEATED_DIGITS)`) is unrolled; a value from a generator, a
 * property test or a computed expression is left alone. Inputs the contract's parameter types
 * do not admit (a boolean where a string is due) are left alone too: they test the library's
 * own robustness, not the contract.
 */
import fs from "node:fs";
import path from "node:path";
import { Node, Project, SyntaxKind, type CallExpression, type Expression, type SourceFile } from "ts-morph";
import { parseCType, type CType } from "./ctype.js";
import type { Contract, ContractFunction, LibReport } from "./model.js";

export interface MinedCase {
  args: unknown[];
  returns?: unknown;
  throws?: true;
  note: string;
}

export interface MinedFunction {
  fn: ContractFunction;
  symbol: string;
  cases: MinedCase[];
  /** Assertions on the symbol that were not taken, and why. */
  skipped: Record<string, number>;
}

const MATCHERS = new Set(["toBe", "toEqual", "toStrictEqual", "toBeNull", "toThrow"]);

type Literals = Map<string, unknown>;
const NOT_LITERAL = Symbol("not a literal");

/** The JSON value of a literal expression, or NOT_LITERAL. `consts` are module-level constants. */
function literal(node: Expression, consts: Literals): unknown {
  if (Node.isStringLiteral(node)) return node.getLiteralValue();
  if (Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralValue();
  if (Node.isNumericLiteral(node)) return node.getLiteralValue();
  if (node.getKind() === SyntaxKind.TrueKeyword) return true;
  if (node.getKind() === SyntaxKind.FalseKeyword) return false;
  if (node.getKind() === SyntaxKind.NullKeyword) return null;
  if (Node.isPrefixUnaryExpression(node) && node.getOperatorToken() === SyntaxKind.MinusToken) {
    const v = literal(node.getOperand(), consts);
    return typeof v === "number" ? -v : NOT_LITERAL;
  }
  if (Node.isParenthesizedExpression(node) || Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isNonNullExpression(node)) {
    return literal(node.getExpression(), consts);
  }
  if (Node.isArrayLiteralExpression(node)) {
    const out: unknown[] = [];
    for (const e of node.getElements()) {
      if (Node.isSpreadElement(e)) return NOT_LITERAL;
      const v = literal(e, consts);
      if (v === NOT_LITERAL) return NOT_LITERAL;
      out.push(v);
    }
    return out;
  }
  if (Node.isObjectLiteralExpression(node)) {
    const out: Record<string, unknown> = {};
    for (const p of node.getProperties()) {
      if (!Node.isPropertyAssignment(p)) return NOT_LITERAL;
      const name = p.getNameNode();
      const key = Node.isStringLiteral(name) ? name.getLiteralValue() : Node.isIdentifier(name) ? name.getText() : undefined;
      if (key === undefined) return NOT_LITERAL;
      const init = p.getInitializer();
      const v = init ? literal(init, consts) : NOT_LITERAL;
      if (v === NOT_LITERAL) return NOT_LITERAL;
      out[key] = v;
    }
    return out;
  }
  if (Node.isIdentifier(node)) return consts.has(node.getText()) ? consts.get(node.getText()) : NOT_LITERAL;
  return NOT_LITERAL;
}

/** Module-level `const NAME = <literal>` of a file (and the same in its top-level imports from the tests' own folder). */
function moduleConsts(file: SourceFile): Literals {
  const consts: Literals = new Map();
  for (const decl of file.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init || !Node.isIdentifier(decl.getNameNode())) continue;
    const v = literal(init, consts);
    if (v !== NOT_LITERAL) consts.set(decl.getName(), v);
  }
  return consts;
}

/** Whether a JSON value fits a contract parameter type. Unknown and any admit everything. */
function fits(value: unknown, type: CType): boolean {
  switch (type.k) {
    case "unknown":
    case "any":
      return true;
    case "union":
      return type.of.some((t) => fits(value, t));
    case "null":
      return value === null;
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "literal":
      return value === type.value;
    case "list":
      return Array.isArray(value) && value.every((v) => fits(v, type.of));
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "date":
    case "void":
      return false;
  }
}

/**
 * Whether the test around an assertion forces what the library would otherwise draw or read: a
 * replaced `Math.random`, a helper that forces it, a spy, a mocked return, a fake clock. What
 * the assertion then expects is that forced value's outcome, not the function's own.
 */
const FORCED = /Math\.random\s*=|Random\s*\(|spyOn|mockReturnValue|mockImplementation|useFakeTimers|setSystemTime|Date\.now\s*=/;
function forced(node: Node): boolean {
  for (let n: Node | undefined = node; n; n = n.getParent()) {
    if (!Node.isCallExpression(n)) continue;
    if (/^(test|it)(\.\w+)?$/.test(n.getExpression().getText())) return FORCED.test(n.getText());
  }
  return false;
}

/** The describe/test names around an assertion, innermost last, without the function's own name. */
function testName(node: Node, symbol: string): string {
  const names: string[] = [];
  for (let n: Node | undefined = node; n; n = n.getParent()) {
    if (!Node.isCallExpression(n)) continue;
    const callee = n.getExpression().getText();
    if (!/^(describe|test|it)(\.\w+)?$/.test(callee)) continue;
    const first = n.getArguments()[0];
    if (first && (Node.isStringLiteral(first) || Node.isNoSubstitutionTemplateLiteral(first))) names.unshift(first.getLiteralValue());
  }
  return names
    .filter((s) => s !== symbol)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The `for (const x of LITERAL_ARRAY)` loops around a node: variable name and its values, outermost first. */
function loopsAround(node: Node, consts: Literals): Array<{ name: string; values: unknown[] }> {
  const loops: Array<{ name: string; values: unknown[] }> = [];
  for (let n: Node | undefined = node; n; n = n.getParent()) {
    if (!Node.isForOfStatement(n)) continue;
    const init = n.getInitializer();
    const decl = Node.isVariableDeclarationList(init) ? init.getDeclarations()[0] : undefined;
    const values = literal(n.getExpression(), consts);
    if (!decl || !Array.isArray(values)) return [{ name: "", values: [] }]; // a loop over something else: not unrollable
    loops.unshift({ name: decl.getName(), values });
  }
  return loops;
}

/** The literal args of a call, with loop variables substituted; null when any arg is not a literal. */
function callArgs(call: CallExpression, consts: Literals): unknown[] | null {
  const args: unknown[] = [];
  for (const a of call.getArguments()) {
    if (Node.isSpreadElement(a)) return null;
    if (Node.isIdentifier(a) && a.getText() === "undefined") return null;
    const v = literal(a as Expression, consts);
    if (v === NOT_LITERAL) return null;
    args.push(v);
  }
  return args;
}

const canonical = (v: unknown) => JSON.stringify(v);

/**
 * Mines every `*.test.ts` under `src/` of the checkout for the functions the report bound to a
 * symbol. `existing` args (per function) are skipped, and so are duplicates within the mined set.
 */
export function mineJsTests(checkout: string, report: LibReport, contract: Contract): MinedFunction[] {
  const bySymbol = new Map<string, ContractFunction>();
  for (const f of report.functions) {
    const fn = contract.functions.get(f.id);
    if (f.symbol && fn) bySymbol.set(f.symbol, fn);
  }
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
  const srcDir = path.join(checkout, "src");
  const files = fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .flatMap((d) => fs.readdirSync(path.join(srcDir, d.name)).filter((f) => f.endsWith(".test.ts")).map((f) => path.join(srcDir, d.name, f)));
  const mined = new Map<string, MinedFunction>();
  const seen = new Map<string, Set<string>>();
  const get = (fn: ContractFunction, symbol: string) => {
    let m = mined.get(fn.id);
    if (!m) {
      m = { fn, symbol, cases: [], skipped: {} };
      mined.set(fn.id, m);
      seen.set(fn.id, new Set(fn.tests.map((t) => canonical(t.args))));
    }
    return m;
  };
  const skip = (m: MinedFunction, why: string) => {
    m.skipped[why] = (m.skipped[why] ?? 0) + 1;
  };

  for (const file of files) {
    const source = project.addSourceFileAtPath(file);
    const consts = moduleConsts(source);
    for (const expectCall of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (expectCall.getExpression().getText() !== "expect") continue;
      const subject = expectCall.getArguments()[0];
      if (!subject || !Node.isCallExpression(subject) || !Node.isIdentifier(subject.getExpression())) continue;
      const symbol = subject.getExpression().getText();
      const fn = bySymbol.get(symbol);
      if (!fn) continue;
      const m = get(fn, symbol);
      // expect(call).matcher(expected), or expect(call).not.matcher(…) which says nothing exact.
      const access = expectCall.getParent();
      if (!Node.isPropertyAccessExpression(access)) continue;
      const matcher = access.getName();
      const matcherCall = access.getParent();
      if (!MATCHERS.has(matcher) || !Node.isCallExpression(matcherCall)) {
        skip(m, matcher === "not" ? "negated matcher" : `matcher ${matcher}`);
        continue;
      }
      if (expectCall.getLeadingCommentRanges().some((r) => r.getText().includes("@ts-expect-error")) || subject.getLeadingCommentRanges().some((r) => r.getText().includes("@ts-expect-error"))) {
        skip(m, "input of the wrong type on purpose");
        continue;
      }
      if (forced(expectCall)) {
        skip(m, "forced randomness or time");
        continue;
      }
      const loops = loopsAround(expectCall, consts);
      if (loops.some((l) => !l.name)) {
        skip(m, "loop over a computed list");
        continue;
      }
      let expectation: Pick<MinedCase, "returns" | "throws">;
      if (matcher === "toThrow") {
        if (fn.fallible === false) {
          skip(m, "throws, but the contract says the function does not");
          continue;
        }
        expectation = { throws: true };
      } else if (matcher === "toBeNull") {
        expectation = { returns: null };
      } else {
        const expected = matcherCall.getArguments()[0];
        const v = expected ? literal(expected as Expression, consts) : NOT_LITERAL;
        if (v === NOT_LITERAL || v === undefined) {
          skip(m, "computed expected value");
          continue;
        }
        expectation = { returns: v };
      }
      const note = testName(expectCall, symbol);
      // Every combination of the loops' values, substituted into the call's arguments.
      const combos: Literals[] = [new Map()];
      for (const loop of loops) {
        const next: Literals[] = [];
        for (const combo of combos) for (const value of loop.values) next.push(new Map([...combo, [loop.name, value]]));
        combos.splice(0, combos.length, ...next);
      }
      for (const combo of combos) {
        const args = callArgs(subject, new Map([...consts, ...combo]));
        if (!args) {
          skip(m, "computed input");
          continue;
        }
        const types = fn.params.map((p) => parseCType(p.type));
        const required = fn.params.filter((p) => !p.optional).length;
        if (args.length < required || args.length > fn.params.length) {
          skip(m, "wrong number of arguments for the contract");
          continue;
        }
        if (!args.every((a, i) => fits(a, types[i]))) {
          skip(m, "input the contract's types do not admit");
          continue;
        }
        const key = canonical(args);
        const known = seen.get(fn.id)!;
        if (known.has(key)) {
          skip(m, "already a case");
          continue;
        }
        known.add(key);
        m.cases.push({ args, ...expectation, note: note ? `JavaScript's own test: ${note}` : "JavaScript's own test" });
      }
    }
  }
  return [...mined.values()].filter((m) => m.cases.length || Object.keys(m.skipped).length).sort((a, b) => a.fn.id.localeCompare(b.fn.id));
}
