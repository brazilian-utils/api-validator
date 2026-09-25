/**
 * Erlang adapter. The lib is compiled with `erlc +debug_info` into the work dir and the API is
 * read from the compiled modules (tool.escript): exports as the runtime reports them, `-spec`
 * types, `-type` aliases (local `cpf()` and remote `brutils_cpf:cpf()` resolved) and
 * deprecations from the abstract code (beam_lib, as documented by OTP). `{ok, T} | {error, _}` maps to `T?`:
 * the error tuple is the idiomatic "no result", like Python's None or Rust's None.
 */
import { T, type CType } from "../../core/ctype.js";
import { snake } from "../../core/naming.js";
import { makeTypeMapper } from "../shared/typemap.js";
import type { TypeNode } from "../../core/model.js";
import type { AdapterContext, Extraction, LanguageAdapter } from "../types.js";
import { extractFromBeams, runErlang, typeDefs } from "./runner.js";
import { which } from "../../core/shell.js";

const CLEAN = { line: ["%"], strings: ['"'], chars: false };

async function extract(ctx: AdapterContext): Promise<Extraction> {
  if (!which("erlc") || !which("escript")) throw new Error("the Erlang adapter needs erlc and escript (Erlang/OTP) on PATH to compile the lib");
  const modules = extractFromBeams(ctx);
  for (const m of modules) typeDefs.set(m.module, new Map(Object.entries(m.types)));
  return { symbols: modules.flatMap((m) => m.symbols), warnings: [] };
}

const isAtom = (n: TypeNode, atom: string) => n.kind === "name" && n.name === atom && !n.call;

function mapErlang(native: TypeNode | undefined, module: string): CType {
  const depth = { n: 0 };
  const mapper = makeTypeMapper({
    names: {
      binary: T.string,
      bitstring: T.string,
      string: T.string,
      nonempty_string: T.string,
      unicode_binary: T.string,
      iodata: T.string,
      iolist: T.string,
      "unicode:chardata": T.string,
      char: T.string,
      boolean: T.boolean,
      integer: T.integer,
      non_neg_integer: T.integer,
      pos_integer: T.integer,
      neg_integer: T.integer,
      number: T.number,
      float: T.number,
      term: T.any,
      any: T.any,
      atom: T.string,
      undefined: T.null,
      nil: T.null,
      ok: T.void,
      list: (args, map) => T.list(args[0] ? map(args[0]) : T.unknown),
      nonempty_list: (args, map) => T.list(args[0] ? map(args[0]) : T.unknown),
      map: T.object(),
      "calendar:date": T.date,
      "calendar:datetime": T.date
    },
    fallback(node) {
      const [mod, name] = node.name.includes(":") ? node.name.split(":") : [module, node.name];
      if (!node.call) return T.literal(node.name); // bare atom, e.g. mobile | landline
      const def = typeDefs.get(mod)?.get(name);
      if (def && depth.n < 8) {
        depth.n++;
        const t = mapErlang(def, mod);
        depth.n--;
        return t;
      }
      return T.unknown;
    },
    tuple(items, map) {
      if (items.length >= 1 && isAtom(items[0], "ok")) return items.length === 2 ? map(items[1]) : T.void;
      if (items.length >= 1 && isAtom(items[0], "error")) return T.null;
      return T.unknown;
    },
    literal: true
  });
  return mapper(native);
}

export const erlang: LanguageAdapter = {
  id: "erlang",
  aliases: ["erl"],
  displayName: "Erlang",
  candidates(fn, lib) {
    const app = typeof lib.options.app === "string" ? lib.options.app : "brutils";
    return [
      `${app}.${snake(fn.flatName)}`, // facade: brutils:is_valid_cpf
      `${app}_${snake(fn.domain)}.${snake(fn.operation)}`, // brutils_cpf:is_valid
      `${app}_${snake(fn.domain)}.${snake(fn.flatName)}`
    ];
  },
  extract,
  mapType(native, _position, symbol) {
    return mapErlang(native, (symbol.meta?.module as string | undefined) ?? "");
  },
  tools: [
    {
      bin: "erl",
      version: ["-noshell", "-eval", 'io:format("OTP ~s~n", [erlang:system_info(otp_release)]), halt().'],
      purpose: "runtime",
      install: "https://www.erlang.org/downloads (or erlef/setup-beam in CI)"
    },
    { bin: "erlc", version: null, purpose: "extraction (beam_lib) and shared tests", install: "ships with Erlang/OTP" },
    { bin: "escript", version: null, purpose: "extraction and shared tests", install: "ships with Erlang/OTP" },
    { bin: "rebar3", version: ["version"], purpose: "running the lib's harness (rebar3 eunit)", install: "https://rebar3.org", optional: true }
  ],
  runner: { requires: ["erlc", "escript"], run: runErlang }
};

