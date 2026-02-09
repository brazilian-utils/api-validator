import { normalizeNameForComparison, normalizeTypeForComparison } from "./normalize-rules.js";
import type {
  CanonicalSpec,
  ComparatorOutput,
  CompatibilityCell,
  CompatibilityResult,
  ExceptionsConfig,
  NormalizedFunction
} from "../types.js";
import type { NormalizedPerLibrary } from "./normalize.js";

function signatureMatches(expected: { params: { name: string; type?: string }[]; returns?: string }, actual: NormalizedFunction): boolean {
  if (expected.params.length !== actual.parameters.length) return false;

  for (let i = 0; i < expected.params.length; i += 1) {
    const e = expected.params[i];
    const a = actual.parameters[i];

    if (normalizeNameForComparison(e.name) !== normalizeNameForComparison(a.name)) {
      return false;
    }

    const expectedType = normalizeTypeForComparison(e.type);
    const actualType = normalizeTypeForComparison(a.type);
    if (expectedType && actualType && expectedType !== actualType) {
      return false;
    }
  }

  const expectedReturn = normalizeTypeForComparison(expected.returns);
  const actualReturn = normalizeTypeForComparison(actual.returnType);
  if (expectedReturn && actualReturn && expectedReturn !== actualReturn) {
    return false;
  }

  return true;
}

function canonicalFunctionExists(spec: CanonicalSpec, canonicalKey: string): boolean {
  const [domain, fn] = canonicalKey.split(".");
  if (!domain || !fn) return false;
  return Boolean(spec.domains[domain]?.functions?.[fn]);
}

function validateMappings(spec: CanonicalSpec, normalized: NormalizedPerLibrary, exceptions: ExceptionsConfig): number {
  let invalidCount = 0;
  for (const [libName, mapping] of Object.entries(exceptions.mappings ?? {})) {
    if (!normalized[libName]) {
      invalidCount += 1;
      continue;
    }

    for (const [canonicalKey, def] of Object.entries(mapping)) {
      if (!canonicalFunctionExists(spec, canonicalKey)) {
        invalidCount += 1;
      }

      const [canonicalDomain, canonicalName] = canonicalKey.split(".");
      if (!canonicalDomain || !canonicalName) {
        invalidCount += 1;
      }

      if (def.allowNames && !Array.isArray(def.allowNames)) {
        invalidCount += 1;
      }

      for (const allowName of def.allowNames ?? []) {
        const [domain, name] = allowName.split(".");
        if (!domain || !name) {
          invalidCount += 1;
        }
      }
    }
  }
  return invalidCount;
}

function collectCandidates(
  normalizedByLibrary: NormalizedPerLibrary,
  libName: string,
  domain: string,
  functionName: string,
  exceptions: ExceptionsConfig
): NormalizedFunction[] {
  const functions = normalizedByLibrary[libName].functions;
  const targetName = normalizeNameForComparison(functionName);
  const direct = functions.filter((fn) => fn.domain === domain.toLowerCase() && fn.name === targetName);
  if (direct.length > 0) return direct;

  const allowGlobal = Boolean(exceptions.structureDifferences?.[libName]?.allowGlobalFunctions);
  if (!allowGlobal) return direct;

  return functions.filter((fn) => fn.domain === "global" && fn.name === targetName);
}

export function compareAgainstSpec(
  spec: CanonicalSpec,
  normalizedByLibrary: NormalizedPerLibrary,
  exceptions: ExceptionsConfig
): ComparatorOutput {
  const libs = Object.keys(normalizedByLibrary).sort();
  const matrix: CompatibilityResult[] = [];

  let missingCount = 0;
  let signatureMismatchCount = 0;

  for (const [domain, domainData] of Object.entries(spec.domains)) {
    for (const [functionName, functionSpec] of Object.entries(domainData.functions)) {
      const row: CompatibilityResult = {
        domain,
        function: functionName,
        implementations: {}
      };

      for (const libName of libs) {
        const candidates = collectCandidates(normalizedByLibrary, libName, domain, functionName, exceptions);
        const hasSignatureMatch = candidates.some((candidate) => signatureMatches(functionSpec, candidate));

        const cell: CompatibilityCell = {
          exists: candidates.length > 0,
          signatureMatch: candidates.length > 0
        };

        if (candidates.length === 0) {
          missingCount += 1;
          cell.signatureMatch = false;
          cell.notes = ["Missing function"];
        } else if (!hasSignatureMatch) {
          signatureMismatchCount += 1;
          cell.signatureMatch = false;
          cell.notes = ["Signature mismatch"];
        }

        row.implementations[libName] = cell;
      }

      matrix.push(row);
    }
  }

  matrix.sort((a, b) => `${a.domain}.${a.function}`.localeCompare(`${b.domain}.${b.function}`));

  const invalidMappingCount = validateMappings(spec, normalizedByLibrary, exceptions);

  return {
    matrix,
    summary: {
      missingCount,
      signatureMismatchCount,
      invalidMappingCount,
      failed: missingCount > 0 || signatureMismatchCount > 0 || invalidMappingCount > 0
    }
  };
}
