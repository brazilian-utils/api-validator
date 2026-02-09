import type { ExceptionMapping, ExceptionsConfig, ExtractedAPI, NormalizedAPI, NormalizedFunction } from "../types.js";

function toCamelCase(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9_]/g, "");
  if (!cleaned) return "";
  if (!cleaned.includes("_")) {
    return `${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }
  return cleaned
    .split("_")
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) return lower;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join("");
}

function normalizeDomain(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function splitFullPath(fullPath: string): string[] {
  return fullPath.split(/[.:]/).map((x) => x.trim()).filter(Boolean);
}

function inferDomainAndName(
  fullPath: string,
  functionName: string
): { domain: string; name: string } {
  const parts = splitFullPath(fullPath);

  if (parts.length >= 2) {
    const parent = parts[parts.length - 2];
    const domainSource =
      parts.length >= 3 && /^[A-Z]/.test(parent)
        ? parts[parts.length - 3]
        : parent;
    const domain = normalizeDomain(domainSource);
    const name = toCamelCase(parts[parts.length - 1]);
    return { domain, name };
  }

  const rawName = functionName.replace(/[^a-zA-Z0-9_]/g, "");

  const prefixed = rawName.match(/^(isValid|format|generate|get|parse)([A-Z][A-Za-z0-9]*)$/);
  if (prefixed) {
    const inferredName = prefixed[1];
    const inferredDomain = normalizeDomain(prefixed[2]);
    return {
      domain: inferredDomain,
      name: toCamelCase(inferredName)
    };
  }

  const snakeVerbWithDomain = rawName.match(/^(is_valid|format|generate|get|parse)_([a-zA-Z0-9_]+)$/);
  if (snakeVerbWithDomain) {
    return {
      domain: normalizeDomain(snakeVerbWithDomain[2]),
      name: toCamelCase(snakeVerbWithDomain[1])
    };
  }

  const snakeDomainWithVerb = rawName.match(/^([a-zA-Z0-9]+)_(is_valid|format|generate|get|parse)$/);
  if (snakeDomainWithVerb) {
    return {
      domain: normalizeDomain(snakeDomainWithVerb[1]),
      name: toCamelCase(snakeDomainWithVerb[2])
    };
  }

  const suffixMatch = rawName.match(/^([a-zA-Z]+)(Cpf|Cnpj|Cep|Pis|Ie|Renavam|Boleto|Phone|Email|Currency|LicensePlate)$/);
  if (suffixMatch) {
    return {
      domain: normalizeDomain(suffixMatch[2]),
      name: toCamelCase(suffixMatch[1])
    };
  }

  return { domain: "global", name: toCamelCase(rawName) };
}

function parseCanonicalKey(key: string): { domain: string; name: string } {
  const [domain, name] = key.split(".");
  return {
    domain: normalizeDomain(domain),
    name: toCamelCase(name)
  };
}

function getAliasMappingForLib(
  libName: string,
  exceptions: ExceptionsConfig
): Record<string, ExceptionMapping> {
  return exceptions.mappings?.[libName] ?? {};
}

function remapAlias(
  libName: string,
  normalized: NormalizedFunction,
  exceptions: ExceptionsConfig
): NormalizedFunction {
  const mapping = getAliasMappingForLib(libName, exceptions);
  const currentKey = `${normalized.domain}.${normalized.name}`;

  for (const [canonicalKey, def] of Object.entries(mapping)) {
    if (!def.allowNames || def.allowNames.length === 0) continue;
    const matches = def.allowNames.some((allowName) => {
      const parsed = parseCanonicalKey(allowName);
      return currentKey === `${parsed.domain}.${parsed.name}`;
    });

    if (matches) {
      const canonical = parseCanonicalKey(canonicalKey);
      return {
        ...normalized,
        domain: canonical.domain,
        name: canonical.name
      };
    }
  }

  return normalized;
}

export function normalizeExtractedApi(
  libName: string,
  extracted: ExtractedAPI,
  exceptions: ExceptionsConfig
): NormalizedAPI {
  const normalizedFunctions = extracted.functions.map((fn) => {
    const inferred = inferDomainAndName(fn.fullPath, fn.functionName);
    const normalized: NormalizedFunction = {
      domain: inferred.domain,
      name: inferred.name,
      parameters: fn.parameters,
      returnType: fn.returnType,
      implementationPath: fn.fullPath
    };
    return remapAlias(libName, normalized, exceptions);
  });

  normalizedFunctions.sort((a, b) => `${a.domain}.${a.name}`.localeCompare(`${b.domain}.${b.name}`));

  return {
    functions: normalizedFunctions
  };
}

export function normalizeNameForComparison(input: string): string {
  return toCamelCase(input);
}

export function normalizeTypeForComparison(input?: string): string | undefined {
  if (!input) return undefined;
  const cleaned = input.trim().toLowerCase();
  const aliases: Record<string, string> = {
    bool: "boolean",
    boolean: "boolean",
    str: "string",
    string: "string",
    int: "number",
    integer: "number",
    float: "number",
    number: "number"
  };
  return aliases[cleaned] ?? cleaned;
}
