import fs from "node:fs";
import path from "node:path";
import { T } from "../../core/ctype.js";
import { snake } from "../../core/naming.js";
import { LANGUAGES_DIR } from "../../core/paths.js";
import { parseJsonOutput, runOrThrow } from "../../core/shell.js";
import { runJsonProcess } from "../shared/process-runner.js";
import { listOf, makeTypeMapper, nullableOf, unionOf } from "../shared/typemap.js";
import type { AdapterContext, Extraction, LanguageAdapter } from "../types.js";

/** Interpreter: lib option `python` (e.g. a venv path) > $DOC_PYTHON > python3. */
function interpreter(ctx: AdapterContext): string {
  const opt = ctx.lib.options.python;
  if (typeof opt === "string") return path.resolve(ctx.root, opt);
  return process.env.DOC_PYTHON ?? "python3";
}

/** Pinned versions of the extraction tooling, installed into the work dir (never into the lib's env). */
const TOOLS = ["griffe==2.3.0", "griffe-warnings-deprecated==1.1.1"];

function toolDeps(ctx: AdapterContext, py: string): string {
  const dir = path.join(ctx.workDir, "..", ".python-tools", TOOLS.join("_").replace(/[^\w.=-]/g, ""));
  if (!fs.existsSync(path.join(dir, "griffe"))) {
    fs.mkdirSync(dir, { recursive: true });
    runOrThrow(py, ["-m", "pip", "install", "--quiet", "--disable-pip-version-check", "--target", dir, ...TOOLS]);
  }
  return dir;
}

const mapPy = makeTypeMapper({
  names: {
    str: T.string,
    int: T.integer,
    float: T.number,
    complex: T.number,
    Decimal: T.number,
    bool: T.boolean,
    None: T.null,
    NoneType: T.null,
    Any: T.any,
    object: T.any,
    date: T.date,
    datetime: T.date,
    Optional: nullableOf,
    Union: unionOf,
    list: listOf,
    List: listOf,
    Sequence: listOf,
    Iterable: listOf,
    Iterator: listOf,
    Generator: listOf,
    set: listOf,
    Set: listOf,
    frozenset: listOf,
    tuple: listOf,
    Tuple: listOf,
    dict: T.object(),
    Dict: T.object(),
    Mapping: T.object(),
    Literal: (args, map) => (args.length ? args.map(map).reduce((a, b) => T.union(a, b)) : T.unknown)
  }
});

export const python: LanguageAdapter = {
  id: "python",
  aliases: ["py"],
  displayName: "Python",
  candidates: (fn) => [
    snake(fn.flatName), // facade: brutils.is_valid_cpf
    `${snake(fn.domain)}.${snake(fn.operation)}`, // module: brutils.cpf.is_valid
    `${snake(fn.domain)}.${snake(fn.flatName)}` // module, suffixed: brutils.cpf.format_cpf
  ],
  async extract(ctx): Promise<Extraction> {
    const py = interpreter(ctx);
    const env = { ...process.env, PYTHONPATH: [toolDeps(ctx, py), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) };
    const out = runOrThrow(py, [path.join(LANGUAGES_DIR, "python", "extract.py"), ctx.root, ctx.lib.entry], { env });
    return parseJsonOutput<Extraction>(out, "python extractor");
  },
  mapType: (native) => mapPy(native),
  tools: [
    { bin: "python3", purpose: "extraction (griffe) and shared tests", install: "https://www.python.org/downloads/" },
  ],
  runner: {
    requires: ["python3"],
    async run(ctx, calls) {
      return runJsonProcess(
        interpreter(ctx),
        [path.join(LANGUAGES_DIR, "python", "runner.py"), ctx.root, ctx.lib.entry],
        calls.map((c) => ({ id: c.id, symbol: c.symbol.name, args: c.args })),
        { cwd: ctx.root }
      );
    }
  }
};
