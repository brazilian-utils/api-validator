import type { ExtractedAPI } from "../types.js";
import { addFunction, parseParamList, readFile, repoFilesByExt, resolveEntryRoot } from "./shared.js";

export function extractGoApi(repoRoot: string, entry: string): ExtractedAPI {
  const functions: ExtractedAPI["functions"] = [];
  const searchRoot = resolveEntryRoot(repoRoot, entry);

  for (const file of repoFilesByExt(searchRoot, [".go"])) {
    const content = readFile(file);
    const regex = /^func\s+(?:\(([^)]*)\)\s*)?([A-Za-z_][\w]*)\s*\(([^)]*)\)\s*([^\n{]*)\{/gm;

    for (const match of content.matchAll(regex)) {
      const receiver = match[1]?.trim();
      const name = match[2];
      if (!/^[A-Z]/.test(name)) continue;

      const receiverType = receiver?.split(/\s+/).pop()?.replace(/^\*+/, "");
      addFunction(functions, {
        fullPath: receiverType ? `${receiverType}.${name}` : name,
        functionName: name,
        parameters: parseParamList(match[3]),
        returnType: match[4]?.trim() || undefined,
        visibility: "public"
      });
    }
  }

  return { functions };
}
