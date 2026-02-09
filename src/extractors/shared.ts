import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "../utils/fs.js";
import type { ExtractedFunction, Parameter } from "../types.js";

function isTestFile(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  if (normalized.includes("/test/") || normalized.includes("/tests/")) return true;

  const base = path.basename(normalized);
  return (
    base.endsWith(".test.ts") ||
    base.endsWith(".test.tsx") ||
    base.endsWith(".test.js") ||
    base.endsWith("_test.go") ||
    base.startsWith("test_") ||
    base.endsWith("_test.py")
  );
}

export function repoFilesByExt(repoRoot: string, exts: string[]): string[] {
  return walkFiles(repoRoot).filter((file) => exts.includes(path.extname(file)) && !isTestFile(file));
}

export function resolveEntryRoot(repoRoot: string, entry: string): string {
  if (!entry || entry === ".") return repoRoot;
  const candidate = path.join(repoRoot, entry);
  if (!fs.existsSync(candidate)) return repoRoot;
  const stat = fs.statSync(candidate);
  if (stat.isDirectory()) return candidate;
  return path.dirname(candidate);
}

export function parseParamList(raw: string): Parameter[] {
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const withoutDefault = segment.split("=").map((s) => s.trim())[0];
      if (withoutDefault.includes(":")) {
        const [name, type] = withoutDefault.split(":").map((s) => s.trim());
        return { name: name.replace(/^\*+/, ""), type: type || undefined };
      }

      const parts = withoutDefault.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return {
          name: parts[0].replace(/^\*+/, ""),
          type: parts.slice(1).join(" ")
        };
      }

      return { name: withoutDefault.replace(/^\*+/, "") };
    });
}

export function isDeprecated(raw: string): boolean {
  return /@deprecated|deprecated/i.test(raw);
}

export function isProbablyPublic(name: string): boolean {
  return !name.startsWith("_");
}

export function addFunction(functions: ExtractedFunction[], next: ExtractedFunction): void {
  if (!isProbablyPublic(next.functionName)) return;
  functions.push(next);
}

export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}
