/**
 * Core data model shared by every stage of the validator.
 *
 * Flow: contract (what every lib should expose) + lib config (where/how a lib lives)
 *   -> language adapter extracts the lib's ApiSurface (what the lib actually exposes)
 *   -> matcher binds contract functions to native symbols
 *   -> signature checker + conformance runner produce a LibReport (what is missing / wrong).
 */

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export type Level = "core" | "extended";

export interface ContractParam {
  name: string;
  /** Canonical type expression, see src/core/ctype.ts. */
  type: string;
  optional?: boolean;
  description?: string;
}

/** Expectation for a single conformance test case. Exactly one kind is set. */
export type Expectation =
  | { kind: "returns"; value: unknown }
  | { kind: "throws" }
  | { kind: "matches"; pattern: string }
  | { kind: "satisfies"; fn: string };

export interface ContractTest {
  /** Stable id, `<fnId>#<index>` unless `name` is given. */
  id: string;
  name?: string;
  args: unknown[];
  expect: Expectation;
  /** Run the call N times (useful for generators). */
  repeat: number;
  note?: string;
}

export interface ContractFunction {
  /** Canonical id: `<domain>.<operation>`, e.g. `cpf.isValid`. */
  id: string;
  domain: string;
  operation: string;
  /** Flat (facade) name in camelCase, e.g. `isValidCpf`. */
  flatName: string;
  /**
   * Alternative (domain, operation, flatName) spellings the naming conventions also try,
   * from domain-level aliases (`processoJuridico` for `legalProcess`) and function-level
   * aliases (`cep.getAddressFromCep` for `cep.getAddressInfo`). Primary spelling first.
   */
  spellings: Array<{ domain: string; operation: string; flatName: string }>;
  summary?: string;
  /** Language-agnostic spec (markdown). */
  description?: string;
  references?: string[];
  level: Level;
  params: ContractParam[];
  returns: string;
  /** Whether the function may fail (exception / error value) on invalid input. */
  fallible?: boolean;
  /** Talks to a remote service: excluded from conformance/differential runs unless asked. */
  network?: boolean;
  deprecated?: boolean;
  tests: ContractTest[];
  /** Contract file this function was declared in (for error messages). */
  source: string;
}

export interface Contract {
  functions: Map<string, ContractFunction>;
  domains: Map<string, { title?: string; description?: string; aliases: string[]; source: string }>;
}

// ---------------------------------------------------------------------------
// Library configuration
// ---------------------------------------------------------------------------

export interface LibConfig {
  name: string;
  language: string;
  repo?: string;
  branch?: string;
  /** Entry point / package root, relative to the repo root. Meaning is language-specific. */
  entry: string;
  /** Explicit contract id -> native symbol(s). Overrides naming conventions. */
  bindings: Record<string, string | string[]>;
  /** Native symbols that are intentionally outside the contract (glob-like `*` allowed). */
  ignore: string[];
  /** Contract ids the lib deliberately does not implement, with the reason. */
  waivers: Record<string, string>;
  /** Contract test ids known to fail, with the reason (reported, but never fail CI). */
  knownFailures: Record<string, string>;
  /** Free-form adapter options. */
  options: Record<string, unknown>;
  source: string;
}

// ---------------------------------------------------------------------------
// Extracted API surface
// ---------------------------------------------------------------------------

/**
 * A native type as the language's own tooling reports it, structured (no text parsing):
 * rustdoc JSON, go/types, the TypeScript checker, griffe expressions, YARD's type parser,
 * Erlang abstract type forms, .NET reflection. Adapters map these to canonical types.
 */
export type TypeNode =
  /** A named type, possibly generic: `String`, `Option<T>`, `time.Time`, `binary()`. */
  | {
      kind: "name";
      name: string;
      args?: TypeNode[];
      /** Package/module that defines it, when the tool reports one (Go import path, ...). */
      pkg?: string;
      /** Erlang: a type call (`binary()`) rather than a bare atom (`ok`). */
      call?: boolean;
    }
  | { kind: "list"; of: TypeNode }
  | { kind: "ref"; of: TypeNode; op: "*" | "&" | "&mut" }
  | { kind: "union"; of: TypeNode[] }
  | { kind: "tuple"; of: TypeNode[] }
  | { kind: "lit"; value: string | number | boolean }
  /** Anonymous structural object type. */
  | { kind: "object" }
  | { kind: "function" }
  /** A type parameter (`T`) or anything the tool reports that has no canonical meaning. */
  | { kind: "unknown"; text?: string };

export interface NativeParam {
  name: string;
  /** Type as the language writes it, for display (may be absent for untyped languages). */
  type?: string;
  /** The same type, structured. */
  typeNode?: TypeNode;
  optional?: boolean;
  /** Variadic / rest / keyword-rest parameter. */
  rest?: boolean;
  /** Keyword-only / named parameter. */
  keyword?: boolean;
}

export interface NativeSymbol {
  /**
   * Qualified name relative to the lib root, `.`-separated, as a user would reach it.
   * e.g. python `cpf.is_valid` / `is_valid_cpf`, go `cpf.IsValid`, ruby `CPFUtils.valid?`.
   */
  name: string;
  params: NativeParam[];
  /** Return type for display. */
  returns?: string;
  /** Return type, structured. Absent means the function returns nothing (or it is unknown). */
  returnsNode?: TypeNode;
  deprecated?: boolean;
  /** First paragraph of the doc comment, when the adapter extracts it. */
  doc?: string;
  /** If this symbol is a re-export/alias, the symbol it points to. */
  aliasOf?: string;
  location?: { file: string; line: number };
  /** Adapter-specific data needed later (e.g. by the runner). */
  meta?: Record<string, unknown>;
}

export interface ApiSurface {
  library: string;
  language: string;
  /** Git revision the surface was extracted from, when known. */
  revision?: string;
  symbols: NativeSymbol[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Conformance runner protocol (language agnostic)
// ---------------------------------------------------------------------------

export interface RunnerCall {
  id: string;
  symbol: NativeSymbol;
  args: unknown[];
}

export type RunnerResult =
  | { id: string; ok: true; value: unknown }
  | {
      id: string;
      ok: false;
      error: string;
      /** The call could not be expressed or run (skipped, not failed). */
      unsupported?: boolean;
      /**
       * The language's idiomatic "no result" encoded as an error value (Erlang `{error, _}`):
       * satisfies both `returns: null` and `throws`.
       */
      absent?: boolean;
    };

// ---------------------------------------------------------------------------
// Analysis results
// ---------------------------------------------------------------------------

export type Severity = "error" | "warning" | "info";

export interface Issue {
  severity: Severity;
  code: string;
  message: string;
}

export type FunctionStatus =
  | "ok" // present, signature compatible, tests (if run) passing
  | "signature" // present, signature incompatible
  | "failing" // present, conformance tests failing
  | "missing" // not found
  | "waived"; // declared not-implemented

export interface TestOutcome {
  id: string;
  status: "pass" | "fail" | "skip" | "known-failure";
  message?: string;
  expected?: unknown;
  actual?: unknown;
}

export interface FunctionReport {
  id: string;
  level: Level;
  status: FunctionStatus;
  symbol?: string;
  /** How the symbol was found. */
  matchedBy?: "binding" | "convention";
  location?: { file: string; line: number };
  issues: Issue[];
  tests: TestOutcome[];
  /** Candidate symbols for a missing function (fuzzy search). */
  suggestions: Array<{ symbol: string; score: number }>;
  waiver?: string;
}

export interface UnmappedSymbol {
  symbol: string;
  location?: { file: string; line: number };
  /** Best contract functions this symbol might implement. */
  suggestions: Array<{ id: string; score: number }>;
}

export interface LibReport {
  library: string;
  language: string;
  revision?: string;
  functions: FunctionReport[];
  unmapped: UnmappedSymbol[];
  configIssues: Issue[];
  testsRan: boolean;
  runnerNote?: string;
  summary: LibSummary;
}

export interface LibSummary {
  total: number;
  ok: number;
  signature: number;
  failing: number;
  missing: number;
  missingCore: number;
  waived: number;
  testsPassed: number;
  testsFailed: number;
  testsSkipped: number;
  /** % of non-waived contract functions with status ok. */
  coverage: number;
  /** % of core functions with status ok. */
  coreCoverage: number;
}
