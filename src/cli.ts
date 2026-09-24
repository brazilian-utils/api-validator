#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command, Option } from "commander";
import { analyzeLib, bindLib, extractSurface } from "./core/analyze.js";
import { json, skipsFor, suiteFiles, type Outcomes } from "./core/cases.js";
import { baselineFrom, diffBaseline, loadBaseline, writeBaseline, type BaselineDiff } from "./core/baseline.js";
import { OldContractError, changelog, changelogMarkdown, contractAt } from "./core/changelog.js";
import { LABEL, closeReason, keyOf, marker, scopeFrom, wantedIssues, type Scope } from "./core/issues.js";
import { contractFile, loadContract } from "./core/contract.js";
import { formatDir, schemaFiles } from "./core/format-contract.js";
import { formatJson, orderDomain } from "./core/jsonfmt.js";
import { loadLibConfigs, validateLibAgainstContract } from "./core/libs.js";
import { answerKey, differential, diffDivergences, partition, divergenceBaseline, proposal, type DiffLib, type DivergenceBaseline } from "./core/differential.js";
import { SymbolIndex, proposeBindings, resolve } from "./core/match.js";
import type { ApiSurface, Contract, LibConfig, LibReport } from "./core/model.js";
import { globMatch } from "./core/naming.js";
import { parseCType } from "./core/ctype.js";
import { BASELINES_DIR, CONTRACT_DIR, LIBS_DIR, OUTPUT_DIR, PACKAGE_ROOT, REPOS_DIR, SCHEMA_DIR, SNAPSHOTS_DIR } from "./core/paths.js";
import { bestOverload, nativeSig } from "./core/signature.js";
import { run, which } from "./core/shell.js";
import { getAdapter } from "./languages/registry.js";
import type { LanguageAdapter, Tool } from "./languages/types.js";
import { syncRepo, workspaceFor } from "./core/workspace.js";
import { c, consoleSummary } from "./reporters/console.js";
import { siteDataFiles, type SiteDataLib } from "./reporters/sitedata.js";
import { materializeUsage, ownUsage, parseUsageDir, scaffoldUsage, summarizeUsage, usageFilesFor, usageStatus } from "./core/usage.js";
import { repoSlug, shortName, slugOf } from "../site/src/lib/usage-format.mjs";
import { briefMarkdown, type ImplRef } from "./reporters/brief.js";
import { libMarkdown, overviewMarkdown } from "./reporters/markdown.js";

type FailOn = "regression" | "error" | "never";

function selectLibs(all: LibConfig[], names: string[] | undefined): LibConfig[] {
  if (!names || names.length === 0) return all;
  return names.map((n) => {
    const found = all.find((l) => l.name === n || l.name === `brazilian-utils-${n}` || l.language === n);
    if (!found) throw new Error(`Unknown lib "${n}". Known: ${all.map((l) => l.name).join(", ")}`);
    return found;
  });
}

/** `--lib` names (short ones too); `--path` is one lib's checkout. */
function libsFor(opts: { lib?: string[]; path?: string }): LibConfig[] {
  const libs = selectLibs(loadLibConfigs(LIBS_DIR), opts.lib);
  if (opts.path && libs.length !== 1) throw new Error("--path needs exactly one --lib");
  return libs;
}

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
/** The report of the last `check` run for a lib. */
const reportFile = (lib: LibConfig) => path.join(OUTPUT_DIR, `${lib.name}.report.json`);
const noReport = (lib: LibConfig, then: string) => `${lib.name}: no report in ${path.relative(process.cwd(), OUTPUT_DIR)} (run check --tests first), ${then}`;

function writeFile(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
}

/** Append tests to functions of a contract file (then `fmt` puts it in canonical form). */
function appendTests(file: string, ops: Record<string, Array<Record<string, unknown>>>): number {
  const doc = readJson<{ functions: Record<string, { tests?: unknown[] }> }>(file);
  let added = 0;
  for (const [op, tests] of Object.entries(ops)) {
    const fn = doc.functions[op];
    if (!fn) continue;
    (fn.tests ??= []).push(...tests);
    added += tests.length;
  }
  fs.writeFileSync(file, formatJson(orderDomain(doc as never)));
  return added;
}

const REFERENCE_LIB = "brazilian-utils-javascript";
/** `--reference` accepts short names too (`javascript`): the full lib name. */
const referenceName = (name: string) => selectLibs(loadLibConfigs(LIBS_DIR), [name])[0].name;
const USAGE_FIXTURES = path.join(PACKAGE_ROOT, "site", "fixtures", "usage");

function listFiles(dir: string, prefix = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]
  );
}

function casesReadme(lib: LibConfig): string {
  return `# API contract cases

Vendored from [brazilian-utils/api-validator](https://github.com/brazilian-utils/api-validator): the
shared test vectors every brazilian-utils implementation runs. **Do not edit** — change the contract
there; this copy is refreshed by a bot PR, or by hand:

    npx tsx <api-validator>/src/cli.ts export-cases --lib ${lib.name} --path .

- \`cases/<domain>.json\`: contract functions with their cases (\`cases.schema.json\`).
- \`cases/index.json\`: the comparison rules the harness implements.
- \`cases/equality.json\`: self-test for the harness's comparison function.
- \`skip.json\`: cases this lib does not pass yet, with the reason (generated from the api-validator
  baseline and known failures). Fix the lib, and the next refresh drops the entry.

The harness in this repository maps contract function ids to this lib's functions and runs every
case with the lib's own test command. Keep this directory out of the lib's formatter and linters
(it is vendored). Harness spec: https://github.com/brazilian-utils/api-validator/blob/main/docs/harness.md
`;
}

function writeSnapshot(surface: ApiSurface) {
  // Adapter metadata is runtime-only; the snapshot is for humans reviewing API changes in PRs.
  const clean = {
    ...surface,
    symbols: surface.symbols.map(({ meta: _meta, returnsNode: _r, ...s }) => ({ ...s, params: s.params.map(({ typeNode: _t, ...p }) => p) }))
  };
  writeFile(path.join(SNAPSHOTS_DIR, `${surface.library}.api.json`), json(clean));
}

interface RunOptions {
  lib?: string[];
  path?: string;
  tests?: boolean;
  only?: string;
  snapshot?: boolean;
}

type Analyzed = { report: LibReport; lib: LibConfig; root: string };

/** One lib after another. A lib whose extraction or tests crash (a default branch that no longer
 *  builds, a toolchain gone) is reported in `failed` and the others still get their reports. */
async function analyzeMany(contract: Contract, opts: RunOptions): Promise<{ results: Analyzed[]; failed: Array<{ lib: LibConfig; error: string }> }> {
  const results: Analyzed[] = [];
  const failed: Array<{ lib: LibConfig; error: string }> = [];
  for (const lib of libsFor(opts)) {
    const ws = workspaceFor(lib, opts.path);
    const { ctx } = ws;
    const started = Date.now();
    process.stderr.write(c.dim(`• ${lib.name}: extracting…`));
    try {
      const surface = await extractSurface(ws.adapter, ctx);
      for (const w of surface.warnings) process.stderr.write(`\n  ${c.yellow("warning")}: ${w}`);
      if (opts.snapshot) writeSnapshot(surface);
      if (opts.tests) process.stderr.write(c.dim(" running conformance tests…"));
      const filter = opts.only ? (t: { id: string }) => globMatch(opts.only!, t.id.split("#")[0]) || globMatch(opts.only!, t.id) : undefined;
      const report = await analyzeLib({ contract, adapter: ws.adapter, ctx, surface, runTests: !!opts.tests, testFilter: filter });
      process.stderr.write(c.dim(` done in ${((Date.now() - started) / 1000).toFixed(1)}s\n`));
      results.push({ report, lib, root: ws.root });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      process.stderr.write(`\n  ${c.red("error")}: ${error}\n`);
      failed.push({ lib, error });
    }
  }
  return { results, failed };
}

/** One lib, for the commands about a single lib: a crash is an error. */
async function analyzeOne(contract: Contract, opts: RunOptions): Promise<Analyzed> {
  const { results, failed } = await analyzeMany(contract, opts);
  if (failed.length) throw new Error(failed.map((f) => `${f.lib.name}: ${f.error}`).join("\n"));
  return results[0];
}

function shouldFail(failOn: FailOn, report: LibReport, diff: BaselineDiff): boolean {
  if (report.configIssues.some((i) => i.severity === "error")) return true;
  if (failOn === "never") return false;
  if (failOn === "regression") return diff.regressions.length > 0;
  return report.summary.signature > 0 || report.summary.failing > 0 || report.summary.missingCore > 0;
}

const program = new Command();
program
  .name("api-validator")
  .description("Cross-language API contract validator for the brazilian-utils libraries")
  .showHelpAfterError();

program
  .command("sync")
  .description("Clone or update the lib repositories into .repos/")
  .option("-l, --lib <names...>", "only these libs")
  .option("--branch <branch>", "branch to check out")
  .option("--full", "full clone instead of shallow")
  .action((opts) => {
    for (const lib of selectLibs(loadLibConfigs(LIBS_DIR), opts.lib)) syncRepo(lib, { branch: opts.branch, shallow: !opts.full });
  });

program
  .command("libs")
  .description("List the configured libs as `<name> <owner/repo>` lines (for scripts)")
  .action(() => {
    for (const lib of loadLibConfigs(LIBS_DIR)) {
      console.log(`${lib.name} ${lib.repo ? repoSlug(lib.repo) : ""}`);
    }
  });

program
  .command("doctor")
  .description("Check the toolchains every configured lib needs (extraction, shared tests)")
  .option("-l, --lib <names...>", "only these libs")
  .action((opts) => {
    // Libs grouped by the adapter (language) they use, in first-use order.
    const byAdapter = new Map<string, { adapter: LanguageAdapter; users: LibConfig[] }>();
    for (const lib of selectLibs(loadLibConfigs(LIBS_DIR), opts.lib)) {
      const adapter = getAdapter(lib.language);
      const group = byAdapter.get(adapter.id) ?? byAdapter.set(adapter.id, { adapter, users: [] }).get(adapter.id)!;
      group.users.push(lib);
    }
    let missing = 0;
    for (const { adapter, users } of byAdapter.values()) {
      console.log(`\n${c.bold(adapter.displayName)} ${c.dim(`(${users.map((l) => l.name).join(", ")})`)}`);
      const tools: Tool[] = adapter.tools ?? (adapter.runner?.requires ?? []).map((bin) => ({ bin, purpose: "shared tests", install: "see docs/adding-a-language.md" }));
      for (const t of tools) {
        const found = which(t.bin);
        // Presence decides; the version line is informational (not every tool has a flag for it).
        const v = found && t.version !== null ? run(t.bin, t.version ?? ["--version"], { timeoutMs: 60_000 }) : undefined;
        const line = v?.status === 0 ? (v.stdout || v.stderr).trim().split("\n")[0] : undefined;
        const version = line ? (t.versionOf ? `${t.versionOf}: ${line}` : line) : "installed";
        if (!found && !t.optional) missing++;
        const mark = found ? c.green("✓") : t.optional ? c.yellow("○") : c.red("✗");
        console.log(`  ${mark} ${t.bin.padEnd(8)} ${found ? c.dim(version) : c.yellow(`missing — ${t.install}`)}  ${c.dim(`[${t.purpose}]`)}`);
      }
      for (const { name } of users) {
        const checkout = fs.existsSync(path.join(REPOS_DIR, name));
        const base = loadBaseline(BASELINES_DIR, name);
        console.log(
          `  ${checkout ? c.green("✓") : c.yellow("○")} ${name}: ${checkout ? "checked out" : "not checked out (run sync)"}, ${base ? `baseline with ${base.tests.length} tests` : "no baseline"}`
        );
      }
    }
    console.log(missing ? c.red(`\n${missing} required tools missing`) : c.green("\nall required tools present"));
    if (missing) process.exitCode = 1;
  });

program
  .command("lint")
  .description("Validate the contract and every lib config (fast, no checkout needed)")
  .option("--strict", "also fail on functions without test vectors")
  .action((opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const libs = loadLibConfigs(LIBS_DIR);
    let errors = 0;
    for (const lib of libs) {
      for (const i of validateLibAgainstContract(lib, contract)) {
        console.log(`${i.severity}: ${i.message}`);
        if (i.severity === "error") errors++;
      }
    }
    // A function without vectors can only be checked for its name and signature: every lib
    // may implement it differently and nothing would notice.
    const untested = [...contract.functions.values()].filter((f) => f.tests.length === 0 && !f.network);
    for (const f of untested) console.log(`${opts.strict ? "error" : "warning"}: ${f.id} has no test vectors (${f.source})`);
    const tests = [...contract.functions.values()].reduce((n, f) => n + f.tests.length, 0);
    console.log(`contract: ${contract.domains.size} domains, ${contract.functions.size} functions (${untested.length} without tests), ${tests} tests; ${libs.length} libs`);
    if (errors || (opts.strict && untested.length)) process.exitCode = 1;
  });

program
  .command("fmt")
  .description("Format contract/<domain>/contract.json and libs/*.json canonically and regenerate schema/ (editor validation)")
  .option("--check", "only report files that are not formatted or schemas that are stale (for CI)")
  .action((opts) => {
    const dirs: Array<[string, "contract" | "lib", string]> = [
      [CONTRACT_DIR, "contract", "contract"],
      [LIBS_DIR, "lib", "libs"]
    ];
    let bad = 0;
    for (const [dir, kind, label] of dirs) {
      for (const f of formatDir(dir, kind, !opts.check)) {
        console.log(`${opts.check ? "not formatted" : "formatted"}: ${label}/${f}`);
        bad++;
      }
    }
    for (const [name, content] of schemaFiles()) {
      const file = path.join(SCHEMA_DIR, name);
      if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) continue;
      if (opts.check) {
        console.log(`stale: schema/${name}`);
        bad++;
      } else {
        writeFile(file, content);
        console.log(`wrote schema/${name}`);
      }
    }
    if (opts.check && bad) process.exitCode = 1;
    if (!opts.check) {
      loadContract(CONTRACT_DIR);
      loadLibConfigs(LIBS_DIR);
    }
  });

program
  .command("extract")
  .description("Extract the public API of libs and write snapshots/<lib>.api.json")
  .option("-l, --lib <names...>", "only these libs")
  .option("-p, --path <dir>", "lib checkout to use (default: .repos/<lib>)")
  .action(async (opts) => {
    for (const lib of selectLibs(loadLibConfigs(LIBS_DIR), opts.lib)) {
      const ws = workspaceFor(lib, opts.path);
      const surface = await extractSurface(ws.adapter, ws.ctx);
      writeSnapshot(surface);
      console.log(`${lib.name}: ${surface.symbols.length} public symbols${surface.warnings.length ? `, ${surface.warnings.length} warnings` : ""}`);
      for (const w of surface.warnings) console.log(`  warning: ${w}`);
    }
  });

program
  .command("check")
  .description("Compare libs against the contract (and optionally run the shared conformance tests)")
  .option("-l, --lib <names...>", "only these libs")
  .option("-p, --path <dir>", "lib checkout to use (a lib's own CI: --lib <name> --path .)")
  .option("-t, --tests", "run the shared conformance tests")
  .option("--only <glob>", "only run tests of matching functions, e.g. 'cpf.*'")
  .addOption(new Option("--fail-on <policy>", "exit non-zero on").choices(["regression", "error", "never"]).default("regression"))
  .option("-v, --verbose", "list every problem in the console")
  .option("--no-snapshot", "do not update snapshots/")
  .option("--summary <file>", "also write the markdown report to this file (e.g. $GITHUB_STEP_SUMMARY)")
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const { results, failed: crashed } = await analyzeMany(contract, opts);
    let failed = crashed.length > 0;
    const markdown: string[] = [];
    for (const { report, lib, root } of results) {
      const diff = diffBaseline(report, loadBaseline(BASELINES_DIR, report.library));
      console.log(consoleSummary(report, diff, opts.verbose || results.length === 1));
      // Usage examples for the docs site: the lib's own docs/usage/, else the site fixtures.
      const usage = usageStatus(contract, report, usageFilesFor(contract, lib, root, USAGE_FIXTURES, report));
      writeFile(reportFile(lib), json({ ...report, baseline: diff, usage }));
      const md = libMarkdown(report, contract, diff);
      writeFile(path.join(OUTPUT_DIR, `${report.library}.md`), md);
      markdown.push(md);
      if (shouldFail(opts.failOn as FailOn, report, diff)) failed = true;
    }
    if (results.length > 1) {
      writeFile(path.join(OUTPUT_DIR, "README.md"), `# API conformance\n\n${overviewMarkdown(results.map((r) => r.report))}\n\n${markdown.join("\n\n")}`);
      console.log(c.dim(`\nReports: ${path.relative(process.cwd(), OUTPUT_DIR)}/{README.md,<lib>.md,<lib>.report.json}; docs site data: api-validator site-data`));
    } else if (results.length === 1) console.log(c.dim(`\nReport: ${path.relative(process.cwd(), path.join(OUTPUT_DIR, `${results[0].report.library}.md`))}`));
    // A lib that crashed has no report: the site shows it without status, and the run fails.
    if (crashed.length) markdown.push(`## Not checked\n\n${crashed.map((f) => `- **${f.lib.name}**: ${f.error.split("\n")[0]}`).join("\n")}`);
    if (opts.summary) fs.appendFileSync(opts.summary, `${markdown.join("\n\n")}\n`);
    if (failed) process.exitCode = 1;
  });

program
  .command("usage")
  .description("Usage examples for the docs site: which implemented functions each lib documents, and scaffold the missing sections")
  .option("-l, --lib <names...>", "only these libs")
  .option("-p, --path <dir>", "lib checkout: read and write its own usage files (<site.usage.path>) instead of the site fixtures")
  .option("--scaffold", "append a section for every implemented function without one, from the shared cases the lib passes")
  .option("--materialize", "write the lib's own usage (its usage files and reference page, from its checkout) as usage files in the site fixtures (or --out)")
  .option("-o, --out <dir>", "with --materialize: where to write (default: site/fixtures/usage/<lib>/)")
  .option("--strict", "exit non-zero when an implemented function has no usage section or a section has problems")
  .action((opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const libs = libsFor(opts);
    if (opts.materialize && opts.out && libs.length !== 1) throw new Error("--out needs exactly one --lib");
    let bad = false;
    for (const lib of libs) {
      if (!fs.existsSync(reportFile(lib))) {
        console.log(c.yellow(noReport(lib, "skipped")));
        continue;
      }
      if (!lib.site) continue;
      const report = readJson<LibReport>(reportFile(lib));
      // The lib's checkout: an explicit --path, else the synced clone.
      const root = opts.path ?? path.join(REPOS_DIR, lib.name);
      const dir = opts.path ? path.join(opts.path, lib.site.usage.path) : path.join(USAGE_FIXTURES, shortName(lib.name));
      if (opts.materialize) {
        const { sections } = ownUsage(contract, lib, root, report);
        const out = opts.out ?? path.join(USAGE_FIXTURES, shortName(lib.name));
        if (sections.length) {
          fs.rmSync(out, { recursive: true, force: true });
          const files = materializeUsage(contract, sections, `${lib.repo ?? lib.name}@${report.revision?.slice(0, 7) ?? "?"}`);
          for (const [name, content] of files) writeFile(path.join(out, name), content);
          console.log(c.dim(`${lib.name}: materialized ${sections.length} sections into ${files.size} file(s) in ${path.relative(process.cwd(), out)}`));
        } else console.log(c.dim(`${lib.name}: no usage files or reference page in ${path.relative(process.cwd(), root)}`));
      }
      if (opts.scaffold) {
        const snapshot = path.join(SNAPSHOTS_DIR, `${lib.name}.api.json`);
        const natives = new Map((fs.existsSync(snapshot) ? readJson<ApiSurface>(snapshot).symbols : []).map((s) => [s.name, { returns: s.returns, params: s.params }]));
        const alsoDocumented = ownUsage(contract, lib, root, report).sections;
        const files = scaffoldUsage({ contract, lib, report, natives, existing: parseUsageDir(contract, dir), alsoDocumented }, (f) =>
          fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : undefined
        );
        for (const [name, content] of files) writeFile(path.join(dir, name), content);
        console.log(c.dim(`${lib.name}: scaffolded ${files.size} file(s) in ${path.relative(process.cwd(), dir)}`));
      }
      const files = opts.path ? ownUsage(contract, lib, opts.path, report) : usageFilesFor(contract, lib, root, USAGE_FIXTURES, report);
      const usage = usageStatus(contract, report, files);
      const sum = summarizeUsage(report, usage);
      const where = files.dir ? path.relative(process.cwd(), files.dir) : "no usage files";
      console.log(`${c.bold(lib.name)}: ${sum.documented}/${sum.implemented} implemented functions documented, ${sum.problems} problem(s) (${where})`);
      if (sum.undocumented.length) console.log(c.dim(`  undocumented: ${sum.undocumented.join(", ")}`));
      for (const [fn, u] of Object.entries(usage)) for (const p of u.problems) console.log(`  ${c.yellow("problem")} ${fn}: ${p}`);
      for (const w of files.warnings) console.log(`  ${c.yellow("warning")} ${w}`);
      if (sum.problems || files.warnings.length || sum.undocumented.length) bad = true;
    }
    if (opts.strict && bad) process.exitCode = 1;
  });

program
  .command("cases")
  .description("Write the contract's test vectors as the JSON conformance suite (cases/<domain>.json, schema, index)")
  .option("-o, --out <dir>", "output directory", path.join(OUTPUT_DIR, "site"))
  .action((opts) => {
    const files = suiteFiles(loadContract(CONTRACT_DIR));
    for (const [rel, value] of files) writeFile(path.join(opts.out, rel), json(value));
    console.log(`wrote ${files.size} files to ${path.relative(process.cwd(), opts.out)}`);
  });

program
  .command("site-data")
  .description("Export what the last run found (status per lib and function, badges, JSON suite) for the docs site in site/")
  .option("-o, --out <dir>", "the docs site root", path.join(PACKAGE_ROOT, "site"))
  .action((opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const libs: SiteDataLib[] = [];
    for (const lib of loadLibConfigs(LIBS_DIR)) {
      if (!fs.existsSync(reportFile(lib))) {
        console.error(c.yellow(noReport(lib, "shown without status")));
        continue;
      }
      const report = readJson<LibReport>(reportFile(lib));
      // Recomputed rather than read from the report, so edits to the usage fixtures show up.
      const usage = usageStatus(contract, report, usageFilesFor(contract, lib, path.join(REPOS_DIR, lib.name), USAGE_FIXTURES, report));
      libs.push({ lib, report, usage });
    }
    const diffFile = path.join(OUTPUT_DIR, "diff.json");
    const files = siteDataFiles({
      contract,
      libs,
      diff: fs.existsSync(diffFile) ? readJson(diffFile) : undefined,
      generatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z")
    });
    for (const [rel, content] of files) writeFile(path.join(opts.out, rel), content);
    console.log(`site-data: ${files.size} files into ${path.relative(process.cwd(), opts.out) || "."} (${libs.length} libs with status)`);
  });

program
  .command("export-cases")
  .description("Vendor the JSON conformance suite into a lib (api-contract/), with the lib's skip list; its harness runs it")
  .option("-l, --lib <names...>", "only these libs")
  .option("-p, --path <dir>", "lib checkout to write into (default: .repos/<lib>)")
  .option("--check", "only verify the vendored copy is current (for the lib's CI); exit 1 if stale")
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const suite = suiteFiles(contract);
    let stale = 0;
    for (const lib of libsFor(opts)) {
      const ws = workspaceFor(lib, opts.path);
      const { bound } = bindLib(contract, ws.adapter, lib, await extractSurface(ws.adapter, ws.ctx));
      const implemented = new Set(bound.map((b) => b.fn.id));
      const dir = typeof lib.options.casesDir === "string" ? lib.options.casesDir : "api-contract";
      const files = new Map(suite);
      const outcomes: Outcomes | undefined = fs.existsSync(reportFile(lib))
        ? new Map(readJson<LibReport>(reportFile(lib)).functions.flatMap((f) => f.tests.map((t) => [t.id, t] as const)))
        : undefined;
      files.set("skip.json", skipsFor(lib, contract, implemented, loadBaseline(BASELINES_DIR, lib.name), outcomes));
      const wanted = new Map([...files].map(([rel, v]) => [rel, json(v)]));
      wanted.set("README.md", casesReadme(lib));
      const target = path.join(ws.root, dir);
      const existing = fs.existsSync(target) ? listFiles(target) : [];
      // JSON is compared by value, so a lib formatter re-indenting the files is not "stale".
      const same = (rel: string, content: string) => {
        const file = path.join(target, rel);
        if (!fs.existsSync(file)) return false;
        const cur = fs.readFileSync(file, "utf8");
        if (!rel.endsWith(".json")) return cur.trim() === content.trim();
        try {
          return JSON.stringify(JSON.parse(cur)) === JSON.stringify(JSON.parse(content));
        } catch {
          return false;
        }
      };
      const changed = [...wanted].filter(([rel, content]) => !same(rel, content)).map(([rel]) => rel);
      const removed = existing.filter((rel) => !wanted.has(rel));
      const skips = Object.keys(files.get("skip.json") as object).length;
      const summary = `${implemented.size} of ${contract.functions.size} functions implemented, ${skips} cases skipped`;
      if (opts.check) {
        if (changed.length || removed.length) {
          stale++;
          console.log(`${lib.name}: ${dir}/ is out of date with the contract (${[...changed, ...removed.map((r) => `-${r}`)].slice(0, 8).join(", ")}${changed.length + removed.length > 8 ? ", …" : ""})`);
          console.log(`  refresh: npx tsx <api-validator>/src/cli.ts export-cases --lib ${lib.name} --path .`);
        } else console.log(`${lib.name}: ${dir}/ up to date — ${summary}`);
        continue;
      }
      for (const rel of changed) writeFile(path.join(target, rel), wanted.get(rel)!);
      for (const rel of removed) fs.rmSync(path.join(target, rel));
      console.log(`${lib.name}: ${changed.length + removed.length ? `updated ${changed.length + removed.length} files in` : "unchanged"} ${dir}/ — ${summary}`);
    }
    if (stale) process.exitCode = 1;
  });

program
  .command("changelog")
  .description("What changed in the contract between two git refs (functions, signatures, test vectors), as markdown")
  .option("--from <ref>", "base ref", "HEAD")
  .option("--to <ref>", "target ref (WORKTREE = files on disk)", "WORKTREE")
  .option("-o, --out <file>", "also write the markdown to this file (e.g. $GITHUB_STEP_SUMMARY)")
  .action((opts) => {
    const repo = path.dirname(CONTRACT_DIR);
    const md = changelogMarkdown(changelog(contractAt(repo, CONTRACT_DIR, opts.from), contractAt(repo, CONTRACT_DIR, opts.to)), opts.from, opts.to);
    process.stdout.write(md);
    if (opts.out) fs.appendFileSync(opts.out, md);
  });

program
  .command("baseline")
  .description("Record what currently conforms as the lib's baseline (CI then fails only on regressions)")
  .option("-l, --lib <names...>", "only these libs")
  .option("-p, --path <dir>", "lib checkout to use")
  .option("-t, --tests", "also record passing conformance tests")
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const { results, failed } = await analyzeMany(contract, { ...opts, snapshot: true });
    if (failed.length) process.exitCode = 1;
    for (const { report } of results) {
      const previous = loadBaseline(BASELINES_DIR, report.library);
      const next = baselineFrom(report, previous);
      const lost = previous ? previous.ok.filter((id) => !next.ok.includes(id)) : [];
      writeBaseline(BASELINES_DIR, next);
      console.log(`${report.library}: ${next.ok.length} functions, ${next.tests.length} tests in baseline${lost.length ? c.yellow(` (dropped: ${lost.join(", ")})`) : ""}`);
    }
  });

program
  .command("todo")
  .description("Print the markdown TODO list of a lib (what is missing / wrong, most important first)")
  .requiredOption("-l, --lib <name>", "lib")
  .option("-p, --path <dir>", "lib checkout to use")
  .option("-t, --tests", "include conformance test results")
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const { report } = await analyzeOne(contract, { ...opts, lib: [opts.lib] });
    console.log(libMarkdown(report, contract, diffBaseline(report, loadBaseline(BASELINES_DIR, report.library))));
  });

/** Analyze every lib (for cross-references) and return the target plus the others. */
async function allImpls(contract: Contract, target: string, opts: { path?: string; tests?: boolean }) {
  const libs = loadLibConfigs(LIBS_DIR);
  const targetLib = selectLibs(libs, [target])[0];
  const refs: ImplRef[] = [];
  for (const lib of libs) {
    const explicit = lib.name === targetLib.name ? opts.path : undefined;
    try {
      const r = await analyzeOne(contract, { lib: [lib.name], path: explicit, tests: opts.tests && lib.name === targetLib.name });
      refs.push(r);
    } catch (e) {
      if (lib.name === targetLib.name) throw e; // other checkouts are optional context
    }
  }
  const mine = refs.find((r) => r.lib.name === targetLib.name)!;
  return { mine, others: refs.filter((r) => r !== mine), adapter: getAdapter(mine.lib.language) };
}

program
  .command("brief")
  .description("Porting brief for one contract function in one lib: idiomatic name, tests, reference source, links")
  .argument("<function>", "contract function id or glob, e.g. cpf.isValid or 'pis.*'")
  .requiredOption("-l, --lib <name>", "lib that should implement it")
  .option("-p, --path <dir>", "checkout of that lib")
  .option("--reference <lib>", "lib whose source is embedded", REFERENCE_LIB)
  .option("--no-tests", "skip running the shared tests on the target lib")
  .action(async (pattern: string, opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const fns = [...contract.functions.values()].filter((f) => globMatch(pattern, f.id));
    if (!fns.length) throw new Error(`No contract function matches ${pattern}`);
    const reference = referenceName(opts.reference);
    const { mine, others, adapter } = await allImpls(contract, opts.lib, opts);
    for (const fn of fns) console.log(briefMarkdown(fn, mine, adapter, others, reference));
  });

program
  .command("issues")
  .description("One GitHub issue per function per lib: open 'implement' / 'fix' issues for what a contract change introduced, refresh them, close the done ones")
  .option("-l, --lib <names...>", "only these libs")
  .option("--since <ref>", "open issues for what changed in the contract since this git ref (e.g. the commit before a merge)")
  .addOption(new Option("--backfill <level>", "also open issues for everything already missing or failing").choices(["core", "all"]))
  .option("--apply", "create/update/close the issues with the gh CLI (needs GH_TOKEN); default: print the plan")
  .option("--bodies", "with the plan, print each issue's body too")
  .option("--reference <lib>", "lib whose source is embedded in the briefs", REFERENCE_LIB)
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    let before: Contract | undefined;
    try {
      before = opts.since ? contractAt(path.dirname(CONTRACT_DIR), CONTRACT_DIR, opts.since) : undefined;
    } catch (e) {
      // An older contract today's schema cannot read: say so and open nothing for that change
      // (the refresh and close below still run). A bad ref is still an error.
      if (!(e instanceof OldContractError)) throw e;
      console.log(c.yellow(`since ${opts.since}: ${e.message}; opening no issues for it`));
    }
    // A ref from before the contract existed (the merge that brings it in) would make every function
    // "new" and open an issue for everything any library lacks. That is a backfill: it is asked for
    // on purpose (--backfill, the workflow's input), never by accident.
    const firstContract = !!before && before.functions.size === 0;
    if (firstContract) console.log(c.yellow(`since ${opts.since}: no contract at that ref; opening no issues for it (use --backfill core|all to open them)`));
    const scope: Scope = before && !firstContract ? scopeFrom(changelog(before, contract)) : { added: new Set(), cases: new Set() };
    if (before && !firstContract) console.log(c.dim(`since ${opts.since}: ${scope.added.size} new functions, ${scope.cases.size} new or changed cases`));
    // Reports from the last `check --tests` (the pipeline runs it right before).
    const reference = referenceName(opts.reference);
    const refs: ImplRef[] = [];
    for (const lib of loadLibConfigs(LIBS_DIR)) {
      if (fs.existsSync(reportFile(lib))) refs.push({ lib, report: readJson<LibReport>(reportFile(lib)), root: path.join(REPOS_DIR, lib.name) });
    }
    const site = process.env.SITE_URL?.replace(/\/$/, "");
    for (const lib of selectLibs(loadLibConfigs(LIBS_DIR), opts.lib)) {
      const mine = refs.find((r) => r.lib.name === lib.name);
      if (!mine) {
        console.log(c.yellow(noReport(lib, "skipped")));
        continue;
      }
      const adapter = getAdapter(lib.language);
      const others = refs.filter((r) => r !== mine);
      const body = (key: string, fnId: string, kind: string) =>
        [
          marker(key),
          kind === "implement"
            ? `\`${fnId}\` is in the [shared contract](https://github.com/brazilian-utils/api-validator) and this lib does not implement it yet.`
            : `Shared cases of \`${fnId}\` fail in this lib.`,
          site ? `Spec, every implementation and results: ${site}/utils/${slugOf(fnId.split(".")[0])}/ · this lib: ${site}/libs/${shortName(lib.name)}/` : "",
          "",
          briefMarkdown(contract.functions.get(fnId)!, mine, adapter, others, reference),
          "Add the function to the harness registry; its cases then run with this repo's own tests. This issue closes automatically once the api-validator run sees it done.",
          "",
          kind === "implement" && lib.site
            ? `Then document it for the docs site: a \`## ${contract.functions.get(fnId)!.operation}\` section in \`${lib.site.usage.path}/${slugOf(fnId.split(".")[0])}.md\` with a short example (\`api-validator usage --lib ${shortName(lib.name)} --path . --scaffold\` writes one from the cases the lib passes). Format: ${site ? `${site}/contributing/usage-files/` : "https://github.com/brazilian-utils/api-validator/blob/main/site/content/docs/contributing/usage-files.mdx"}`
            : "",
          "",
          "_Maintained by [api-validator](https://github.com/brazilian-utils/api-validator): opened, refreshed and closed automatically._"
        ].join("\n");
      const wanted = wantedIssues(contract, mine.report, scope, opts.backfill);
      const slug = lib.repo ? repoSlug(lib.repo) : undefined;
      if (!opts.apply || !slug) {
        console.log(`${c.bold(lib.name)}: ${wanted.length} issues wanted${slug ? "" : " (no repo configured)"}`);
        for (const w of wanted) {
          console.log(`  open  ${w.title}`);
          if (opts.bodies) console.log(`\n${body(w.key, w.fn, w.kind)}\n`);
        }
        continue;
      }
      const gh = (args: string[]) => {
        const r = run("gh", args, { timeoutMs: 120_000 });
        if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(" ")} failed: ${r.stderr.trim()}`);
        return r.stdout;
      };
      gh(["label", "create", LABEL, "-R", slug, "--color", "0E8A16", "--description", "Shared API contract work", "--force"]);
      const open = (JSON.parse(gh(["issue", "list", "-R", slug, "--label", LABEL, "--state", "open", "--limit", "1000", "--json", "number,body"])) as Array<{ number: number; body: string }>)
        .map((i) => ({ ...i, key: keyOf(i.body) }))
        .filter((i): i is { number: number; body: string; key: string } => !!i.key);
      const tmp = path.join(os.tmpdir(), `api-contract-issue-${process.pid}.md`);
      let created = 0;
      let updated = 0;
      let closed = 0;
      // Two runs at once (a merge and the nightly) can both open the same issue: the oldest stays.
      const seen = new Set<string>();
      for (const i of open.sort((a, b) => a.number - b.number)) {
        const reason = seen.has(i.key) ? `duplicate of an older open issue (${i.key}).` : closeReason(i.key, contract, mine.report);
        seen.add(i.key);
        if (reason) {
          gh(["issue", "close", String(i.number), "-R", slug, "--comment", `Closed by api-validator: ${reason}`]);
          closed++;
          continue;
        }
        const [kind, fnId] = i.key.split(":");
        const fresh = body(i.key, fnId, kind);
        if (fresh.trim() !== i.body.trim()) {
          fs.writeFileSync(tmp, fresh);
          gh(["issue", "edit", String(i.number), "-R", slug, "--body-file", tmp]);
          updated++;
        }
      }
      const have = new Set(open.map((i) => i.key));
      for (const w of wanted) {
        if (have.has(w.key)) continue;
        fs.writeFileSync(tmp, body(w.key, w.fn, w.kind));
        gh(["issue", "create", "-R", slug, "--title", w.title, "--label", LABEL, "--body-file", tmp]);
        created++;
      }
      fs.rmSync(tmp, { force: true });
      console.log(`${lib.name}: ${created} opened, ${updated} refreshed, ${closed} closed`);
    }
  });

program
  .command("probe")
  .description("Call one contract function with the given args in every lib and compare the answers")
  .argument("<function>", "contract function id, e.g. cpf.format")
  .argument("[args...]", "JSON arguments, e.g. '\"82178537464\"'")
  .option("-l, --lib <names...>", "only these libs")
  .action(async (fnId: string, rawArgs: string[], opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const fn = contract.functions.get(fnId);
    if (!fn) throw new Error(`Unknown contract function ${fnId}`);
    // JSON, or a bare string: `probe cpf.format 82178537464` passes the digits as the string the
    // contract asks for, not as a number (also when the param is a union that includes string).
    const acceptsString = (type: string | undefined) => {
      if (!type) return false;
      const t = parseCType(type);
      return t.k === "string" || (t.k === "union" && t.of.some((x) => x.k === "string"));
    };
    const args = rawArgs.map((a, i) => {
      let value: unknown;
      try {
        value = JSON.parse(a);
      } catch {
        return a;
      }
      const type = fn.params[i]?.type;
      if (type === "string" && typeof value !== "string") return a;
      return /^\d+$/.test(a) && acceptsString(type) ? a : value;
    });
    // Answers compared by value (like `diff`), not by how they print.
    const NO_ANSWER = ["not implemented", "no runner", "unsupported"];
    const answers = new Map<string, string[]>();
    for (const lib of selectLibs(loadLibConfigs(LIBS_DIR), opts.lib)) {
      const { adapter, ctx } = workspaceFor(lib);
      const surface = await extractSurface(adapter, ctx);
      const res = resolve(fn, lib, adapter, new SymbolIndex(surface.symbols));
      let line: string;
      let key: string;
      if (res.overloads.length === 0) [line, key] = [c.dim("(not implemented)"), "not implemented"];
      else if (!adapter.runner) [line, key] = [c.dim(`(no ${adapter.displayName} runner)`), "no runner"];
      else {
        const symbol = bestOverload(fn, res.overloads, adapter).symbol;
        const [r] = await adapter.runner.run(ctx, [{ id: "probe", symbol, args }]);
        line = r.ok ? JSON.stringify(r.value) : r.absent ? `null ${c.dim(`(${r.error})`)}` : `${r.unsupported ? "unsupported" : "error"}: ${r.error}`;
        line = `${line}  ${c.dim(nativeSig(symbol))}`;
        key = r.ok ? answerKey(r) : r.absent ? "null" : r.unsupported ? "unsupported" : "error";
      }
      answers.set(key, [...(answers.get(key) ?? []), lib.name]);
      console.log(`${lib.name.padEnd(28)} ${line}`);
    }
    const distinct = [...answers.keys()].filter((k) => !NO_ANSWER.includes(k));
    console.log(distinct.length <= 1 ? c.green("\nall implementations agree") : c.yellow(`\n${distinct.length} different answers`));
  });

program
  .command("diff")
  .description("Differential testing: feed the same mined inputs to every lib and report where answers diverge")
  .option("-f, --fn <glob>", "contract functions to test, e.g. 'cpf.*' (default: all)")
  .option("-l, --lib <names...>", "only these libs")
  .option("--reference <lib>", "lib used to generate inputs and break ties", REFERENCE_LIB)
  .option("--propose", "write majority answers as test proposals to contract/_proposals/<domain>.json (kebab-case)")
  .option("--unanimous", "with --propose: only inputs where every lib that answered agrees")
  .option("--min-libs <n>", "with --propose: minimum number of agreeing libs", "3")
  .option("--apply", "with --propose: append the proposals straight into contract/<domain>/contract.json")
  .option("--show-agreement", "also list inputs where every lib agrees")
  .option("--network", "include functions that call remote services")
  .option("--baseline", "record how libs split today as known divergences (baselines/_divergences.json)")
  .option("--fail-on-new", "exit 1 when libs split in a way the divergence baseline does not know (new bug or regression)")
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const fns = [...contract.functions.values()].filter((f) => (!opts.fn || globMatch(opts.fn, f.id)) && (opts.network || !f.network));
    if ((opts.baseline || opts.failOnNew) && opts.lib) throw new Error("--baseline/--fail-on-new compare splits across all libs: do not pass --lib");
    const reference = referenceName(opts.reference);
    const libs: DiffLib[] = [];
    for (const lib of selectLibs(loadLibConfigs(LIBS_DIR), opts.lib)) {
      const { adapter, ctx } = workspaceFor(lib);
      if (!adapter.runner) {
        console.log(c.dim(`skipping ${lib.name}: no ${adapter.displayName} runner`));
        continue;
      }
      libs.push({ name: lib.name, adapter, ctx, surface: await extractSurface(adapter, ctx) });
    }
    process.stderr.write(c.dim(`running ${fns.length} functions across ${libs.length} libs…\n`));
    const rows = await differential(contract, fns, libs, reference);
    const md: string[] = ["# Differential test report", "", "| Function | Input | Answers |", "|---|---|---|"];
    const byFn = new Map<string, typeof rows>();
    for (const r of rows) byFn.set(r.fn, [...(byFn.get(r.fn) ?? []), r]);
    let divergent = 0;
    const proposals = new Map<string, Record<string, Array<Record<string, unknown>>>>();
    for (const [fnId, fnRows] of byFn) {
      const bad = fnRows.filter((r) => !r.agree);
      divergent += bad.length;
      const shown = opts.showAgreement ? fnRows : bad;
      if (shown.length) console.log(`\n${c.bold(fnId)} ${c.dim(`${bad.length}/${fnRows.length} inputs diverge`)}`);
      for (const r of shown) {
        const answers = r.answers.map((a) => `${a.answer === "<error>" ? c.red(`error`) : a.answer} ${c.dim(`← ${a.libs.map(shortName).join(", ")}`)}`);
        console.log(`  ${JSON.stringify(r.args)}${r.agree ? c.green(" ✓") : ""}\n    ${answers.join("\n    ")}`);
        if (!r.agree) md.push(`| \`${fnId}\` | \`${JSON.stringify(r.args)}\` | ${r.answers.map((a) => `\`${a.answer.replaceAll("|", "\\|")}\` ← ${a.libs.map(shortName).join(", ")}`).join("<br>")} |`);
      }
      if (opts.propose) {
        const fn = contract.functions.get(fnId)!;
        for (const r of fnRows) {
          const p = proposal(r, reference, fn, { unanimous: opts.unanimous, minLibs: Number(opts.minLibs) });
          if (!p) continue;
          const domain = proposals.get(fn.domain) ?? {};
          (domain[fn.operation] ??= []).push(p);
          proposals.set(fn.domain, domain);
        }
      }
    }
    const divFile = path.join(BASELINES_DIR, "_divergences.json");
    const known: DivergenceBaseline = fs.existsSync(divFile) ? readJson(divFile) : {};
    const dd = diffDivergences(rows, known, fns.map((f) => f.id));
    if (dd.fresh.length || dd.gone.length) md.push("", "## Compared with the divergence baseline", "");
    for (const { row, split } of dd.fresh) md.push(`- 🆕 \`${row.fn}\` splits **${split}** (e.g. \`${JSON.stringify(row.args)}\`)`);
    for (const g of dd.gone) md.push(`- ✅ \`${g.fn}\` no longer splits ${g.split} on this run's inputs`);
    writeFile(path.join(OUTPUT_DIR, "diff.md"), md.join("\n"));
    // Structured copy for the site (only divergent inputs, with their split).
    writeFile(
      path.join(OUTPUT_DIR, "diff.json"),
      JSON.stringify({ compared: rows.length, fresh: dd.fresh.map((f) => ({ fn: f.row.fn, split: f.split })), rows: rows.filter((r) => !r.agree).map((r) => ({ ...r, split: partition(r) })) })
    );
    if (opts.baseline) {
      const merged = { ...Object.fromEntries(Object.entries(known).filter(([fn]) => !fns.some((f) => f.id === fn))), ...divergenceBaseline(rows) };
      writeFile(divFile, json(Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)))));
      console.log(c.cyan(`divergence baseline: ${Object.values(merged).flat().length} known splits in ${path.relative(process.cwd(), divFile)}`));
    } else {
      for (const { row, split } of dd.fresh) console.log(c.red(`new divergence: ${row.fn} splits ${split} (e.g. ${JSON.stringify(row.args)})`));
      for (const g of dd.gone) console.log(c.green(`gone: ${g.fn} no longer splits ${g.split} — run \`diff --baseline\` to lock it in`));
      if (opts.failOnNew && dd.fresh.length) process.exitCode = 1;
    }
    console.log(`\n${divergent ? c.yellow(`${divergent} divergent inputs`) : c.green("no divergence")} across ${rows.length} compared calls. Report: ${path.relative(process.cwd(), path.join(OUTPUT_DIR, "diff.md"))}`);
    if (opts.apply) {
      for (const [domain, ops] of proposals) {
        const n = appendTests(contractFile(CONTRACT_DIR, domain), ops);
        console.log(c.cyan(`${path.relative(PACKAGE_ROOT, contractFile(CONTRACT_DIR, domain))}: +${n} tests`));
      }
      formatDir(CONTRACT_DIR, "contract");
      return;
    }
    for (const [domain, ops] of proposals) {
      const file = path.join(CONTRACT_DIR, "_proposals", `${slugOf(domain)}.json`);
      writeFile(
        file,
        formatJson({
          $comment: `Test proposals mined by api-validator diff (majority answer, ties -> ${reference}). Review each one, move the good ones into contract/${slugOf(domain)}/contract.json under the function's tests, delete this file.`,
          functions: Object.fromEntries(Object.entries(ops).map(([op, tests]) => [op, { tests }]))
        })
      );
      console.log(c.cyan(`proposals: ${path.relative(process.cwd(), file)}`));
    }
  });

program
  .command("suggest")
  .description("Propose lib-config bindings (JSON) for public symbols of a lib that the contract does not cover")
  .requiredOption("-l, --lib <name>", "lib")
  .option("-p, --path <dir>", "lib checkout to use")
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const { report } = await analyzeOne(contract, { ...opts, lib: [opts.lib] });
    const bindings = proposeBindings(report.unmapped);
    const bound = new Set(Object.values(bindings));
    const orphans = report.unmapped.filter((u) => u.suggestions.length === 0);
    const unsure = report.unmapped.filter((u) => u.suggestions.length > 0 && !bound.has(u.symbol));
    if (bound.size) {
      console.log(`Probably existing contract functions under another name -> "bindings" in libs/${report.library}.json:`);
      console.log(formatJson({ bindings }));
    }
    if (unsure.length) {
      console.log("Ambiguous (tied or competing suggestions): check by hand:");
      for (const u of unsure) console.log(`  ${u.symbol} -> ${u.suggestions.map((x) => `${x.id} (${Math.round(x.score * 100)}%)`).join(", ")}`);
    }
    if (orphans.length) {
      console.log("Not in the contract -> propose in contract/<domain>/contract.json, or add to \"ignore\":");
      for (const u of orphans) console.log(`  ${u.symbol}${u.location ? `  (${u.location.file}:${u.location.line})` : ""}`);
    }
  });

program.parseAsync().catch((e: Error) => {
  console.error(c.red(e.message));
  process.exitCode = 2;
});
