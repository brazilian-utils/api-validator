import path from "node:path";

export const ROOT_DIR = process.cwd();
export const SRC_DIR = path.join(ROOT_DIR, "src");
export const LIBS_CONFIG_PATH = path.join(SRC_DIR, "libs.config.json");
export const SPEC_PATH = path.join(SRC_DIR, "spec.json");
export const EXCEPTIONS_PATH = path.join(SRC_DIR, "exceptions.json");
export const LANG_SPECS_DIR = path.join(SRC_DIR, "specs");
export const REPOS_DIR = path.join(SRC_DIR, "repos");
export const OUTPUT_DIR = path.join(ROOT_DIR, "output");
export const EXTRACT_OUTPUT_PATH = path.join(OUTPUT_DIR, "extracted.json");
export const NORMALIZED_OUTPUT_PATH = path.join(OUTPUT_DIR, "normalized.json");
export const MATRIX_JSON_PATH = path.join(OUTPUT_DIR, "matrix.json");
export const DASHBOARD_HTML_PATH = path.join(OUTPUT_DIR, "index.html");
