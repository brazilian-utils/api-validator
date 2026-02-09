import { readJsonFile } from "./utils/fs.js";
import { EXCEPTIONS_PATH, LIBS_CONFIG_PATH, SPEC_PATH } from "./utils/paths.js";
import type { CanonicalSpec, ExceptionsConfig, LibrariesConfig } from "./types.js";

export function loadLibrariesConfig(): LibrariesConfig {
  return readJsonFile<LibrariesConfig>(LIBS_CONFIG_PATH);
}

export function loadSpec(): CanonicalSpec {
  return readJsonFile<CanonicalSpec>(SPEC_PATH);
}

export function loadExceptions(): ExceptionsConfig {
  return readJsonFile<ExceptionsConfig>(EXCEPTIONS_PATH);
}
