import type { ExtractedAPI } from "../types.js";
import { addFunction, parseParamList, readFile, repoFilesByExt, resolveEntryRoot } from "./shared.js";

export function extractRubyApi(repoRoot: string, entry: string): ExtractedAPI {
  const functions: ExtractedAPI["functions"] = [];
  const searchRoot = resolveEntryRoot(repoRoot, entry);

  for (const file of repoFilesByExt(searchRoot, [".rb"])) {
    const content = readFile(file);

    const moduleFnRegex = /^\s*def\s+self\.([A-Za-z_][\w!?=]*)\s*\(?([^)]*)\)?/gm;
    for (const match of content.matchAll(moduleFnRegex)) {
      addFunction(functions, {
        fullPath: match[1],
        functionName: match[1],
        parameters: parseParamList(match[2]),
        visibility: "public"
      });
    }

    const classRegex = /^\s*class\s+([A-Za-z_][\w:]*)[\s\S]*?^\s*end\s*$/gm;
    for (const cls of content.matchAll(classRegex)) {
      const className = cls[1].split("::").at(-1) ?? cls[1];
      const body = cls[0];
      const staticRegex = /^\s*def\s+self\.([A-Za-z_][\w!?=]*)\s*\(?([^)]*)\)?/gm;
      for (const method of body.matchAll(staticRegex)) {
        addFunction(functions, {
          fullPath: `${className}.${method[1]}`,
          functionName: method[1],
          parameters: parseParamList(method[2]),
          visibility: "public"
        });
      }
    }
  }

  return { functions };
}
