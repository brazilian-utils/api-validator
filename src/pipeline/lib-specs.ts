import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "../utils/fs.js";
import { LANG_SPECS_DIR } from "../utils/paths.js";
import type { NormalizedPerLibrary } from "./normalize.js";
import type { NormalizedAPI, Parameter } from "../types.js";

interface FunctionVariant {
  params: Parameter[];
  returns?: string;
  implementationPath: string;
}

interface LibrarySpecJson {
  library: string;
  domains: Record<
    string,
    {
      functions: Record<
        string,
        {
          variants: FunctionVariant[];
        }
      >;
    }
  >;
}

function sortedEntries<T>(obj: Record<string, T>): Array<[string, T]> {
  return Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
}

function toLibrarySpecJson(libName: string, api: NormalizedAPI): LibrarySpecJson {
  const grouped: LibrarySpecJson["domains"] = {};

  for (const fn of api.functions) {
    if (!grouped[fn.domain]) {
      grouped[fn.domain] = { functions: {} };
    }
    if (!grouped[fn.domain].functions[fn.name]) {
      grouped[fn.domain].functions[fn.name] = { variants: [] };
    }

    grouped[fn.domain].functions[fn.name].variants.push({
      params: fn.parameters,
      returns: fn.returnType,
      implementationPath: fn.implementationPath
    });
  }

  const sortedDomains: LibrarySpecJson["domains"] = {};
  for (const [domain, domainData] of sortedEntries(grouped)) {
    const sortedFunctions: LibrarySpecJson["domains"][string]["functions"] = {};
    for (const [fnName, fnData] of sortedEntries(domainData.functions)) {
      fnData.variants.sort((a, b) => a.implementationPath.localeCompare(b.implementationPath));
      sortedFunctions[fnName] = fnData;
    }
    sortedDomains[domain] = { functions: sortedFunctions };
  }

  return {
    library: libName,
    domains: sortedDomains
  };
}

export function writeLibrarySpecs(normalized: NormalizedPerLibrary): string[] {
  ensureDir(LANG_SPECS_DIR);
  const written: string[] = [];

  for (const [libName, api] of sortedEntries(normalized)) {
    const spec = toLibrarySpecJson(libName, api);
    const filePath = path.join(LANG_SPECS_DIR, `${libName}.spec.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
    written.push(filePath);
  }

  return written;
}

export function loadLibrarySpecs(): NormalizedPerLibrary {
  if (!fs.existsSync(LANG_SPECS_DIR)) {
    throw new Error(`Library specs dir not found: ${LANG_SPECS_DIR}`);
  }

  const files = fs
    .readdirSync(LANG_SPECS_DIR)
    .filter((name) => name.endsWith(".spec.json"))
    .sort();
  if (files.length === 0) {
    throw new Error("No language spec files found. Run `api-validator generate-lib-specs` first.");
  }

  const out: NormalizedPerLibrary = {};

  for (const file of files) {
    const fullPath = path.join(LANG_SPECS_DIR, file);
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as LibrarySpecJson;

    const functions: NormalizedAPI["functions"] = [];
    for (const [domain, domainData] of sortedEntries(parsed.domains ?? {})) {
      for (const [name, fnData] of sortedEntries(domainData.functions ?? {})) {
        for (const variant of fnData.variants ?? []) {
          functions.push({
            domain,
            name,
            parameters: variant.params ?? [],
            returnType: variant.returns,
            implementationPath: variant.implementationPath ?? `${domain}.${name}`
          });
        }
      }
    }

    const libName = parsed.library || file.replace(/\.spec\.json$/, "");
    out[libName] = { functions };
  }

  return out;
}

export function assertLibrarySpecsFresh(referenceFilePath: string): void {
  if (!fs.existsSync(referenceFilePath)) return;
  if (!fs.existsSync(LANG_SPECS_DIR)) {
    throw new Error("Library specs dir not found. Run `api-validator generate-lib-specs` first.");
  }

  const referenceMtime = fs.statSync(referenceFilePath).mtimeMs;
  const files = fs
    .readdirSync(LANG_SPECS_DIR)
    .filter((name) => name.endsWith(".spec.json"));

  if (files.length === 0) {
    throw new Error("No language spec files found. Run `api-validator generate-lib-specs` first.");
  }

  const stale = files.some((file) => fs.statSync(path.join(LANG_SPECS_DIR, file)).mtimeMs < referenceMtime);
  if (stale) {
    throw new Error("Language specs are stale compared to normalized output. Run `api-validator generate-lib-specs`.");
  }
}
