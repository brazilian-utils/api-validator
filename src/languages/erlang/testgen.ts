/**
 * Contract tests as an EUnit module (`test/<app>_api_contract_tests.erl`, next to the lib's
 * own `*_tests.erl`), run by `rebar3 eunit`.
 *
 * Calls mirror tool.escript's `run`: arguments are the runner's terms (strings are UTF-8
 * binaries), `{ok, V}` is V, `{error, _}` is "no result" (it passes `returns: null` and
 * `throws`), an exception is an error. Expected values are written as the term the spec'd
 * return type pins (`<<"..."/utf8>>` for binary(), `mercosul` for an atom type, `true` for
 * boolean()); when the spec does not pin one (term(), maps, floats, lists, unknown types) the
 * result is compared through the api-validator's JSON view (canon/1 + same/2), so the file
 * passes exactly when `check --tests` does.
 *
 * EUnit has no skip: a skipped case is a test generator returning an empty, titled group
 * (`{"SKIPPED: reason", []}`), which runs no test and prints the reason in verbose mode; the
 * assertion it would run is kept as a comment.
 */
import path from "node:path";
import type { ExportCase, ExportGroup, Rendered, Unexpressible } from "../../core/testgen.js";
import type { NativeSymbol, TypeNode } from "../../core/model.js";
import { snake } from "../../core/naming.js";
import type { AdapterContext, TestGenerator } from "../types.js";
import { callTarget, erlangTerm, typeDefs } from "./runner.js";

const RESERVED = new Set(
  "after and andalso band begin bnot bor bsl bsr bxor case catch cond div else end fun if let maybe not of or orelse receive rem try when xor".split(" ")
);

/** An atom as source: bare when it can be, quoted otherwise. */
export function erlangAtom(name: string): string {
  if (/^[a-z][A-Za-z0-9_@]*$/.test(name) && !RESERVED.has(name)) return name;
  return `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** A charlist literal (for EUnit titles). */
function erlangString(s: string): string {
  return `"${[...s].map((c) => (c === "\\" ? "\\\\" : c === '"' ? '\\"' : c.charCodeAt(0) < 32 ? " " : c)).join("")}"`;
}

// ---------------------------------------------------------------------------
// What a spec'd return type pins
// ---------------------------------------------------------------------------

/** Leaf kinds a return type resolves to; `wrap` when it has `{ok, _}` / `{error, _}` tuples. */
interface Kinds {
  leaves: string[];
  wrap: boolean;
}

const INTEGER = new Set(["integer", "non_neg_integer", "pos_integer", "neg_integer", "byte", "char", "arity"]);
const isAtomNode = (n: TypeNode, atom: string) => n.kind === "name" && n.name === atom && !n.call;

/** Leaves: `binary`, `boolean`, `integer`, `atom`, `atom:<name>`, `other`. */
export function returnKinds(node: TypeNode | undefined, module: string): Kinds {
  const out: Kinds = { leaves: [], wrap: false };
  const walk = (n: TypeNode | undefined, mod: string, depth: number, top: boolean): void => {
    if (!n || depth > 8) return void out.leaves.push("other");
    switch (n.kind) {
      case "union":
        return n.of.forEach((m) => walk(m, mod, depth + 1, top));
      case "tuple":
        if (top && n.of.length === 2 && isAtomNode(n.of[0], "ok")) {
          out.wrap = true;
          return walk(n.of[1], mod, depth + 1, false);
        }
        if (top && n.of.length >= 1 && isAtomNode(n.of[0], "error")) return void (out.wrap = true);
        return void out.leaves.push("other");
      case "lit":
        return void out.leaves.push(typeof n.value === "boolean" ? "boolean" : typeof n.value === "number" && Number.isInteger(n.value) ? "integer" : "other");
      case "name": {
        if (!n.call) return void out.leaves.push(n.name === "true" || n.name === "false" ? "boolean" : `atom:${n.name}`);
        if (n.name === "binary" || n.name === "bitstring") return void out.leaves.push("binary");
        if (n.name === "boolean") return void out.leaves.push("boolean");
        if (INTEGER.has(n.name)) return void out.leaves.push("integer");
        if (n.name === "atom") return void out.leaves.push("atom");
        const [m, t] = n.name.includes(":") ? n.name.split(":") : [mod, n.name];
        const def = typeDefs.get(m)?.get(t);
        if (def && !n.args?.length) return walk(def, m, depth + 1, top);
        return void out.leaves.push("other");
      }
      default:
        return void out.leaves.push("other");
    }
  };
  walk(node, module, 0, true);
  return out;
}

const only = (k: Kinds, ok: (leaf: string) => boolean) => k.leaves.length > 0 && k.leaves.every(ok);

/** The expected value as the term the spec pins, or undefined when it does not pin one. */
function typedExpected(value: unknown, k: Kinds): string | undefined {
  if (typeof value === "boolean") return only(k, (l) => l === "boolean") ? String(value) : undefined;
  if (typeof value === "number") return Number.isInteger(value) && only(k, (l) => l === "integer") ? erlangTerm(value) : undefined;
  if (typeof value !== "string") return undefined;
  if (only(k, (l) => l === "binary")) return erlangTerm(value);
  if (only(k, (l) => l.startsWith("atom")) && (k.leaves.includes("atom") || k.leaves.includes(`atom:${value}`))) return erlangAtom(value);
  return undefined;
}

// ---------------------------------------------------------------------------
// Helpers emitted into the module (only the ones used, so it compiles with warnings_as_errors)
// ---------------------------------------------------------------------------

const HELPERS: Record<string, { deps: string[]; code: string[] }> = {
  value: {
    deps: [],
    code: [
      "%% A call's result as the contract reads it: {ok, V} is V, {error, _} is no result.",
      "value({error, _} = Error) -> erlang:error({no_result, Error});",
      "value({ok, Value}) -> Value;",
      "value(Value) -> Value."
    ]
  },
  no_result: {
    deps: ["value"],
    code: [
      "%% `returns: null`: {error, _}, or undefined/null/nil.",
      "no_result({error, _}) -> true;",
      "no_result(Result) -> lists:member(value(Result), [undefined, null, nil])."
    ]
  },
  attempt: {
    deps: [],
    code: [
      "%% `throws`: the call raises, or returns {error, _}.",
      "attempt(Fun) ->",
      "    try Fun() of",
      "        {error, _} = Error -> {failed, Error};",
      "        Result -> {returned, Result}",
      "    catch",
      "        Class:Reason -> {failed, {Class, Reason}}",
      "    end."
    ]
  },
  text: {
    deps: [],
    code: [
      "%% `matches`: the result as text (an atom reads as its name).",
      "text(Value) when is_binary(Value) -> Value;",
      "text(Value) when is_atom(Value), not is_boolean(Value), Value =/= undefined, Value =/= null, Value =/= nil ->",
      "    atom_to_binary(Value, utf8)."
    ]
  },
  canon: {
    deps: [],
    code: [
      "%% A result as the api-validator reads it (its JSON view): atoms are text, tuples are",
      "%% lists, undefined/null/nil are undefined.",
      "canon(Value) when is_boolean(Value); is_number(Value); is_binary(Value) -> Value;",
      "canon(Value) when Value =:= undefined; Value =:= null; Value =:= nil -> undefined;",
      "canon(Value) when is_atom(Value) -> atom_to_binary(Value, utf8);",
      "canon(Value) when is_tuple(Value) -> canon(tuple_to_list(Value));",
      "canon(Value) when is_list(Value) -> [canon(X) || X <- Value];",
      "canon(Value) when is_map(Value) -> maps:from_list([{canon_key(K), canon(V)} || {K, V} <- maps:to_list(Value)]);",
      'canon(Value) -> iolist_to_binary(io_lib:format("~0p", [Value])).',
      "",
      "canon_key(Key) when is_binary(Key) -> Key;",
      "canon_key(Key) when is_atom(Key) -> atom_to_binary(Key, utf8);",
      'canon_key(Key) -> iolist_to_binary(io_lib:format("~0p", [Key])).'
    ]
  },
  same: {
    deps: [],
    code: [
      "%% Deep equality as the api-validator checks it: numbers within 1e-9, object keys compared",
      "%% case/separator-insensitively, an undefined field the same as a missing one.",
      "same(undefined, Actual) -> Actual =:= undefined;",
      "same(Expected, Actual) when is_number(Expected), is_number(Actual) ->",
      "    abs(Expected - Actual) =< 1.0e-9 * max(1, abs(Expected));",
      "same(Expected, Actual) when is_list(Expected), is_list(Actual), length(Expected) =:= length(Actual) ->",
      "    lists:all(fun({E, A}) -> same(E, A) end, lists:zip(Expected, Actual));",
      "same(Expected, Actual) when is_map(Expected), is_map(Actual) ->",
      "    {E, A} = {flat_keys(Expected), flat_keys(Actual)},",
      "    lists:all(fun(K) -> same(maps:get(K, E, undefined), maps:get(K, A, undefined)) end,",
      "              lists:usort(maps:keys(E) ++ maps:keys(A)));",
      "same(Expected, Actual) -> Expected =:= Actual.",
      "",
      "flat_keys(Map) ->",
      '    maps:from_list([{string:lowercase(re:replace(K, "[^A-Za-z0-9]", "", [global, {return, binary}])), V}',
      "                    || {K, V} <- maps:to_list(Map)])."
    ]
  }
};

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

/** `mod:fun(Args)`, with the runner's module/function resolution and argument terms. */
function callOf(symbol: NativeSymbol, args: string[]): string {
  const [mod, fun] = callTarget(symbol);
  return `${erlangAtom(mod)}:${erlangAtom(fun)}(${args.join(", ")})`;
}

const kindsOf = (s: NativeSymbol) => returnKinds(s.returnsNode, String(s.meta?.module ?? s.name.split(".")[0]));

/** JS regex (as the validator runs it, no flags) -> PCRE source, or a reason it has no equivalent. */
export function pcrePattern(pattern: string): { source: string } | { reason: string } {
  if (/\[\^?\]/.test(pattern)) return { reason: `pattern /${pattern}/ uses a JavaScript-only empty class ([] / [^])` };
  if (/\\[uxpP]\{/.test(pattern)) return { reason: `pattern /${pattern}/ uses \\u{..}/\\p{..}, which mean something else in a JavaScript regex without the u flag` };
  return { source: pattern.replace(/\\u([0-9A-Fa-f]{4})/g, "\\x{$1}") };
}

/** The assertion lines of a case, with the helpers they use; or why it cannot be written. */
export function caseBody(c: ExportCase): { lines: string[]; helpers: string[] } | { reason: string } {
  const arity = c.symbol.meta?.arity;
  if (typeof arity === "number" && arity !== c.args.length) {
    return { reason: `${c.symbol.name}/${arity} called with ${c.args.length} argument(s) (the runner reports it unsupported)` };
  }
  const helpers: string[] = [];
  const use = (h: string) => (helpers.includes(h) || helpers.push(h), h);
  const k = kindsOf(c.symbol);
  const call = callOf(c.symbol, c.args.map(erlangTerm));
  const result = k.wrap || k.leaves.length === 0 || k.leaves.includes("other") ? `${use("value")}(${call})` : call;
  const e = c.expect;
  switch (e.kind) {
    case "returns": {
      if (e.value === null || e.value === undefined) return { lines: [`?assert(${use("no_result")}(${call}))`], helpers };
      const typed = typedExpected(e.value, k);
      if (typed === "true") return { lines: [`?assert(${result})`], helpers };
      if (typed === "false") return { lines: [`?assertNot(${result})`], helpers };
      if (typed !== undefined) return { lines: [`?assertEqual(${typed}, ${result})`], helpers };
      return { lines: [`?assert(${use("same")}(${erlangTerm(e.value)}, ${use("canon")}(${use("value")}(${call}))))`], helpers };
    }
    case "throws":
      return { lines: [`?assertMatch({failed, _}, ${use("attempt")}(fun() -> ${call} end))`], helpers };
    case "matches": {
      const re = pcrePattern(e.pattern);
      if ("reason" in re) return re;
      const subject = only(k, (l) => l === "binary") ? result : `${use("text")}(${use("value")}(${call}))`;
      return { lines: [`?assertMatch({match, _}, re:run(${subject}, ${erlangTerm(re.source)}, [unicode, dollar_endonly]))`], helpers };
    }
    case "satisfies": {
      const target = c.target!;
      const arg = only(k, (l) => l === "binary") ? "Value" : `${use("canon")}(Value)`;
      const tk = kindsOf(target);
      const check = callOf(target, [arg]);
      const verdict = !tk.wrap && only(tk, (l) => l === "boolean") ? check : `${use("value")}(${check})`;
      return { lines: [`Value = ${result},`, `?assert(${verdict})`], helpers };
    }
  }
}

function moduleName(ctx: AdapterContext): string {
  const rel = typeof ctx.lib.options.testFile === "string" ? ctx.lib.options.testFile : erlangTestgen.path(ctx);
  return path.basename(rel, ".erl");
}

function render(ctx: AdapterContext, groups: ExportGroup[], header: string[]): Rendered {
  const unexpressible: Unexpressible[] = [];
  const used = new Set<string>();
  const names = new Set<string>();
  const tests: string[] = [];
  const rule = "%%--------------------------------------------------------------------";
  for (const g of groups) {
    const [mod, fun] = callTarget(g.symbol);
    tests.push("", rule, `%% ${g.fnId} -> ${mod}:${fun}/${g.symbol.params.length}`, rule);
    for (const c of g.cases) {
      const body = caseBody(c);
      tests.push("");
      if ("reason" in body) {
        unexpressible.push({ id: c.id, reason: body.reason });
        tests.push(`%% ${c.id}: not expressible in Erlang: ${body.reason}`);
        continue;
      }
      let name = `${snake(c.fnId)}_${c.slug.join("_")}`;
      for (let i = 2; names.has(name); i++) name = `${snake(c.fnId)}_${c.slug.join("_")}_${i}`;
      names.add(name);
      if (c.note) tests.push(`%% ${c.note.replace(/\s+/g, " ").trim()}`);
      if (c.skip) {
        tests.push(`${name}_test_() ->`, `    %% ${c.id}`, ...body.lines.map((l) => `    %% ${l}`), `    {${erlangString(`SKIPPED: ${c.skip}`)}, []}.`);
        continue;
      }
      for (const h of body.helpers) used.add(h);
      tests.push(`${name}_test() ->`, `    %% ${c.id}`);
      const lines = body.lines;
      if (c.repeat > 1) {
        tests.push("    lists:foreach(", "      fun(_) ->", ...lines.map((l) => `              ${l}`), "      end,", `      lists:seq(1, ${c.repeat})).`);
      } else {
        tests.push(...lines.map((l, i) => `    ${l}${i === lines.length - 1 ? "." : ""}`));
      }
    }
  }
  // Helpers in a fixed order, with their dependencies.
  for (const h of [...used]) for (const d of HELPERS[h].deps) used.add(d);
  const helpers = Object.keys(HELPERS).filter((h) => used.has(h));
  const out: string[] = [
    ...header.map((h) => `%% ${h}`.trimEnd()),
    `-module(${erlangAtom(moduleName(ctx))}).`,
    "",
    '-include_lib("eunit/include/eunit.hrl").',
    ...tests
  ];
  if (helpers.length) {
    out.push("", rule, "%% Helpers: the api-validator's reading of a result", rule);
    for (const h of helpers) out.push("", ...HELPERS[h].code);
  }
  return { content: out.join("\n") + "\n", unexpressible };
}

const app = (ctx: AdapterContext) => (typeof ctx.lib.options.app === "string" ? ctx.lib.options.app : "brutils");

export const erlangTestgen: TestGenerator = {
  framework: "EUnit",
  path: (ctx) => `test/${app(ctx)}_api_contract_tests.erl`,
  command: (ctx) => `rebar3 eunit --module=${moduleName(ctx)}`,
  render
};
