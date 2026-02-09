import path from "node:path";
import type { ExtractedAPI } from "../types.js";
import { addFunction, isDeprecated, parseParamList, readFile, repoFilesByExt, resolveEntryRoot } from "./shared.js";

function modulePathForFile(searchRoot: string, file: string): string {
  const relative = path.relative(searchRoot, file).replaceAll("\\", "/");
  const withoutExt = relative.replace(/\.py$/, "");
  const withoutInit = withoutExt.replace(/\/__init__$/, "");
  const dotted = withoutInit.split("/").filter(Boolean).join(".");
  return dotted || "global";
}

function classStaticMethods(content: string): Array<{ className: string; methodName: string; params: string; returnType?: string }> {
  const out: Array<{ className: string; methodName: string; params: string; returnType?: string }> = [];
  const classRegex = /^class\s+([A-Za-z_][\w]*)[^\n]*:\s*$/gm;

  for (const clsMatch of content.matchAll(classRegex)) {
    const className = clsMatch[1];
    const classStart = clsMatch.index ?? 0;
    const classBody = content.slice(classStart);
    const methodRegex = /@staticmethod\s*\n\s{2,}def\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?:->\s*([^:\n]+))?:/gm;

    for (const method of classBody.matchAll(methodRegex)) {
      out.push({
        className,
        methodName: method[1],
        params: method[2],
        returnType: method[3]?.trim()
      });
    }
  }

  return out;
}

export function extractPythonApi(repoRoot: string, entry: string): ExtractedAPI {
  const functions: ExtractedAPI["functions"] = [];
  const searchRoot = resolveEntryRoot(repoRoot, entry);

  for (const file of repoFilesByExt(searchRoot, [".py"])) {
    const content = readFile(file);
    const modulePath = modulePathForFile(searchRoot, file);

    // Module-level public defs only.
    const regex = /^def\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?:->\s*([^:\n]+))?:/gm;
    for (const match of content.matchAll(regex)) {
      const full = match[0];
      const name = match[1];
      if (isDeprecated(full)) continue;
      addFunction(functions, {
        fullPath: `${modulePath}.${name}`,
        functionName: name,
        parameters: parseParamList(match[2]).filter((p) => p.name !== "self" && p.name !== "cls"),
        returnType: match[3]?.trim(),
        visibility: "public"
      });
    }

    for (const method of classStaticMethods(content)) {
      addFunction(functions, {
        fullPath: `${modulePath}.${method.className}.${method.methodName}`,
        functionName: method.methodName,
        parameters: parseParamList(method.params).filter((p) => p.name !== "self" && p.name !== "cls"),
        returnType: method.returnType,
        visibility: "public"
      });
    }
  }

  return { functions };
}
