import path from "node:path";
import { fileURLToPath } from "node:url";

/** Root of the api-validator package (works from a checkout or when used as a GitHub Action). */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Data dirs default to the package, but can be overridden (e.g. a lib vendoring the contract). */
export const CONTRACT_DIR = process.env.API_VALIDATOR_CONTRACT_DIR ?? path.join(PACKAGE_ROOT, "contract");
export const LIBS_DIR = process.env.API_VALIDATOR_LIBS_DIR ?? path.join(PACKAGE_ROOT, "libs");
export const SCHEMA_DIR = path.join(PACKAGE_ROOT, "schema");
export const BASELINES_DIR = path.join(PACKAGE_ROOT, "baselines");
export const SNAPSHOTS_DIR = path.join(PACKAGE_ROOT, "snapshots");
export const REPOS_DIR = process.env.API_VALIDATOR_REPOS_DIR ?? path.join(PACKAGE_ROOT, ".repos");
export const CACHE_DIR = process.env.API_VALIDATOR_CACHE_DIR ?? path.join(PACKAGE_ROOT, ".cache");
export const OUTPUT_DIR = process.env.API_VALIDATOR_OUTPUT_DIR ?? path.join(process.cwd(), "output");
export const LANGUAGES_DIR = path.join(PACKAGE_ROOT, "src", "languages");
