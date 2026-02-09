import path from "node:path";
import { writeJsonFile } from "../utils/fs.js";
import { EXTRACT_OUTPUT_PATH, REPOS_DIR } from "../utils/paths.js";
import { extractByLanguage } from "../extractors/index.js";
import type { ExtractedAPI, LibraryConfig } from "../types.js";

export type ExtractedPerLibrary = Record<string, ExtractedAPI>;

export function runExtraction(libs: LibraryConfig[]): ExtractedPerLibrary {
  const output: ExtractedPerLibrary = {};

  for (const lib of libs) {
    const repoPath = path.join(REPOS_DIR, lib.name);
    output[lib.name] = extractByLanguage(lib.language, repoPath, lib.entry);
  }

  writeJsonFile(EXTRACT_OUTPUT_PATH, output);
  return output;
}
