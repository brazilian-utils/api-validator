import { writeJsonFile } from "../utils/fs.js";
import { MATRIX_JSON_PATH } from "../utils/paths.js";
import { compareAgainstSpec } from "./compare-rules.js";
import type { CanonicalSpec, ComparatorOutput, ExceptionsConfig } from "../types.js";
import type { NormalizedPerLibrary } from "./normalize.js";

export function runComparison(
  spec: CanonicalSpec,
  normalizedByLibrary: NormalizedPerLibrary,
  exceptions: ExceptionsConfig
): ComparatorOutput {
  const output = compareAgainstSpec(spec, normalizedByLibrary, exceptions);
  writeJsonFile(MATRIX_JSON_PATH, output);
  return output;
}
