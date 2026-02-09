import { writeJsonFile } from "../utils/fs.js";
import { SPEC_PATH } from "../utils/paths.js";
import type { CanonicalSpec } from "../types.js";
import type { NormalizedPerLibrary } from "./normalize.js";

function sortedEntries<T>(obj: Record<string, T>): Array<[string, T]> {
  return Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
}

export function bootstrapSpecFromLibrary(normalized: NormalizedPerLibrary, sourceLib: string): CanonicalSpec {
  const source = normalized[sourceLib];
  if (!source) {
    throw new Error(`Cannot bootstrap spec. Library not found in normalized output: ${sourceLib}`);
  }

  const domains: CanonicalSpec["domains"] = {};
  const seen = new Set<string>();

  for (const fn of source.functions) {
    const key = `${fn.domain}.${fn.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!domains[fn.domain]) {
      domains[fn.domain] = { functions: {} };
    }

    domains[fn.domain].functions[fn.name] = {
      params: fn.parameters.map((p) => ({ name: p.name, type: p.type })),
      returns: fn.returnType
    };
  }

  const sortedDomains: CanonicalSpec["domains"] = {};
  for (const [domainName, domainData] of sortedEntries(domains)) {
    const sortedFunctions: Record<string, { params: { name: string; type?: string }[]; returns?: string }> = {};
    for (const [fnName, fnData] of sortedEntries(domainData.functions)) {
      sortedFunctions[fnName] = fnData;
    }
    sortedDomains[domainName] = { functions: sortedFunctions };
  }

  return { domains: sortedDomains };
}

export function writeSpec(spec: CanonicalSpec): void {
  writeJsonFile(SPEC_PATH, spec);
}
