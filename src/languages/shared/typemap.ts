import { T, union, type CType } from "../../core/ctype.js";
import { parseNativeType, type TypeNode } from "./typeparse.js";

type Rule = CType | ((args: TypeNode[], map: (n: TypeNode) => CType) => CType);

export interface TypeTable {
  /** Name (as written, last path segment also tried) -> canonical type or builder. */
  names: Record<string, Rule>;
  /** Called for names not in the table. Default: named object when capitalized, else unknown. */
  fallback?: (node: Extract<TypeNode, { kind: "name" }>) => CType;
  /** How tuples map (Go multi-returns, Erlang {ok, T}). Default: unknown. */
  tuple?: (items: TypeNode[], map: (n: TypeNode) => CType) => CType;
  /** How pointers/references map. Default: transparent. */
  ref?: (op: string, of: CType) => CType;
  /** Map string/number literals (e.g. Erlang atoms are names, not literals). */
  literal?: boolean;
}

export function makeTypeMapper(table: TypeTable) {
  const map = (node: TypeNode): CType => {
    switch (node.kind) {
      case "raw":
        return T.unknown;
      case "function":
        return T.unknown;
      case "object":
        return T.object();
      case "lit":
        return table.literal === false ? T.unknown : T.literal(node.value);
      case "list":
        return T.list(map(node.of));
      case "ref":
        return table.ref ? table.ref(node.op, map(node.of)) : map(node.of);
      case "union":
        return union(node.of.map(map));
      case "tuple":
        return table.tuple ? table.tuple(node.of, map) : T.unknown;
      case "name": {
        const short = node.name.split(/::|\.|:/).pop()!;
        const rule = table.names[node.name] ?? table.names[short];
        if (rule === undefined) {
          if (table.fallback) return table.fallback(node);
          return /^[A-Z]/.test(short) ? T.object(short) : T.unknown;
        }
        return typeof rule === "function" ? rule(node.args, map) : rule;
      }
    }
  };
  return (text: string | undefined): CType => (text ? map(parseNativeType(text)) : T.unknown);
}

/** Builder for generic containers whose first argument is the element: `Vec<T>` -> T[]. */
export const listOf: Rule = (args, map) => (args[0] ? T.list(map(args[0])) : T.list(T.unknown));
/** `Option<T>` / `Optional[T]` -> T? */
export const nullableOf: Rule = (args, map) => (args[0] ? T.nullable(map(args[0])) : T.unknown);
/** `Promise<T>` / `Result<T, E>` -> T (async-ness and error channel are idioms, not contract). */
export const firstArg: Rule = (args, map) => (args[0] ? map(args[0]) : T.unknown);
/** `Union[A, B]` */
export const unionOf: Rule = (args, map) => union(args.map(map));
