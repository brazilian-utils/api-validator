#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command, Option } from "commander";
import YAML from "yaml";
import { analyzeLib, extractSurface } from "./core/analyze.js";
import { baselineFrom, diffBaseline, loadBaseline, writeBaseline, type BaselineDiff } from "./core/baseline.js";
import { loadContract } from "./core/contract.js";
import { formatContractDir } from "./core/format-contract.js";
import { loadLibConfigs, validateLibAgainstContract } from "./core/libs.js";
import { differential, proposal, type DiffLib } from "./core/differential.js";
import { SymbolIndex, resolve } from "./core/match.js";
import type { ApiSurface, Contract, LibConfig, LibReport } from "./core/model.js";
import { globMatch } from "./core/naming.js";
import { BASELINES_DIR, CONTRACT_DIR, LIBS_DIR, OUTPUT_DIR, SNAPSHOTS_DIR } from "./core/paths.js";
import { bestOverload, nativeSig } from "./core/signature.js";
import { syncRepo, workspaceFor } from "./core/workspace.js";
import { c, consoleSummary } from "./reporters/console.js";
import { writeDashboard } from "./reporters/html.js";
import { badge } from "./reporters/badge.js";
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

function writeFile(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
}

/** Append tests to functions of a contract file, keeping its formatting and comments. */
function appendTests(file: string, ops: Record<string, Array<Record<string, unknown>>>): number {
  const doc = YAML.parseDocument(fs.readFileSync(file, "utf8"));
  let added = 0;
  for (const [op, tests] of Object.entries(ops)) {
    const fnNode = doc.getIn(["functions", op]) as YAML.YAMLMap | undefined;
    if (!fnNode) continue;
    let list = fnNode.get("tests") as YAML.YAMLSeq | undefined;
    if (!list) {
      list = doc.createNode([]) as YAML.YAMLSeq;
      fnNode.set("tests", list);
    }
    for (const t of tests) {
      const node = doc.createNode(t) as YAML.YAMLMap;
      (node.get("args", true) as unknown as YAML.YAMLSeq).flow = true;
      list.add(node);
      added++;
    }
  }
  fs.writeFileSync(file, doc.toString({ lineWidth: 140 }));
  return added;
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
  .command("lint")
  .description("Validate the contract and every lib config (fast, no checkout needed)")
  .action(() => {
    const contract = loadContract(CONTRACT_DIR);
    const libs = loadLibConfigs(LIBS_DIR);
    let errors = 0;
    for (const lib of libs) {
      for (const i of validateLibAgainstContract(lib, contract)) {
        console.log(`${i.severity}: ${i.message}`);
        if (i.severity === "error") errors++;
      }
    }
    const tests = [...contract.functions.values()].reduce((n, f) => n + f.tests.length, 0);
    console.log(`contract: ${contract.domains.size} domains, ${contract.functions.size} functions, ${tests} tests; ${libs.length} libs`);
    if (errors) process.exitCode = 1;
  });

program
  .command("fmt")
  .description("Format contract files canonically (key order, quoted test strings)")
  .option("--check", "only report files that are not formatted (for CI)")
  .action((opts) => {
    if (opts.check) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "api-validator-fmt-"));
      fs.cpSync(CONTRACT_DIR, tmp, { recursive: true });
      const changed = formatContractDir(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
      for (const f of changed) console.log(`not formatted: contract/${f}`);
      if (changed.length) process.exitCode = 1;
      return;
    }
    for (const f of formatContractDir(CONTRACT_DIR)) console.log(`formatted contract/${f}`);
    loadContract(CONTRACT_DIR);
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
    for (const { report } of results) {
      const diff = diffBaseline(report, loadBaseline(BASELINES_DIR, report.library));
      console.log(consoleSummary(report, diff, opts.verbose || results.length === 1));
      writeFile(path.join(OUTPUT_DIR, `${report.library}.report.json`), JSON.stringify({ ...report, baseline: diff }, null, 2));
      const md = libMarkdown(report, contract, diff);
      writeFile(path.join(OUTPUT_DIR, `${report.library}.md`), md);
      writeFile(path.join(OUTPUT_DIR, "badges", `${report.library.replace("brazilian-utils-", "")}.json`), JSON.stringify(badge(report)));
      markdown.push(md);
      if (shouldFail(opts.failOn as FailOn, report, diff)) failed = true;
    }
    if (results.length > 1) {
      writeDashboard(contract, results.map((r) => r.report), path.join(OUTPUT_DIR, "index.html"));
      writeFile(path.join(OUTPUT_DIR, "README.md"), `# API conformance\n\n${overviewMarkdown(results.map((r) => r.report))}\n\n${markdown.join("\n\n")}`);
      console.log(c.dim(`\nReports: ${path.relative(process.cwd(), OUTPUT_DIR)}/{index.html,README.md,<lib>.md,<lib>.report.json}`));
    } else console.log(c.dim(`\nReport: ${path.relative(process.cwd(), path.join(OUTPUT_DIR, `${results[0].report.library}.md`))}`));
    if (opts.summary) fs.appendFileSync(opts.summary, `${markdown.join("\n\n")}\n`);
    if (failed) process.exitCode = 1;
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
  .command("issue")
  .description("Body of the sync issue for a lib: TODO list plus a porting brief per item (for the sync workflow)")
  .requiredOption("-l, --lib <name>", "lib")
  .option("-p, --path <dir>", "checkout of that lib")
  .option("-t, --tests", "run the shared tests")
  .option("--reference <lib>", "lib whose source is embedded", "brazilian-utils-javascript")
  .option("--max-briefs <n>", "limit briefs (GitHub issues are capped at 65k chars)", "15")
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const { mine, others, adapter } = await allImpls(contract, opts.lib, opts);
    const todo = libMarkdown(mine.report, contract, diffBaseline(mine.report, loadBaseline(BASELINES_DIR, mine.lib.name)));
    const rank = (f: LibReport["functions"][number]) =>
      ({ failing: 0, signature: 1, missing: f.level === "core" ? 2 : 3, ok: 9, waived: 9 })[f.status];
    const work = mine.report.functions.filter((f) => rank(f) < 9).sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
    const parts = [
      "<!-- api-validator:sync-issue -->",
      "This issue is maintained by [api-validator](https://github.com/brazilian-utils/api-validator): it lists what this lib still needs to match the shared contract. It is rewritten on every contract change; close it only when it is empty.",
      "",
      todo,
      "## Porting briefs",
      ""
    ];
    let size = parts.join("\n").length;
    let shown = 0;
    for (const f of work) {
      if (shown >= Number(opts.maxBriefs)) break;
      const b = briefMarkdown(contract.functions.get(f.id)!, mine, adapter, others, opts.reference);
      if (size + b.length > 60_000) break;
      parts.push(b);
      size += b.length;
      shown++;
    }
    if (work.length > shown) parts.push(`_…and ${work.length - shown} more: run \`api-validator brief <function> --lib ${mine.lib.name}\`._`);
    const body = parts.join("\n");
    writeFile(path.join(OUTPUT_DIR, `${mine.lib.name}.issue.md`), body);
    console.log(body);
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
  .option("--propose", "write majority answers as test proposals to contract/_proposals/<domain>.yaml")
  .option("--unanimous", "with --propose: only inputs where every lib that answered agrees")
  .option("--min-libs <n>", "with --propose: minimum number of agreeing libs", "3")
  .option("--apply", "with --propose: append the proposals straight into contract/<domain>.yaml")
  .option("--show-agreement", "also list inputs where every lib agrees")
  .option("--network", "include functions that call remote services")
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const fns = [...contract.functions.values()].filter((f) => (!opts.fn || globMatch(opts.fn, f.id)) && (opts.network || !f.network));
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
    writeFile(path.join(OUTPUT_DIR, "diff.md"), md.join("\n"));
    console.log(`\n${divergent ? c.yellow(`${divergent} divergent inputs`) : c.green("no divergence")} across ${rows.length} compared calls. Report: ${path.relative(process.cwd(), path.join(OUTPUT_DIR, "diff.md"))}`);
    if (opts.apply) {
      for (const [domain, ops] of proposals) {
        const n = appendTests(path.join(CONTRACT_DIR, `${domain}.yaml`), ops);
        formatContractDir(CONTRACT_DIR);
        console.log(c.cyan(`contract/${domain}.yaml: +${n} tests`));
      }
      return;
    }
    for (const [domain, ops] of proposals) {
      const file = path.join(CONTRACT_DIR, "_proposals", `${domain}.yaml`);
      writeFile(file, `# Test proposals mined by \`api-validator diff\` (majority answer, ties -> ${opts.reference}).\n# Review each one, move the good ones into contract/${domain}.yaml under the function's \`tests\`, delete this file.\n${YAML.stringify(ops, { lineWidth: 140 })}`);
      console.log(c.cyan(`proposals: ${path.relative(process.cwd(), file)}`));
    }
  });

program
  .command("suggest")
  .description("Propose contract entries (YAML) for public symbols of a lib that the contract does not cover")
  .requiredOption("-l, --lib <name>", "lib")
  .option("-p, --path <dir>", "lib checkout to use")
  .action(async (opts) => {
    const contract = loadContract(CONTRACT_DIR);
    const [{ report }] = await analyzeMany(contract, { ...opts, lib: [opts.lib] });
    const orphans = report.unmapped.filter((u) => u.suggestions.length === 0);
    const bindable = report.unmapped.filter((u) => u.suggestions.length > 0);
    if (bindable.length) {
      console.log("# Probably existing contract functions under another name -> libs/<lib>.yaml");
      console.log(YAML.stringify({ bindings: Object.fromEntries(bindable.map((u) => [u.suggestions[0].id, u.symbol])) }));
    }
    if (orphans.length) {
      console.log("# Not in the contract -> propose in contract/<domain>.yaml, or add to `ignore`");
      for (const u of orphans) console.log(`#   ${u.symbol}${u.location ? `  (${u.location.file}:${u.location.line})` : ""}`);
    }
  });

program.parseAsync().catch((e: Error) => {
  console.error(c.red(e.message));
  process.exitCode = 2;
});
