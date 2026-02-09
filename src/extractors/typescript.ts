import path from "node:path";
import { Node, Project } from "ts-morph";
import type { ExtractedAPI } from "../types.js";

function deprecatedAliasesFromEntry(sourceText: string): Set<string> {
  const aliases = new Set<string>();
  const regex = /@deprecated[\s\S]*?export\s*\{[^}]*?as\s+([A-Za-z_][\w]*)\s*\}/gm;
  for (const match of sourceText.matchAll(regex)) {
    aliases.add(match[1]);
  }
  return aliases;
}

export function extractTypeScriptApi(repoRoot: string, entry: string): ExtractedAPI {
  const project = new Project({
    skipAddingFilesFromTsConfig: true
  });
  project.addSourceFilesAtPaths(path.join(repoRoot, "**/*.{ts,tsx,js,mjs,cjs}"));

  const entryPath = path.join(repoRoot, entry);
  const sourceFile = project.getSourceFile(entryPath);
  if (!sourceFile) {
    throw new Error(`TypeScript entry file not found: ${entryPath}`);
  }

  const deprecatedAliases = deprecatedAliasesFromEntry(sourceFile.getFullText());
  const functions = [] as ExtractedAPI["functions"];
  const exported = sourceFile.getExportedDeclarations();

  for (const [exportName, declarations] of exported.entries()) {
    if (deprecatedAliases.has(exportName)) continue;

    for (const declaration of declarations) {
      if (Node.isFunctionDeclaration(declaration)) {
        if (declaration.getJsDocs().some((doc) => /deprecated/i.test(doc.getInnerText()))) continue;
        functions.push({
          fullPath: exportName,
          functionName: exportName,
          parameters: declaration.getParameters().map((p) => ({
            name: p.getName(),
            type: p.getTypeNode()?.getText()
          })),
          returnType: declaration.getReturnTypeNode()?.getText(),
          visibility: "public"
        });
        continue;
      }

      if (Node.isVariableDeclaration(declaration)) {
        const initializer = declaration.getInitializer();
        if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
          functions.push({
            fullPath: exportName,
            functionName: exportName,
            parameters: initializer.getParameters().map((p) => ({
              name: p.getName(),
              type: p.getTypeNode()?.getText()
            })),
            returnType: initializer.getReturnTypeNode()?.getText(),
            visibility: "public"
          });
        }
        continue;
      }

      // Static methods can still be represented via exported wrapper functions.
    }
  }

  return { functions };
}
