import fs from "node:fs";
import path from "node:path";
import { Node, Project, type ParameterDeclaration, type Signature, type Type } from "ts-morph";
import { T } from "../../core/ctype.js";
import type { NativeParam, NativeSymbol } from "../../core/model.js";
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

/**
 * Aliases of primitive/literal unions (`type StateCode = "AC" | ...`) are expanded to their
 * primitive kinds so they compare as `string` instead of an opaque named object.
 */
function primitiveText(type: Type): string | undefined {
  const members = type.isUnion() ? type.getUnionTypes() : [type];
  const kinds = new Set<string>();
  for (const m of members) {
    if (m.isString() || m.isStringLiteral() || m.isTemplateLiteral()) kinds.add("string");
    else if (m.isNumber() || m.isNumberLiteral()) kinds.add("number");
    else if (m.isBoolean() || m.isBooleanLiteral()) kinds.add("boolean");
    else if (m.isUndefined() || m.isNull()) kinds.add("null");
    else return undefined;
  }
  return [...kinds].join(" | ");
}

function typeText(node: Node | undefined, type: Type, context: Node): string {
  const written = node?.getText();
  // Any named type in the text may hide a primitive union (`StateCode | null`).
  if (written && /\b[A-Z]\w*\b/.test(written)) return primitiveText(type) ?? written;
  return written ?? type.getText(context, 1 /* NoTruncation */);
}

function paramFrom(p: ParameterDeclaration, i: number): NativeParam {
  const nameNode = p.getNameNode();
  const name = Node.isIdentifier(nameNode) ? nameNode.getText() : `arg${i}`;
  return {
    name,
    type: typeText(p.getTypeNode(), p.getType().getNonNullableType(), p),
    optional: p.hasQuestionToken() || p.hasInitializer() || p.isRestParameter(),
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
      returns: typeText(returnNode, sig.getReturnType(), sigDecl),
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
