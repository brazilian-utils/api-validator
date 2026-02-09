#!/usr/bin/env node
import fs from "node:fs";
import { Command } from "commander";
import { loadExceptions, loadLibrariesConfig, loadSpec } from "./config.js";
import { readJsonFile } from "./utils/fs.js";
import { writeHtmlReport } from "./pipeline/report.js";
import { EXTRACT_OUTPUT_PATH, MATRIX_JSON_PATH, NORMALIZED_OUTPUT_PATH } from "./utils/paths.js";
import { runComparison } from "./pipeline/compare.js";
import { bootstrapSpecFromLibrary, writeSpec } from "./pipeline/bootstrap-spec.js";
import { runExtraction } from "./pipeline/extract.js";
import { assertLibrarySpecsFresh, loadLibrarySpecs, writeLibrarySpecs } from "./pipeline/lib-specs.js";
import { runNormalization } from "./pipeline/normalize.js";
import { syncRepositories } from "./pipeline/sync-repos.js";
import type { ComparatorOutput } from "./types.js";
import type { ExtractedPerLibrary } from "./pipeline/extract.js";
import type { NormalizedPerLibrary } from "./pipeline/normalize.js";

const program = new Command();

function loadOrFail<T>(filePath: string, help: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${filePath} not found. ${help}`);
  }
  return readJsonFile<T>(filePath);
}

function maybeFailCi(result: ComparatorOutput): void {
  if (!result.summary.failed) return;
  process.exitCode = 1;
}

program.name("api-validator").description("API Validator multi-language API validation");

program
  .command("update-libs")
  .description("Clone missing repositories and pull latest changes")
  .option("--branch <branch>", "Override branch for all repositories")
  .option("--no-shallow", "Disable shallow clone")
  .action((opts: { branch?: string; shallow?: boolean }) => {
    const libsConfig = loadLibrariesConfig();
    syncRepositories(libsConfig.libs, {
      branchOverride: opts.branch,
      shallow: opts.shallow ?? true
    });
  });

program
  .command("extract")
  .description("Extract public APIs from all repositories")
  .action(() => {
    const libsConfig = loadLibrariesConfig();
    runExtraction(libsConfig.libs);
    process.stdout.write(`Wrote ${EXTRACT_OUTPUT_PATH}\n`);
  });

program
  .command("normalize")
  .description("Normalize extracted APIs to canonical domain.function format")
  .action(() => {
    const exceptions = loadExceptions();
    const extracted = loadOrFail<ExtractedPerLibrary>(EXTRACT_OUTPUT_PATH, "Run `api-validator extract` first.");
    const normalized = runNormalization(extracted, exceptions);
    process.stdout.write(`Wrote ${NORMALIZED_OUTPUT_PATH} (${Object.keys(normalized).length} libraries)\n`);
  });

program
  .command("generate-lib-specs")
  .description("Generate one JSON API spec per library from normalized output")
  .action(() => {
    const normalized = loadOrFail<NormalizedPerLibrary>(
      NORMALIZED_OUTPUT_PATH,
      "Run `api-validator normalize` first."
    );
    const files = writeLibrarySpecs(normalized);
    process.stdout.write(`Wrote ${files.length} files in src/specs\n`);
  });

program
  .command("compare")
  .description("Compare library JSON specs against canonical spec")
  .action(() => {
    const spec = loadSpec();
    const exceptions = loadExceptions();
    assertLibrarySpecsFresh(NORMALIZED_OUTPUT_PATH);
    const normalized = loadLibrarySpecs();
    const comparison = runComparison(spec, normalized, exceptions);
    process.stdout.write(`Wrote ${MATRIX_JSON_PATH}\n`);
    process.stdout.write(
      `Missing=${comparison.summary.missingCount} SignatureMismatch=${comparison.summary.signatureMismatchCount} InvalidMappings=${comparison.summary.invalidMappingCount}\n`
    );
    maybeFailCi(comparison);
  });

program
  .command("report")
  .description("Generate HTML dashboard report")
  .action(() => {
    const matrix = loadOrFail<ComparatorOutput>(MATRIX_JSON_PATH, "Run `api-validator compare` first.");
    writeHtmlReport(matrix);
    process.stdout.write("Wrote output/index.html\n");
  });

program
  .command("bootstrap-spec")
  .description("Generate src/spec.json from normalized output of a source library")
  .option("--source <libName>", "Source library name", "brazilian-utils-javascript")
  .action((opts: { source: string }) => {
    const normalized = loadOrFail<NormalizedPerLibrary>(
      NORMALIZED_OUTPUT_PATH,
      "Run `api-validator normalize` first."
    );
    const spec = bootstrapSpecFromLibrary(normalized, opts.source);
    writeSpec(spec);
    process.stdout.write(`Wrote src/spec.json from ${opts.source}\n`);
  });

program
  .command("all")
  .description("Run full validation pipeline")
  .option("--branch <branch>", "Override branch for all repositories")
  .option("--no-shallow", "Disable shallow clone")
  .action((opts: { branch?: string; shallow?: boolean }) => {
    const libsConfig = loadLibrariesConfig();
    const spec = loadSpec();
    const exceptions = loadExceptions();

    syncRepositories(libsConfig.libs, {
      branchOverride: opts.branch,
      shallow: opts.shallow ?? true
    });

    const extracted = runExtraction(libsConfig.libs);
    const normalized = runNormalization(extracted, exceptions);
    writeLibrarySpecs(normalized);
    const fromSpecs = loadLibrarySpecs();
    const comparison = runComparison(spec, fromSpecs, exceptions);
    writeHtmlReport(comparison);

    process.stdout.write("Wrote output/{extracted.json,normalized.json,matrix.json,index.html}\n");
    process.stdout.write("Wrote src/specs/*.spec.json\n");
    process.stdout.write(
      `Missing=${comparison.summary.missingCount} SignatureMismatch=${comparison.summary.signatureMismatchCount} InvalidMappings=${comparison.summary.invalidMappingCount}\n`
    );

    maybeFailCi(comparison);
  });

program.parse();
