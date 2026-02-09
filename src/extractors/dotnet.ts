import type { ExtractedAPI } from "../types.js";
import { addFunction, parseParamList, readFile, repoFilesByExt, resolveEntryRoot } from "./shared.js";

function parseFSharpParams(raw: string): { name: string; type?: string }[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "()") return [];
  return trimmed
    .split(/\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/[()]/g, ""))
    .filter(Boolean)
    .map((segment) => {
      const [name, type] = segment.split(":").map((s) => s.trim());
      return { name, type: type || undefined };
    });
}

export function extractDotnetApi(repoRoot: string, entry: string): ExtractedAPI {
  const functions: ExtractedAPI["functions"] = [];
  const searchRoot = resolveEntryRoot(repoRoot, entry);

  for (const file of repoFilesByExt(searchRoot, [".cs", ".fs"])) {
    const content = readFile(file);

    const staticRegex = /public\s+static\s+([\w<>,.?\[\]]+)\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)/gm;
    for (const method of content.matchAll(staticRegex)) {
      addFunction(functions, {
        fullPath: method[2],
        functionName: method[2],
        parameters: parseParamList(method[3]),
        returnType: method[1],
        visibility: "public"
      });
    }

    // F# public module members: `let Name param = ...` (excluding `let private`).
    const moduleMatch = content.match(/^\s*module\s+([A-Za-z_][\w.]+)/m);
    const moduleName = moduleMatch ? moduleMatch[1].split(".").at(-1) : undefined;
    const fsharpRegex = /^\s*let\s+(?!private\b)([A-Za-z_][\w]*)\s*(.*?)\s*=/gm;
    for (const fn of content.matchAll(fsharpRegex)) {
      const functionName = fn[1];
      const rawParams = fn[2] ?? "";
      addFunction(functions, {
        fullPath: moduleName ? `${moduleName}.${functionName}` : functionName,
        functionName,
        parameters: parseFSharpParams(rawParams),
        visibility: "public"
      });
    }
  }

  return { functions };
}
