import fs from "node:fs";
import path from "node:path";
import { T } from "../../core/ctype.js";
import type { ContractFunction, LibConfig } from "../../core/model.js";
import { pascal, snake } from "../../core/naming.js";
import { LANGUAGES_DIR } from "../../core/paths.js";
import { parseJsonOutput, runOrThrow } from "../../core/shell.js";
import { runJsonProcess } from "../shared/process-runner.js";
import { listOf, makeTypeMapper } from "../shared/typemap.js";
import type { AdapterContext, Extraction, LanguageAdapter } from "../types.js";

const env = { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" };

/** Pinned YARD, installed into the tool cache (never into the lib's bundle). */
const YARD_VERSION = "0.9.37";

function yardDir(ctx: AdapterContext): string {
  const dir = path.join(ctx.workDir, "..", ".ruby-tools", `yard-${YARD_VERSION}`);
  if (!fs.existsSync(path.join(dir, "gems"))) {
    fs.mkdirSync(dir, { recursive: true });
    runOrThrow("gem", ["install", "yard", "-v", YARD_VERSION, "--install-dir", dir, "--no-document", "--quiet"], { env });
  }
  return dir;
}

function args(ctx: AdapterContext): string[] {
  const ns = ctx.lib.options.namespace;
  return [ctx.root, ctx.lib.entry, ...(typeof ns === "string" ? [ns] : [])];
}

/** Types come from YARD tags (`@param cpf [String]`, `@return [String, nil]`). */
const mapRuby = makeTypeMapper({
  names: {
    String: T.string,
    Symbol: T.string,
    Integer: T.integer,
    Float: T.number,
    Numeric: T.number,
    BigDecimal: T.number,
    Boolean: T.boolean,
    TrueClass: T.boolean,
    FalseClass: T.boolean,
    true: T.boolean,
    false: T.boolean,
    nil: T.null,
    NilClass: T.null,
    Object: T.any,
    Array: listOf,
    Set: listOf,
    Hash: T.object(),
    Date: T.date,
    DateTime: T.date,
    Time: T.date
  },
  literal: false
});

function candidates(fn: ContractFunction, _lib: LibConfig): string[] {
  const modules = [`${pascal(fn.domain)}Utils`, pascal(fn.domain)];
  const op = snake(fn.operation);
  const methods = [op, snake(fn.flatName)];
  // Ruby predicate idiom: isValid -> valid?
  if (op.startsWith("is_")) methods.unshift(`${op.slice(3)}?`, `${snake(fn.flatName).slice(3)}?`);
  return [...modules.flatMap((m) => methods.map((x) => `${m}.${x}`)), snake(fn.flatName)];
}

export const ruby: LanguageAdapter = {
  id: "ruby",
  aliases: ["rb"],
  displayName: "Ruby",
  candidates,
  async extract(ctx): Promise<Extraction> {
    const out = runOrThrow("ruby", [path.join(LANGUAGES_DIR, "ruby", "extract.rb"), ...args(ctx)], {
      cwd: ctx.root,
      env: { ...env, DOCS_YARD: yardDir(ctx) }
    });
    return parseJsonOutput<Extraction>(out, "ruby extractor");
  },
  mapType: (native) => mapRuby(native),
  tools: [
    { bin: "ruby", purpose: "extraction (reflection + YARD) and shared tests", install: "https://www.ruby-lang.org/en/documentation/installation/" },
    { bin: "bundle", purpose: "running the lib's harness (rspec)", install: "gem install bundler", optional: true }
  ],
  runner: {
    requires: ["ruby"],
    async run(ctx, calls) {
      return runJsonProcess(
        "ruby",
        [path.join(LANGUAGES_DIR, "ruby", "runner.rb"), ...args(ctx)],
        calls.map((c) => ({ id: c.id, symbol: c.symbol.name, args: c.args })),
        { cwd: ctx.root, env }
      );
    }
  }
};
