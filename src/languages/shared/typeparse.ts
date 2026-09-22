/**
 * A permissive parser for type expressions of many languages, producing a small tree that
 * each adapter maps to canonical types. Handles:
 *   generics      Foo<A, B>   Foo[A, B]   (TS/Rust/C# and Python)
 *   arrays        T[]  []T  [T]            (TS, Go, Erlang list)
 *   pointers/refs *T  &T  &mut T  &'a T    (Go, Rust)
 *   unions        A | B                    (TS, Python, Erlang)
 *   tuples        (A, B)  {A, B}           (Rust/Go results, Erlang)
 *   literals      "x"  'x'  42  true  ok   (TS literals, Erlang atoms)
 *   calls         binary()  mod:type()     (Erlang)
 *   binaries      <<_:88>>                 (Erlang)
 *   objects       { a: string }            (TS object literal -> "object")
 * Anything it does not understand becomes { kind: "raw" } which adapters map to unknown.
 */

export type TypeNode =
  | { kind: "name"; name: string; args: TypeNode[]; call?: boolean }
  | { kind: "list"; of: TypeNode }
  | { kind: "ref"; of: TypeNode; op: string }
  | { kind: "union"; of: TypeNode[] }
  | { kind: "tuple"; of: TypeNode[] }
  | { kind: "lit"; value: string | number | boolean }
  | { kind: "object" }
  | { kind: "function" }
  | { kind: "raw"; text: string };

type Tok = { t: string; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (src.startsWith("<<", i)) {
      let depth = 0;
      let j = i;
      while (j < src.length) {
        if (src.startsWith("<<", j)) {
          depth++;
          j += 2;
        } else if (src.startsWith(">>", j)) {
          depth--;
          j += 2;
          if (depth === 0) break;
        } else j++;
      }
      out.push({ t: "binary", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (src.startsWith("=>", i) || src.startsWith("->", i)) {
      out.push({ t: "arrow", v: src.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if (src.startsWith("::", i)) {
      out.push({ t: "sep", v: "::" });
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      // Rust lifetimes: 'a (no closing quote before a non-word char)
      if (c === "'" && /^'[a-z_]\w*(?!')/.test(src.slice(i)) && !/^'[^']*'/.test(src.slice(i))) {
        const m = /^'[a-z_]\w*/.exec(src.slice(i))!;
        i += m[0].length;
        continue;
      }
      const end = src.indexOf(c, i + 1);
      const j = end < 0 ? src.length : end;
      out.push({ t: "str", v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (num && (out.length === 0 || !["ident"].includes(out[out.length - 1].t))) {
      out.push({ t: "num", v: num[0] });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
    if (id) {
      out.push({ t: "ident", v: id[0] });
      i += id[0].length;
      continue;
    }
    out.push({ t: c, v: c });
    i++;
  }
  return out;
}

export function parseNativeType(src: string): TypeNode {
  const toks = tokenize(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const is = (t: string, o = 0) => peek(o)?.t === t;
  const raw = (): TypeNode => ({ kind: "raw", text: src });

  function skipBalanced(open: string, close: string) {
    let depth = 0;
    while (p < toks.length) {
      if (is(open)) depth++;
      else if (is(close)) {
        depth--;
        if (depth === 0) {
          p++;
          return;
        }
      }
      p++;
    }
  }

  function union(): TypeNode {
    const parts: TypeNode[] = [];
    if (is("|")) p++; // leading pipe (TS)
    parts.push(postfix());
    while (is("|") || is("&")) {
      // TS intersections are treated as the first member (approximation).
      const isIntersection = is("&");
      p++;
      const next = postfix();
      if (!isIntersection) parts.push(next);
    }
    if (is("arrow")) {
      // function type: (a) => b / fn(a) -> b
      p++;
      union();
      return { kind: "function" };
    }
    return parts.length === 1 ? parts[0] : { kind: "union", of: parts };
  }

  function list(close: string): TypeNode[] {
    const items: TypeNode[] = [];
    while (p < toks.length && !is(close)) {
      items.push(union());
      if (is(",") || is(";")) p++;
      else break;
    }
    if (is(close)) p++;
    return items;
  }

  function postfix(): TypeNode {
    let node = prefix();
    for (;;) {
      if (is("[") && is("]", 1)) {
        p += 2;
        node = { kind: "list", of: node };
      } else if (is("?") && !is(":", 1)) {
        p++;
        node = { kind: "union", of: [node, { kind: "name", name: "null", args: [] }] };
      } else return node;
    }
  }

  function prefix(): TypeNode {
    if (is("ident") && ["readonly", "const", "dyn", "impl", "unique", "keyof", "typeof"].includes(peek().v)) {
      const word = peek().v;
      p++;
      if (word === "keyof") {
        prefix();
        return { kind: "name", name: "string", args: [] };
      }
      if (word === "typeof") {
        prefix();
        return raw();
      }
      return prefix();
    }
    if (is("*") || is("&")) {
      const op = peek().v;
      p++;
      if (is("ident") && peek().v === "mut") p++;
      return { kind: "ref", op, of: prefix() };
    }
    if (is("[") && is("]", 1)) {
      p += 2;
      return { kind: "list", of: prefix() };
    }
    if (is("[") && is("num", 1) && is("]", 2)) {
      p += 3;
      return { kind: "list", of: prefix() };
    }
    if (is(".") && is(".", 1) && is(".", 2)) {
      p += 3;
      return { kind: "list", of: prefix() };
    }
    return atom();
  }

  function atom(): TypeNode {
    const tok = peek();
    if (!tok) return raw();
    if (tok.t === "(") {
      p++;
      const items = list(")");
      if (is("arrow")) {
        p++;
        union();
        return { kind: "function" };
      }
      return items.length === 1 ? items[0] : { kind: "tuple", of: items };
    }
    if (tok.t === "[") {
      // Erlang list [T] / Python [A, B] (Callable args) / TS tuple [A, B]
      p++;
      const items = list("]");
      return items.length === 1 ? { kind: "list", of: items[0] } : { kind: "tuple", of: items };
    }
    if (tok.t === "{") {
      // Erlang tuple {ok, T} or TS object literal { a: string }
      const save = p;
      p++;
      if ((is("ident") || is("str")) && (is(":", 1) || (is("?", 1) && is(":", 2)))) {
        p = save;
        skipBalanced("{", "}");
        return { kind: "object" };
      }
      if (is("}")) {
        p++;
        return { kind: "object" };
      }
      return { kind: "tuple", of: list("}") };
    }
    if (tok.t === "str") {
      p++;
      return { kind: "lit", value: tok.v };
    }
    if (tok.t === "num") {
      p++;
      return { kind: "lit", value: Number(tok.v) };
    }
    if (tok.t === "binary") {
      p++;
      return { kind: "name", name: "binary", args: [], call: true };
    }
    if (tok.t === "ident") {
      let name = tok.v;
      p++;
      // qualified names: a.b, a::b, mod:type
      while ((is(".") || is("sep") || is(":")) && is("ident", 1) && !(is(":") && is("ident", 1) && is(":", 2))) {
        name += is(".") ? "." : is("sep") ? "::" : ":";
        p++;
        name += peek().v;
        p++;
      }
      let args: TypeNode[] = [];
      let call = false;
      if (is("<")) {
        p++;
        args = list(">");
      } else if (is("[") && !is("]", 1)) {
        p++;
        args = list("]");
      } else if (is("(")) {
        // Erlang type call: binary(), list(T), mod:t()
        p++;
        call = true;
        args = list(")");
      }
      if (name === "true" || name === "false") return { kind: "lit", value: name === "true" };
      return call ? { kind: "name", name, args, call } : { kind: "name", name, args };
    }
    p++;
    return raw();
  }

  try {
    const node = union();
    return p < toks.length ? { kind: "raw", text: src } : node;
  } catch {
    return raw();
  }
}
