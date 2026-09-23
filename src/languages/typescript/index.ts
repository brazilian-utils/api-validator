import fs from "node:fs";
import path from "node:path";
import { Node, Project, type ParameterDeclaration, type Signature, type Type } from "ts-morph";
import { T } from "../../core/ctype.js";
import type { NativeParam, NativeSymbol, TypeNode } from "../../core/model.js";
import { LANGUAGES_DIR, PACKAGE_ROOT } from "../../core/paths.js";
import { firstArg, listOf, makeTypeMapper, nullableOf } from "../shared/typemap.js";
import { runJsonProcess } from "../shared/process-runner.js";
import type { AdapterContext, Extraction, LanguageAdapter } from "../types.js";

function isDeprecatedNode(node: Node): boolean {
  const holders: Node[] = [node];
  const stmt = node.getFirstAncestor((a) => Node.isVariableStatement(a));
  if (stmt) holders.push(stmt);
  return holders.some(
    (h) => Node.isJSDocable(h) && h.getJsDocs().some((d) => d.getTags().some((t) => t.getTagName() === "deprecated"))
  );
}

/** A checker type -> the shared structured type tree. */
export function tsNode(type: Type, depth = 0): TypeNode {
  if (depth > 8) return { kind: "unknown", text: type.getText() };
  if (type.isUnion()) {
    const members = type.getUnionTypes();
    // The checker models `boolean` as `true | false`.
    const bools = members.filter((m) => m.isBooleanLiteral());
    const both = bools.length === 2;
    const nodes = members.filter((m) => !(both && m.isBooleanLiteral())).map((m) => tsNode(m, depth + 1));
    if (both) nodes.push({ kind: "name", name: "boolean" });
    return nodes.length === 1 ? nodes[0] : { kind: "union", of: nodes };
  }
  if (type.isStringLiteral() || type.isNumberLiteral()) return { kind: "lit", value: type.getLiteralValue() as string | number };
  if (type.isBooleanLiteral()) return { kind: "lit", value: type.getText() === "true" };
  if (type.isString() || type.isTemplateLiteral()) return { kind: "name", name: "string" };
  if (type.isNumber()) return { kind: "name", name: "number" };
  if (type.isBoolean()) return { kind: "name", name: "boolean" };
  if (type.isNull()) return { kind: "name", name: "null" };
  if (type.isUndefined()) return { kind: "name", name: "undefined" };
  if (type.isAny()) return { kind: "name", name: "any" };
  if (type.isUnknown()) return { kind: "name", name: "unknown" };
  const text = type.getText();
  if (text === "void" || text === "never" || text === "bigint") return { kind: "name", name: text };
  if (type.isArray()) return { kind: "list", of: tsNode(type.getArrayElementTypeOrThrow(), depth + 1) };
  if (type.isTuple()) return { kind: "tuple", of: type.getTupleElements().map((t) => tsNode(t, depth + 1)) };
  if (type.getCallSignatures().length > 0) return { kind: "function" };
  if (type.isObject() || type.isInterface() || type.isIntersection()) {
    const symbol = type.getAliasSymbol() ?? type.getSymbol();
    const name = symbol?.getName();
    if (!name || name.startsWith("__")) return { kind: "object" }; // anonymous `{ ... }`
    const args = (type.getAliasSymbol() ? type.getAliasTypeArguments() : type.getTypeArguments()).map((t) => tsNode(t, depth + 1));
    return args.length ? { kind: "name", name, args } : { kind: "name", name };
  }
  return { kind: "unknown", text };
}

function withoutUndefined(type: Type): Type[] {
  return type.isUnion() ? type.getUnionTypes().filter((t) => !t.isUndefined()) : [type];
}

function paramFrom(p: ParameterDeclaration, i: number): NativeParam {
  const nameNode = p.getNameNode();
  const name = Node.isIdentifier(nameNode) ? nameNode.getText() : `arg${i}`;
  const optional = p.hasQuestionToken() || p.hasInitializer() || p.isRestParameter();
  // `x?: T` is `T | undefined` to the checker: the optionality is recorded separately.
  const members = optional ? withoutUndefined(p.getType()) : [p.getType()];
  const nodes = members.map((t) => tsNode(t));
  let typeNode: TypeNode = nodes.length === 1 ? nodes[0] : { kind: "union", of: nodes };
  if (p.isRestParameter() && typeNode.kind === "list") typeNode = typeNode.of;
  return {
    name,
    type: p.getTypeNode()?.getText() ?? p.getType().getText(p, 1 /* NoTruncation */),
    typeNode,
    optional,
    rest: p.isRestParameter() || undefined
  };
}

function symbolsFromSignatures(name: string, decl: Node, signatures: Signature[], deprecated: boolean, root: string): NativeSymbol[] {
  const file = path.relative(root, decl.getSourceFile().getFilePath());
  return signatures.map((sig) => {
    const sigDecl = sig.getDeclaration();
    const params = Node.isFunctionLikeDeclaration(sigDecl) || Node.isCallSignatureDeclaration(sigDecl) || Node.isFunctionTypeNode(sigDecl)
      ? (sigDecl as unknown as { getParameters(): ParameterDeclaration[] }).getParameters().map(paramFrom)
      : [];
    const returnNode = (sigDecl as unknown as { getReturnTypeNode?: () => Node | undefined }).getReturnTypeNode?.();
    const doc = Node.isJSDocable(decl) ? decl.getJsDocs()[0] : decl.getFirstAncestor((a) => Node.isVariableStatement(a))?.getJsDocs()[0];
    const summary = doc?.getDescription().trim().split(/\n\s*\n/)[0].replace(/\s+/g, " ");
    return {
      name,
      params,
      returns: returnNode?.getText() ?? sig.getReturnType().getText(sigDecl, 1 /* NoTruncation */),
      returnsNode: tsNode(sig.getReturnType()),
      doc: summary || undefined,
      deprecated: deprecated || undefined,
      location: { file, line: decl.getStartLineNumber() }
    };
  });
}

async function extract(ctx: AdapterContext): Promise<Extraction> {
  const entry = path.join(ctx.root, ctx.lib.entry);
  if (!fs.existsSync(entry)) throw new Error(`TypeScript entry not found: ${entry}`);
  const tsconfig = path.join(ctx.root, "tsconfig.json");
  const project = fs.existsSync(tsconfig)
    ? new Project({ tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: true })
    : new Project({ compilerOptions: { allowJs: true, strict: true } });
  const source = project.addSourceFileAtPath(entry);
  project.resolveSourceFileDependencies();

  const symbols: NativeSymbol[] = [];
  const warnings: string[] = [];
  for (const exp of source.getExportSymbols()) {
    const name = exp.getName();
    const aliased = exp.isAlias() ? exp.getAliasedSymbol() ?? exp : exp;
    const decl = aliased.getDeclarations()[0];
    const exportDecl = exp.getDeclarations()[0] ?? decl;
    if (!decl) continue;
    if (Node.isTypeAliasDeclaration(decl) || Node.isInterfaceDeclaration(decl) || Node.isEnumDeclaration(decl)) continue;
    if (Node.isClassDeclaration(decl)) continue; // error classes etc.
    const deprecated = isDeprecatedNode(exportDecl) || isDeprecatedNode(decl);
    const type = decl.getType();
    const signatures = type.getCallSignatures();
    if (signatures.length === 0) continue;

    // `export const oldName: typeof newName = newName` -> alias of newName.
    let aliasOf: string | undefined;
    if (Node.isVariableDeclaration(decl)) {
      const init = decl.getInitializer();
      if (init && Node.isIdentifier(init)) aliasOf = init.getText();
    }
    const syms = symbolsFromSignatures(name, decl, signatures, deprecated, ctx.root);
    for (const s of syms) {
      if (aliasOf && aliasOf !== name) s.aliasOf = aliasOf;
      symbols.push(s);
    }
  }
  if (symbols.length === 0) warnings.push(`no exported functions found from ${ctx.lib.entry}`);
  return { symbols, warnings };
}

const mapTs = makeTypeMapper({
  names: {
    string: T.string,
    String: T.string,
    number: T.number,
    Number: T.number,
    bigint: T.integer,
    boolean: T.boolean,
    Boolean: T.boolean,
    Date: T.date,
    void: T.void,
    undefined: T.null,
    null: T.null,
    never: T.void,
    any: T.any,
    unknown: T.any,
    object: T.object(),
    Record: T.object(),
    Map: T.object(),
    Array: listOf,
    ReadonlyArray: listOf,
    Set: listOf,
    Promise: firstArg,
    Readonly: firstArg,
    Partial: firstArg,
    Required: firstArg,
    NonNullable: firstArg,
    Nullable: nullableOf
  }
});

export const typescript: LanguageAdapter = {
  id: "typescript",
  aliases: ["javascript", "ts", "js"],
  displayName: "TypeScript",
  candidates: (fn) => [fn.flatName],
  extract,
  mapType: (native) => mapTs(native),
  tools: [{ bin: "node", purpose: "extraction (TypeScript compiler) and shared tests", install: "https://nodejs.org" }],
  runner: {
    requires: ["node"],
    async run(ctx, calls) {
      const loader = path.join(PACKAGE_ROOT, "node_modules", "tsx", "dist", "esm", "index.mjs");
      return runJsonProcess(
        process.execPath,
        ["--import", loader, path.join(LANGUAGES_DIR, "typescript", "runner.mjs"), path.join(ctx.root, ctx.lib.entry)],
        calls.map((c) => ({ id: c.id, symbol: c.symbol.name, args: c.args })),
        { cwd: ctx.root }
      );
    }
  }
};
