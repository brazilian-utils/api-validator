#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command, Option } from "commander";
import { analyzeLib, bindLib, extractSurface } from "./core/analyze.js";
import { json, skipsFor, suiteFiles, type Outcomes } from "./core/cases.js";
import { baselineFrom, diffBaseline, loadBaseline, writeBaseline, type BaselineDiff } from "./core/baseline.js";
import { changelog, changelogMarkdown, contractAt } from "./core/changelog.js";
import { LABEL, closeReason, keyOf, marker, scopeFrom, wantedIssues, type Scope } from "./core/issues.js";
import { loadContract } from "./core/contract.js";
import { formatContractDir, formatDir, schemaFiles } from "./core/format-contract.js";
import { formatJson, orderDomain } from "./core/jsonfmt.js";
import { loadLibConfigs, validateLibAgainstContract } from "./core/libs.js";
import { differential, diffDivergences, partition, divergenceBaseline, proposal, type DiffLib, type DivergenceBaseline } from "./core/differential.js";
import { SymbolIndex, resolve } from "./core/match.js";
import type { ApiSurface, Contract, LibConfig, LibReport } from "./core/model.js";
import { globMatch } from "./core/naming.js";
import { BASELINES_DIR, CONTRACT_DIR, LIBS_DIR, OUTPUT_DIR, PACKAGE_ROOT, REPOS_DIR, SCHEMA_DIR, SNAPSHOTS_DIR } from "./core/paths.js";
import { bestOverload, nativeSig } from "./core/signature.js";
import { run, which } from "./core/shell.js";
import { getAdapter } from "./languages/registry.js";
import type { Tool } from "./languages/types.js";
import { syncRepo, workspaceFor } from "./core/workspace.js";
import { c, consoleSummary } from "./reporters/console.js";
import { siteDataFiles, type SiteDataLib } from "./reporters/sitedata.js";
import { parseUsageDir, scaffoldUsage, shortName, slugOf, summarizeUsage, usageFilesFor, usageStatus } from "./core/usage.js";
import { briefMarkdown, sourceBlock, type ImplRef } from "./reporters/brief.js";
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

function writeFile(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
}

/** Append tests to functions of a contract file (then `fmt` puts it in canonical form). */
function appendTests(file: string, ops: Record<string, Array<Record<string, unknown>>>): number {
  const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { functions: Record<string, { tests?: unknown[] }> };
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
  writeFile(path.join(SNAPSHOTS_DIR, `${surface.library}.api.json`), JSON.stringify(clean, null, 2));
}

interface RunOptions {
  lib?: string[];
  path?: string;
  tests?: boolean;
  only?: string;
  snapshot?: boolean;
}

async function analyzeMany(contract: Contract, opts: RunOptions): Promise<Array<{ report: LibReport; lib: LibConfig; root: string }>> {
  const libs = selectLibs(loadLibConfigs(LIBS_DIR), opts.lib);
  if (opts.path && libs.length !== 1) throw new Error("--path needs exactly one --lib");
  const out: Array<{ report: LibReport; lib: LibConfig; root: string }> = [];
  for (const lib of libs) {
    const ws = workspaceFor(lib, opts.path);
    const ctx = { lib, root: ws.root, workDir: ws.workDir };
    const started = Date.now();
    process.stderr.write(c.dim(`• ${lib.name}: extracting…`));
    const surface = await extractSurface(ws.adapter, ctx);
    for (const w of surface.warnings) process.stderr.write(`\n  ${c.yellow("warning")}: ${w}`);
    if (opts.snapshot) writeSnapshot(surface);
    if (opts.tests) process.stderr.write(c.dim(" running conformance tests…"));
    const filter = opts.only ? (t: { id: string }) => globMatch(opts.only!, t.id.split("#")[0]) || globMatch(opts.only!, t.id) : undefined;
    const report = await analyzeLib({ contract, adapter: ws.adapter, ctx, surface, runTests: !!opts.tests, testFilter: filter });
    process.stderr.write(c.dim(` done in ${((Date.now() - started) / 1000).toFixed(1)}s\n`));
    out.push({ report, lib, root: ws.root });
  }
  return out;
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
      const slug = lib.repo ? new URL(lib.repo).pathname.replace(/^\/|\.git$/g, "") : "";
      console.log(`${lib.name} ${slug}`);
    }
  });

program
  .command("doctor")
  .description("Check the toolchains every configured lib needs (extraction, shared tests)")
  .option("-l, --lib <names...>", "only these libs")
  .action((opts) => {
    const libs = selectLibs(loadLibConfigs(LIBS_DIR), opts.lib);
    const adapters = [...new Map(libs.map((l) => [getAdapter(l.language).id, getAdapter(l.language)])).values()];
    let missing = 0;
    for (const adapter of adapters) {
      const users = libs.filter((l) => getAdapter(l.language).id === adapter.id).map((l) => l.name);
      console.log(`\n${c.bold(adapter.displayName)} ${c.dim(`(${users.join(", ")})`)}`);
      const tools: Tool[] = adapter.tools ?? (adapter.runner?.requires ?? []).map((bin) => ({ bin, purpose: "shared tests", install: "see docs/adding-a-language.md" }));
      for (const t of tools) {
        const found = which(t.bin);
        // Presence decides; the version line is informational (not every tool has a flag for it).
        const v = found && t.version !== null ? run(t.bin, t.version ?? ["--version"], { timeoutMs: 60_000 }) : undefined;
        const ok = found;
        const version = v?.status === 0 ? (v.stdout || v.stderr).trim().split("\n")[0] : "installed";
        if (!ok && !t.optional) missing++;
        const mark = ok ? c.green("✓") : t.optional ? c.yellow("○") : c.red("✗");
        console.log(`  ${mark} ${t.bin.padEnd(8)} ${ok ? c.dim(version) : c.yellow(`missing — ${t.install}`)}  ${c.dim(`[${t.purpose}]`)}`);
      }
      for (const name of users) {
        const lib = libs.find((l) => l.name === name)!;
        const checkout = fs.existsSync(path.join(REPOS_DIR, lib.name));
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
  .description("Format contract/*.json and libs/*.json canonically and regenerate schema/ (editor validation)")
  .option("--check", "only report files that are not formatted or schemas that are stale (for CI)")
  .action((opts) => {
    const dirs: Array<[string, "contract" | "lib", string]> = [
      [CONTRACT_DIR, "contract", "contract"],
      [LIBS_DIR, "lib", "libs"]
    ];
    let bad = 0;
    for (const [dir, kind, label] of dirs) {
      const tmp = opts.check ? fs.mkdtempSync(path.join(os.tmpdir(), "api-validator-fmt-")) : dir;
      if (opts.check) fs.cpSync(dir, tmp, { recursive: true });
      for (const f of formatDir(tmp, kind)) {
        console.log(`${opts.check ? "not formatted" : "formatted"}: ${label}/${f}`);
        bad++;
      }
      if (opts.check) fs.rmSync(tmp, { recursive: true, force: true });
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
      const surface = await extractSurface(ws.adapter, { lib, root: ws.root, workDir: ws.workDir });
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
    const results = await analyzeMany(contract, opts);
    let failed = false;
    const markdown: string[] = [];
    for (const { report, lib, root } of results) {
      const diff = diffBaseline(report, loadBaseline(BASELINES_DIR, report.library));
      console.log(consoleSummary(report, diff, opts.verbose || results.length === 1));
      // Usage examples for the docs site: the lib's own docs/usage/, else the site fixtures.
      const usage = usageStatus(contract, report, usageFilesFor(contract, lib, root, USAGE_FIXTURES));
      writeFile(path.join(OUTPUT_DIR, `${report.library}.report.json`), JSON.stringify({ ...report, baseline: diff, usage }, null, 2));
      const md = libMarkdown(report, contract, diff);
      writeFile(path.join(OUTPUT_DIR, `${report.library}.md`), md);
      markdown.push(md);
      if (shouldFail(opts.failOn as FailOn, report, diff)) failed = true;
    }
    if (results.length > 1) {
      writeFile(path.join(OUTPUT_DIR, "README.md"), `# API conformance\n\n${overviewMarkdown(results.map((r) => r.report))}\n\n${markdown.join("\n\n")}`);
      console.log(c.dim(`\nReports: ${path.relative(process.cwd(), OUTPUT_DIR)}/{README.md,<lib>.md,<lib>.report.json}; docs site data: api-validator site-data`));
    } else console.log(c.dim(`\nReport: ${path.relative(process.cwd(), path.join(OUTPUT_DIR, `${results[0].report.library}.md`))}`));
    if (opts.summary) fs.appendFileSync(opts.summary, `${markdown.join("\n\n")}\n`);
    if (failed) process.exitCode = 1;
  });

program
  .command("usage")
  .description("Usage examples for the docs site: which implemented functions each lib documents, and scaffold the missing sections")
  .option("-l, --lib <names...>", "only these libs")
  .option("-p, --path <dir>", "lib checkout: read and write its own usage files (<site.usage.path>) instead of the site fixtures")
  .option("--scaffold", "append a section for every implemented function without one, from the shared cases the lib passes")
  .option("--strict", "exit non-zero when an implemented function has no usage section or a section has problems")
  .action((opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const libs = selectLibs(loadLibConfigs(LIBS_DIR), opts.lib);
    if (opts.path && libs.length !== 1) throw new Error("--path needs exactly one --lib");
    let bad = false;
    for (const lib of libs) {
      const file = path.join(OUTPUT_DIR, `${lib.name}.report.json`);
      if (!fs.existsSync(file)) {
        console.log(c.yellow(`${lib.name}: no report in ${path.relative(process.cwd(), OUTPUT_DIR)} (run check --tests first), skipped`));
        continue;
      }
      if (!lib.site) continue;
      const report = JSON.parse(fs.readFileSync(file, "utf8")) as LibReport;
      const dir = opts.path ? path.join(opts.path, lib.site.usage.path) : path.join(USAGE_FIXTURES, shortName(lib));
      if (opts.scaffold) {
        const snapshot = path.join(SNAPSHOTS_DIR, `${lib.name}.api.json`);
        const natives = new Map(
          (fs.existsSync(snapshot) ? (JSON.parse(fs.readFileSync(snapshot, "utf8")) as ApiSurface).symbols : []).map((s) => [s.name, { returns: s.returns, params: s.params }])
        );
        const files = scaffoldUsage({ contract, lib, report, natives, existing: parseUsageDir(contract, dir) }, (f) =>
          fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : undefined
        );
        for (const [name, content] of files) writeFile(path.join(dir, name), content);
        console.log(c.dim(`${lib.name}: scaffolded ${files.size} file(s) in ${path.relative(process.cwd(), dir)}`));
      }
      const files = opts.path ? parseUsageDir(contract, dir) : usageFilesFor(contract, lib, path.join(REPOS_DIR, lib.name), USAGE_FIXTURES);
      const usage = usageStatus(contract, report, files);
      const sum = summarizeUsage(report, usage);
      const where = files.dir ? path.relative(process.cwd(), files.dir) : "no usage files";
      console.log(`${c.bold(lib.name)}: ${sum.documented}/${sum.implemented} implemented functions documented, ${sum.problems} problem(s) (${where})`);
      const missing = report.functions.filter((f) => ["ok", "failing", "signature"].includes(f.status) && !usage[f.id]?.documented).map((f) => f.id);
      if (missing.length) console.log(c.dim(`  undocumented: ${missing.join(", ")}`));
      for (const [fn, u] of Object.entries(usage)) for (const p of u.problems) console.log(`  ${c.yellow("problem")} ${fn}: ${p}`);
      for (const w of files.warnings) console.log(`  ${c.yellow("warning")} ${w}`);
      if (sum.problems || files.warnings.length || missing.length) bad = true;
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
  .option("-o, --out <dir>", "the Starlight site root", path.join(PACKAGE_ROOT, "site"))
  .action((opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const libs: SiteDataLib[] = [];
    for (const lib of loadLibConfigs(LIBS_DIR)) {
      const file = path.join(OUTPUT_DIR, `${lib.name}.report.json`);
      if (!fs.existsSync(file)) {
        console.error(c.yellow(`${lib.name}: no report in ${path.relative(process.cwd(), OUTPUT_DIR)} (run check --tests first), shown without status`));
        continue;
      }
      const report = JSON.parse(fs.readFileSync(file, "utf8")) as LibReport;
      // Recomputed rather than read from the report, so edits to the usage fixtures show up.
      const usage = usageStatus(contract, report, usageFilesFor(contract, lib, path.join(REPOS_DIR, lib.name), USAGE_FIXTURES));
      libs.push({ lib, report, usage });
    }
    const diffFile = path.join(OUTPUT_DIR, "diff.json");
    const files = siteDataFiles({
      contract,
      libs,
      diff: fs.existsSync(diffFile) ? JSON.parse(fs.readFileSync(diffFile, "utf8")) : undefined,
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
    const libs = selectLibs(loadLibConfigs(LIBS_DIR), opts.lib);
    if (opts.path && libs.length !== 1) throw new Error("--path needs exactly one --lib");
    let stale = 0;
    for (const lib of libs) {
      const ws = workspaceFor(lib, opts.path);
      const ctx = { lib, root: ws.root, workDir: ws.workDir };
      const { bound } = bindLib(contract, ws.adapter, lib, await extractSurface(ws.adapter, ctx));
      const implemented = new Set(bound.map((b) => b.fn.id));
      const dir = typeof lib.options.casesDir === "string" ? lib.options.casesDir : "api-contract";
      const files = suiteFiles(contract);
      const reportFile = path.join(OUTPUT_DIR, `${lib.name}.report.json`);
      const outcomes: Outcomes | undefined = fs.existsSync(reportFile)
        ? new Map((JSON.parse(fs.readFileSync(reportFile, "utf8")) as LibReport).functions.flatMap((f) => f.tests.map((t) => [t.id, t] as const)))
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
    for (const { report } of await analyzeMany(contract, { ...opts, snapshot: true })) {
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
    const [{ report }] = await analyzeMany(contract, { ...opts, lib: [opts.lib] });
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
      const [r] = await analyzeMany(contract, { lib: [lib.name], path: explicit, tests: opts.tests && lib.name === targetLib.name });
      refs.push(r);
    } catch (e) {
      if (lib.name === targetLib.name) throw e; // other checkouts are optional context
    }
  }
  const mine = refs.find((r) => r.lib.name === targetLib.name)!;
  return { mine, others: refs.filter((r) => r !== mine), adapter: workspaceFor(mine.lib, mine.root).adapter };
}

program
  .command("brief")
  .description("Porting brief for one contract function in one lib: idiomatic name, tests, reference source, links")
  .argument("<function>", "contract function id or glob, e.g. cpf.isValid or 'pis.*'")
  .requiredOption("-l, --lib <name>", "lib that should implement it")
  .option("-p, --path <dir>", "checkout of that lib")
  .option("--reference <lib>", "lib whose source is embedded", "brazilian-utils-javascript")
  .option("--no-tests", "skip running the shared tests on the target lib")
  .action(async (pattern: string, opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const fns = [...contract.functions.values()].filter((f) => globMatch(pattern, f.id));
    if (!fns.length) throw new Error(`No contract function matches ${pattern}`);
    const { mine, others, adapter } = await allImpls(contract, opts.lib, opts);
    for (const fn of fns) console.log(briefMarkdown(fn, mine, adapter, others, opts.reference));
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
    const scope: Scope = opts.since
      ? scopeFrom(changelog(contractAt(path.dirname(CONTRACT_DIR), CONTRACT_DIR, opts.since), contract))
      : { added: new Set(), cases: new Set() };
    if (opts.since) console.log(c.dim(`since ${opts.since}: ${scope.added.size} new functions, ${scope.cases.size} new or changed cases`));
    // Reports from the last `check --tests` (the pipeline runs it right before).
    const refs: ImplRef[] = [];
    for (const lib of loadLibConfigs(LIBS_DIR)) {
      const file = path.join(OUTPUT_DIR, `${lib.name}.report.json`);
      if (fs.existsSync(file)) refs.push({ lib, report: JSON.parse(fs.readFileSync(file, "utf8")) as LibReport, root: path.join(REPOS_DIR, lib.name) });
    }
    const site = process.env.SITE_URL?.replace(/\/$/, "");
    for (const lib of selectLibs(loadLibConfigs(LIBS_DIR), opts.lib)) {
      const mine = refs.find((r) => r.lib.name === lib.name);
      if (!mine) {
        console.log(c.yellow(`${lib.name}: no report in ${path.relative(process.cwd(), OUTPUT_DIR)} (run check --tests first), skipped`));
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
          site ? `Spec, every implementation and results: ${site}/utils/${slugOf(fnId.split(".")[0])}/ · this lib: ${site}/libs/${shortName(lib)}/` : "",
          "",
          briefMarkdown(contract.functions.get(fnId)!, mine, adapter, others, opts.reference),
          "Add the function to the harness registry; its cases then run with this repo's own tests. This issue closes automatically once the api-validator run sees it done.",
          "",
          kind === "implement" && lib.site
            ? `Then document it for the docs site: a \`## ${contract.functions.get(fnId)!.operation}\` section in \`${lib.site.usage.path}/${slugOf(fnId.split(".")[0])}.md\` with a short example (\`api-validator usage --lib ${shortName(lib)} --path . --scaffold\` writes one from the cases the lib passes). Format: ${site ? `${site}/contributing/usage-files/` : "https://github.com/brazilian-utils/api-validator/blob/main/site/src/content/docs/contributing/usage-files.mdx"}`
            : "",
          "",
          "_Maintained by [api-validator](https://github.com/brazilian-utils/api-validator): opened, refreshed and closed automatically._"
        ].join("\n");
      const wanted = wantedIssues(contract, mine.report, scope, opts.backfill);
      const slug = lib.repo ? new URL(lib.repo).pathname.replace(/^\/|\.git$/g, "") : undefined;
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
      for (const i of open) {
        const reason = closeReason(i.key, contract, mine.report);
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
    const args = rawArgs.map((a) => {
      try {
        return JSON.parse(a);
      } catch {
        return a; // bare strings are fine: probe cpf.format 82178537464
      }
    });
    const answers = new Map<string, string[]>();
    for (const lib of selectLibs(loadLibConfigs(LIBS_DIR), opts.lib)) {
      const ws = workspaceFor(lib);
      const ctx = { lib, root: ws.root, workDir: ws.workDir };
      const surface = await extractSurface(ws.adapter, ctx);
      const res = resolve(fn, lib, ws.adapter, new SymbolIndex(surface.symbols));
      let line: string;
      if (res.overloads.length === 0) line = c.dim("(not implemented)");
      else if (!ws.adapter.runner) line = c.dim(`(no ${ws.adapter.displayName} runner)`);
      else {
        const symbol = bestOverload(fn, res.overloads, ws.adapter).symbol;
        const [r] = await ws.adapter.runner.run(ctx, [{ id: "probe", symbol, args }]);
        line = r.ok ? JSON.stringify(r.value) : r.absent ? `null ${c.dim(`(${r.error})`)}` : `${r.unsupported ? "unsupported" : "error"}: ${r.error}`;
        line = `${line}  ${c.dim(nativeSig(symbol))}`;
      }
      const key = line.split("  ")[0];
      answers.set(key, [...(answers.get(key) ?? []), lib.name]);
      console.log(`${lib.name.padEnd(28)} ${line}`);
    }
    const distinct = [...answers.keys()].filter((k) => !k.includes("not implemented") && !k.includes("runner)"));
    console.log(distinct.length <= 1 ? c.green("\nall implementations agree") : c.yellow(`\n${distinct.length} different answers`));
  });

program
  .command("diff")
  .description("Differential testing: feed the same mined inputs to every lib and report where answers diverge")
  .option("-f, --fn <glob>", "contract functions to test, e.g. 'cpf.*' (default: all)")
  .option("-l, --lib <names...>", "only these libs")
  .option("--reference <lib>", "lib used to generate inputs and break ties", "brazilian-utils-javascript")
  .option("--propose", "write majority answers as test proposals to contract/_proposals/<domain>.json")
  .option("--unanimous", "with --propose: only inputs where every lib that answered agrees")
  .option("--min-libs <n>", "with --propose: minimum number of agreeing libs", "3")
  .option("--apply", "with --propose: append the proposals straight into contract/<domain>.json")
  .option("--show-agreement", "also list inputs where every lib agrees")
  .option("--network", "include functions that call remote services")
  .option("--baseline", "record how libs split today as known divergences (baselines/_divergences.json)")
  .option("--fail-on-new", "exit 1 when libs split in a way the divergence baseline does not know (new bug or regression)")
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const fns = [...contract.functions.values()].filter((f) => (!opts.fn || globMatch(opts.fn, f.id)) && (opts.network || !f.network));
    if ((opts.baseline || opts.failOnNew) && opts.lib) throw new Error("--baseline/--fail-on-new compare splits across all libs: do not pass --lib");
    const libs: DiffLib[] = [];
    for (const lib of selectLibs(loadLibConfigs(LIBS_DIR), opts.lib)) {
      const ws = workspaceFor(lib);
      if (!ws.adapter.runner) {
        console.log(c.dim(`skipping ${lib.name}: no ${ws.adapter.displayName} runner`));
        continue;
      }
      const ctx = { lib, root: ws.root, workDir: ws.workDir };
      libs.push({ name: lib.name, adapter: ws.adapter, ctx, surface: await extractSurface(ws.adapter, ctx) });
    }
    process.stderr.write(c.dim(`running ${fns.length} functions across ${libs.length} libs…\n`));
    const rows = await differential(contract, fns, libs, opts.reference);
    const short = (n: string) => n.replace("brazilian-utils-", "");
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
        const answers = r.answers.map((a) => `${a.answer === "<error>" ? c.red(`error`) : a.answer} ${c.dim(`← ${a.libs.map(short).join(", ")}`)}`);
        console.log(`  ${JSON.stringify(r.args)}${r.agree ? c.green(" ✓") : ""}\n    ${answers.join("\n    ")}`);
        if (!r.agree) md.push(`| \`${fnId}\` | \`${JSON.stringify(r.args)}\` | ${r.answers.map((a) => `\`${a.answer.replaceAll("|", "\\|")}\` ← ${a.libs.map(short).join(", ")}`).join("<br>")} |`);
      }
      if (opts.propose) {
        const fn = contract.functions.get(fnId)!;
        for (const r of fnRows) {
          const p = proposal(r, opts.reference, fn, { unanimous: opts.unanimous, minLibs: Number(opts.minLibs) });
          if (!p) continue;
          const domain = proposals.get(fn.domain) ?? {};
          (domain[fn.operation] ??= []).push(p);
          proposals.set(fn.domain, domain);
        }
      }
    }
    const divFile = path.join(BASELINES_DIR, "_divergences.json");
    const known: DivergenceBaseline = fs.existsSync(divFile) ? JSON.parse(fs.readFileSync(divFile, "utf8")) : {};
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
      writeFile(divFile, JSON.stringify(Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))), null, 2));
      console.log(c.cyan(`divergence baseline: ${Object.values(merged).flat().length} known splits in ${path.relative(process.cwd(), divFile)}`));
    } else {
      for (const { row, split } of dd.fresh) console.log(c.red(`new divergence: ${row.fn} splits ${split} (e.g. ${JSON.stringify(row.args)})`));
      for (const g of dd.gone) console.log(c.green(`gone: ${g.fn} no longer splits ${g.split} — run \`diff --baseline\` to lock it in`));
      if (opts.failOnNew && dd.fresh.length) process.exitCode = 1;
    }
    console.log(`\n${divergent ? c.yellow(`${divergent} divergent inputs`) : c.green("no divergence")} across ${rows.length} compared calls. Report: ${path.relative(process.cwd(), path.join(OUTPUT_DIR, "diff.md"))}`);
    if (opts.apply) {
      for (const [domain, ops] of proposals) {
        const n = appendTests(path.join(CONTRACT_DIR, `${domain}.json`), ops);
        formatContractDir(CONTRACT_DIR);
        console.log(c.cyan(`contract/${domain}.json: +${n} tests`));
      }
      return;
    }
    for (const [domain, ops] of proposals) {
      const file = path.join(CONTRACT_DIR, "_proposals", `${domain}.json`);
      writeFile(
        file,
        formatJson({
          $comment: `Test proposals mined by api-validator diff (majority answer, ties -> ${opts.reference}). Review each one, move the good ones into contract/${domain}.json under the function's tests, delete this file.`,
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
    const [{ report }] = await analyzeMany(contract, { ...opts, lib: [opts.lib] });
    const orphans = report.unmapped.filter((u) => u.suggestions.length === 0);
    const bindable = report.unmapped.filter((u) => u.suggestions.length > 0);
    if (bindable.length) {
      console.log(`Probably existing contract functions under another name -> "bindings" in libs/${report.library}.json:`);
      console.log(formatJson({ bindings: Object.fromEntries(bindable.map((u) => [u.suggestions[0].id, u.symbol])) }));
    }
    if (orphans.length) {
      console.log("Not in the contract -> propose in contract/<domain>.json, or add to \"ignore\":");
      for (const u of orphans) console.log(`  ${u.symbol}${u.location ? `  (${u.location.file}:${u.location.line})` : ""}`);
    }
  });

program.parseAsync().catch((e: Error) => {
  console.error(c.red(e.message));
  process.exitCode = 2;
});
