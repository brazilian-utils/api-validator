import { writeJsonFile } from "../utils/fs.js";
import { NORMALIZED_OUTPUT_PATH } from "../utils/paths.js";
import { normalizeExtractedApi } from "./normalize-rules.js";
import type { ExceptionsConfig, NormalizedAPI } from "../types.js";
import type { ExtractedPerLibrary } from "./extract.js";

export type NormalizedPerLibrary = Record<string, NormalizedAPI>;

export function runNormalization(
  extractedByLibrary: ExtractedPerLibrary,
  exceptions: ExceptionsConfig
): NormalizedPerLibrary {
  const out: NormalizedPerLibrary = {};

  for (const [libName, extracted] of Object.entries(extractedByLibrary)) {
    out[libName] = normalizeExtractedApi(libName, extracted, exceptions);
  }

  writeJsonFile(NORMALIZED_OUTPUT_PATH, out);
  return out;
}
