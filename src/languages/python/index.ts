import path from "node:path";
import { T } from "../../core/ctype.js";
import type { NativeSymbol } from "../../core/model.js";
import { snake } from "../../core/naming.js";
import { LANGUAGES_DIR } from "../../core/paths.js";
import { parseJsonOutput, runOrThrow } from "../../core/shell.js";
import { runJsonProcess } from "../shared/process-runner.js";
import { listOf, makeTypeMapper, nullableOf, unionOf } from "../shared/typemap.js";
import type { AdapterContext, Extraction, LanguageAdapter } from "../types.js";

/** Interpreter: lib option `python` (e.g. a venv path) > $API_VALIDATOR_PYTHON > python3. */
function interpreter(ctx: AdapterContext): string {
  const opt = ctx.lib.options.python;
  if (typeof opt === "string") return path.resolve(ctx.root, opt);
  return process.env.API_VALIDATOR_PYTHON ?? "python3";
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
    const out = runOrThrow(interpreter(ctx), [path.join(LANGUAGES_DIR, "python", "extract.py"), ctx.root, ctx.lib.entry]);
    return parseJsonOutput<Extraction>(out, "python extractor");
  },
  mapType: (native: string | undefined, _pos, _s: NativeSymbol) => mapPy(native),
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
