export type Visibility = "public" | "private";

export interface Parameter {
  name: string;
  type?: string;
}

export interface ExtractedFunction {
  fullPath: string;
  functionName: string;
  parameters: Parameter[];
  returnType?: string;
  visibility: Visibility;
}

export interface ExtractedAPI {
  functions: ExtractedFunction[];
}

export interface NormalizedFunction {
  domain: string;
  name: string;
  parameters: Parameter[];
  returnType?: string;
  implementationPath: string;
}

export interface NormalizedAPI {
  functions: NormalizedFunction[];
}

export interface CompatibilityCell {
  exists: boolean;
  signatureMatch: boolean;
  notes?: string[];
}

export interface CompatibilityResult {
  domain: string;
  function: string;
  implementations: Record<string, CompatibilityCell>;
}

export interface LibraryConfig {
  name: string;
  repo: string;
  language: string;
  entry: string;
  branch?: string;
}

export interface LibrariesConfig {
  libs: LibraryConfig[];
}

export interface CanonicalFunctionSpec {
  params: Parameter[];
  returns?: string;
}

export interface CanonicalSpec {
  domains: Record<string, { functions: Record<string, CanonicalFunctionSpec> }>;
}

export interface ExceptionMapping {
  allowNames?: string[];
}

export interface ExceptionsConfig {
  mappings?: Record<string, Record<string, ExceptionMapping>>;
  structureDifferences?: Record<string, { allowGlobalFunctions?: boolean }>;
}

export interface ComparatorSummary {
  missingCount: number;
  signatureMismatchCount: number;
  invalidMappingCount: number;
  failed: boolean;
}

export interface ComparatorOutput {
  matrix: CompatibilityResult[];
  summary: ComparatorSummary;
}
