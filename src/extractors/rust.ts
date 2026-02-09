import type { ExtractedAPI } from "../types.js";
import { addFunction, parseParamList, readFile, repoFilesByExt, resolveEntryRoot } from "./shared.js";

export function extractRustApi(repoRoot: string, entry: string): ExtractedAPI {
  const functions: ExtractedAPI["functions"] = [];
  const searchRoot = resolveEntryRoot(repoRoot, entry);

  for (const file of repoFilesByExt(searchRoot, [".rs"])) {
    const content = readFile(file);

    const freeFnRegex = /^\s*pub\s+fn\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)\s*(?:->\s*([^\s{]+))?/gm;
    for (const match of content.matchAll(freeFnRegex)) {
      addFunction(functions, {
        fullPath: match[1],
        functionName: match[1],
        parameters: parseParamList(match[2]),
        returnType: match[3]?.trim(),
        visibility: "public"
      });
    }

    const implRegex = /impl\s+([A-Za-z_][\w]*)\s*\{([\s\S]*?)\}/gm;
    for (const impl of content.matchAll(implRegex)) {
      const typeName = impl[1];
      const body = impl[2];
      const methodRegex = /pub\s+fn\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)\s*(?:->\s*([^\s{]+))?/gm;
      for (const method of body.matchAll(methodRegex)) {
        const params = parseParamList(method[2]).filter((p) => p.name !== "self" && p.name !== "&self");
        addFunction(functions, {
          fullPath: `${typeName}.${method[1]}`,
          functionName: method[1],
          parameters: params,
          returnType: method[3]?.trim(),
          visibility: "public"
        });
      }
    }
  }

  return { functions };
}
