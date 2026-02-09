import type { ExtractedAPI } from "../types.js";
import { addFunction, readFile, repoFilesByExt, resolveEntryRoot } from "./shared.js";

export function extractErlangApi(repoRoot: string, entry: string): ExtractedAPI {
  const functions: ExtractedAPI["functions"] = [];
  const searchRoot = resolveEntryRoot(repoRoot, entry);

  for (const file of repoFilesByExt(searchRoot, [".erl"])) {
    const content = readFile(file);
    const exports = new Set<string>();

    const exportRegex = /-export\s*\(\s*\[([^\]]+)\]\s*\)\s*\./gm;
    for (const entry of content.matchAll(exportRegex)) {
      for (const fn of entry[1].split(",")) {
        const name = fn.trim().split("/")[0];
        if (name) exports.add(name);
      }
    }

    const fnRegex = /^([a-z][\w]*)\s*\(([^)]*)\)\s*->/gm;
    for (const fn of content.matchAll(fnRegex)) {
      const name = fn[1];
      if (!exports.has(name)) continue;
      addFunction(functions, {
        fullPath: name,
        functionName: name,
        parameters: fn[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((namePart) => ({ name: namePart })),
        visibility: "public"
      });
    }
  }

  return { functions };
}
