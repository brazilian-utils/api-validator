import type { CType } from "../core/ctype.js";
import type { ExportGroup, Rendered } from "../core/testgen.js";
import type { ContractFunction, LibConfig, NativeSymbol, RunnerCall, RunnerResult, TypeNode } from "../core/model.js";

export interface AdapterContext {
  lib: LibConfig;
  /** Absolute path to the lib checkout. */
  root: string;
  /** Scratch dir owned by this adapter for this lib (generated harnesses, build output...). */
  workDir: string;
}

export interface Extraction {
  symbols: NativeSymbol[];
  warnings: string[];
}

export interface ConformanceRunner {
  /** Executables that must be on PATH for the runner to work (checked up-front). */
  requires: string[];
  /**
   * Execute calls and return one result per call (same ids). Must never throw for a
   * failing call: report `{ ok: false, error }` instead. A call the runner cannot
   * express (e.g. an argument type it cannot build) returns `{ ok: false, unsupported: true }`.
   */
  run(ctx: AdapterContext, calls: RunnerCall[]): Promise<RunnerResult[]>;
}

/**
 * Everything the validator needs to know about one programming language.
 * Adding a language = implementing this interface in `src/languages/<id>/index.ts`
 * and registering it in `src/languages/registry.ts`. See docs/adding-a-language.md.
 */
export interface LanguageAdapter {
  id: string;
  /** Other names accepted in lib configs (e.g. "javascript" for "typescript"). */
  aliases?: string[];
  displayName: string;
  /**
   * Whether the language has optional parameters. When false (Go, Rust, F#), a contract
   * optional parameter implemented as a required one is a warning, not an error: the idiom
   * forces it, and the arity rule still catches real incompatibilities.
   */
  optionalParams?: boolean;

  /**
   * Native symbol names (as produced by `extract`) that would implement `fn` when the lib
   * follows the language's idiomatic naming, most preferred first. Lookup is case- and
   * separator-insensitive, so `cpf.IsValid` also finds `cpf.isValid`.
   */
  candidates(fn: ContractFunction, lib: LibConfig): string[];

  /** Extract the public API surface of the lib. Must only report symbols a user can call. */
  extract(ctx: AdapterContext): Promise<Extraction>;

  /**
   * Translate a native type (structured, as `extract` reported it) into a canonical type.
   * Return `T.unknown` when unsure: unknown types are reported as unverified, never as
   * mismatches. For returns, produce the success type (strip `error`, `Result`, `{ok, T}`...).
   * `native` is undefined when the language/tool reports no type.
   */
  mapType(native: TypeNode | undefined, position: "param" | "return", symbol: NativeSymbol): CType;

  /** External tools the adapter uses, checked by `doctor`. */
  tools?: Tool[];

  /** Optional: runs contract tests against the lib. */
  runner?: ConformanceRunner;

  /** Optional: renders the contract tests as a native test file of the lib (`export-tests`). */
  testgen?: TestGenerator;
}

export interface Tool {
  /** Executable looked up on PATH. */
  bin: string;
  /** Arguments printing its version (the first output line is shown); default `--version`, null = none. */
  version?: string[] | null;
  /** What it is needed for, e.g. "extraction", "shared tests", "formatting exported tests". */
  purpose: string;
  /** How to get it. */
  install: string;
  /** Missing optional tools only degrade a feature (reported, never fatal). */
  optional?: boolean;
}

export interface TestGenerator {
  /** Test framework, for messages (e.g. "unittest", "go test"). */
  framework: string;
  /** Where the file goes, relative to the lib root (overridable with `options.testFile`). */
  path(ctx: AdapterContext): string;
  /** The lib's own command that runs the file. */
  command(ctx: AdapterContext): string;
  /**
   * Render the whole file. `header` lines go at the top as comments. Cases that cannot be
   * written in the language are left out (as a comment) and listed in `unexpressible`.
   * Output must be deterministic: `export-tests --check` compares it byte for byte.
   */
  render(ctx: AdapterContext, groups: ExportGroup[], header: string[]): Rendered;
  /**
   * The lib's own formatter, applied to the rendered file so it passes the lib's format and
   * lint checks: commands run in the lib root with `{file}` replaced by a scratch copy placed
   * next to the target (so the lib's config applies). Skipped with a warning when the first
   * word is not on PATH. Overridable per lib with `options.testFormat` (list of commands).
   */
  format?(ctx: AdapterContext): string[][];
  /**
   * Other lib files that must change for the test runner to pick the file up (e.g. a
   * `<Compile Include>` in an .fsproj): returns their new content, or nothing when fine.
   */
  wire?(ctx: AdapterContext, file: string): Array<{ path: string; content: string }>;
}
