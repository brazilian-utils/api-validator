import type { ExtractedAPI } from "../types.js";
import { extractDotnetApi } from "./dotnet.js";
import { extractErlangApi } from "./erlang.js";
import { extractGoApi } from "./go.js";
import { extractPythonApi } from "./python.js";
import { extractRubyApi } from "./ruby.js";
import { extractRustApi } from "./rust.js";
import { extractTypeScriptApi } from "./typescript.js";

export function extractByLanguage(language: string, repoRoot: string, entry: string): ExtractedAPI {
  switch (language) {
    case "typescript":
    case "javascript":
      return extractTypeScriptApi(repoRoot, entry);
    case "python":
      return extractPythonApi(repoRoot, entry);
    case "go":
      return extractGoApi(repoRoot, entry);
    case "rust":
      return extractRustApi(repoRoot, entry);
    case "ruby":
      return extractRubyApi(repoRoot, entry);
    case "erlang":
      return extractErlangApi(repoRoot, entry);
    case "dotnet":
    case "csharp":
      return extractDotnetApi(repoRoot, entry);
    default:
      throw new Error(`Unsupported language extractor: ${language}`);
  }
}
