/**
 * Canonical (language-agnostic) type system.
 *
 * Contract syntax:
 *   string | integer | number | boolean | date | void | any | null
 *   T?            nullable (T | null)
 *   T[]           list
 *   A | B         union
 *   "a" | 1       literals
 *   Name          named object type (opaque: only "is an object" is checked)
 *   (T)           grouping
 *
 * Language adapters translate native types (structured, from each language's tooling) into
 * CType via `mapType`;
 * anything they cannot translate becomes `unknown`, which is never reported as a mismatch
 * (it is reported as "unverified" instead). That keeps the checker honest: it only
 * complains about what it can actually prove.
 */

export type CType =
  | { k: "unknown" }
  | { k: "any" }
  | { k: "void" }
  | { k: "null" }
  | { k: "string" }
  | { k: "integer" }
  | { k: "number" }
  | { k: "boolean" }
  | { k: "date" }
  | { k: "literal"; value: string | number | boolean }
  | { k: "list"; of: CType }
  | { k: "object"; name?: string }
  | { k: "union"; of: CType[] };

export const T = {
  unknown: { k: "unknown" } as CType,
  any: { k: "any" } as CType,
  void: { k: "void" } as CType,
  null: { k: "null" } as CType,
  string: { k: "string" } as CType,
  integer: { k: "integer" } as CType,
  number: { k: "number" } as CType,
  boolean: { k: "boolean" } as CType,
  date: { k: "date" } as CType,
  list: (of: CType): CType => ({ k: "list", of }),
  object: (name?: string): CType => ({ k: "object", name }),
  literal: (value: string | number | boolean): CType => ({ k: "literal", value }),
  union: (...of: CType[]): CType => union(of),
  nullable: (t: CType): CType => union([t, { k: "null" }])
};

export function union(types: CType[]): CType {
  const flat: CType[] = [];
  for (const t of types) {
    if (t.k === "union") flat.push(...t.of);
    else flat.push(t);
  }
  const seen = new Set<string>();
  const out = flat.filter((t) => {
    const key = format(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (out.some((t) => t.k === "unknown")) return T.unknown;
  if (out.length === 1) return out[0];
  return { k: "union", of: out };
}

// ---------------------------------------------------------------------------
// Parsing canonical syntax
// ---------------------------------------------------------------------------

const PRIMITIVES = new Set(["string", "integer", "number", "boolean", "date", "void", "any", "null", "unknown"]);

export function parseCType(src: string): CType {
  let i = 0;
  const s = src.trim();
  const ws = () => {
    while (s[i] === " ") i++;
  };

  function parseUnion(): CType {
    const parts = [parsePostfix()];
    ws();
    while (s[i] === "|") {
      i++;
      parts.push(parsePostfix());
      ws();
    }
    return union(parts);
  }

  function parsePostfix(): CType {
    let t = parseAtom();
    for (;;) {
      ws();
      if (s.startsWith("[]", i)) {
        i += 2;
        t = T.list(t);
      } else if (s[i] === "?") {
        i++;
        t = T.nullable(t);
      } else return t;
    }
  }

  function parseAtom(): CType {
    ws();
    const ch = s[i];
    if (ch === "(") {
      i++;
      const t = parseUnion();
      ws();
      if (s[i] !== ")") throw new Error(`Expected ')' at ${i} in type "${src}"`);
      i++;
      return t;
    }
    if (ch === '"' || ch === "'") {
      const end = s.indexOf(ch, i + 1);
      if (end < 0) throw new Error(`Unterminated string literal in type "${src}"`);
      const value = s.slice(i + 1, end);
      i = end + 1;
      return T.literal(value);
    }
    const m = /^(-?\d+(?:\.\d+)?|[A-Za-z_][\w.]*)/.exec(s.slice(i));
    if (!m) throw new Error(`Unexpected '${ch ?? "end"}' at ${i} in type "${src}"`);
    i += m[0].length;
    const word = m[0];
    if (/^-?\d/.test(word)) return T.literal(Number(word));
    if (word === "true" || word === "false") return T.literal(word === "true");
    if (PRIMITIVES.has(word)) return { k: word } as CType;
    return T.object(word);
  }

  const t = parseUnion();
  ws();
  if (i !== s.length) throw new Error(`Unexpected '${s.slice(i)}' in type "${src}"`);
  return t;
}

export function format(t: CType): string {
  switch (t.k) {
    case "literal":
      return typeof t.value === "string" ? JSON.stringify(t.value) : String(t.value);
    case "list": {
      const inner = format(t.of);
      return t.of.k === "union" ? `(${inner})[]` : `${inner}[]`;
    }
    case "object":
      return t.name ?? "object";
    case "union": {
      const nonNull = t.of.filter((x) => x.k !== "null");
      if (nonNull.length === t.of.length - 1 && nonNull.length === 1) {
        const inner = format(nonNull[0]);
        return nonNull[0].k === "union" ? `(${inner})?` : `${inner}?`;
      }
      return t.of.map(format).join(" | ");
    }
    default:
      return t.k;
  }
}

// ---------------------------------------------------------------------------
// Compatibility
// ---------------------------------------------------------------------------

function atoms(t: CType): CType[] {
  return t.k === "union" ? t.of : [t];
}

export function isNullable(t: CType): boolean {
  return atoms(t).some((a) => a.k === "null");
}

export function isUnknown(t: CType): boolean {
  return t.k === "unknown" || (t.k === "list" && isUnknown(t.of));
}

/** Does `wide` accept every value of `narrow`? (null excluded — handled separately). */
function covers(wide: CType, narrow: CType): boolean {
  if (wide.k === "any" || wide.k === "unknown" || narrow.k === "unknown") return true;
  // Top-level nulls are handled by the callers; a null nested in a list must be covered.
  if (narrow.k === "union") return narrow.of.every((n) => covers(wide, n));
  if (wide.k === "union") return wide.of.some((w) => covers(w, narrow));
  switch (wide.k) {
    case "number":
      return (
        narrow.k === "number" ||
        narrow.k === "integer" ||
        (narrow.k === "literal" && typeof narrow.value === "number")
      );
    case "integer":
      return narrow.k === "integer" || (narrow.k === "literal" && Number.isInteger(narrow.value));
    case "string":
      return narrow.k === "string" || (narrow.k === "literal" && typeof narrow.value === "string");
    case "boolean":
      return narrow.k === "boolean" || (narrow.k === "literal" && typeof narrow.value === "boolean");
    case "literal":
      return narrow.k === "literal" && narrow.value === wide.value;
    case "list":
      return narrow.k === "list" && covers(wide.of, narrow.of);
    case "object":
      return narrow.k === "object";
    default:
      return wide.k === narrow.k;
  }
}

export interface Compat {
  /** "ok" | "unverified" (unknown on either side) | "warning" | "error" */
  level: "ok" | "unverified" | "warning" | "error";
  reason?: string;
}

function widen(a: CType): CType {
  if (a.k !== "literal") return a;
  return typeof a.value === "string" ? T.string : typeof a.value === "number" ? T.number : T.boolean;
}

const nonNull = (t: CType): CType => union(atoms(t).filter((a) => a.k !== "null"));

/**
 * Parameter check: the native parameter must accept what the contract says callers may pass.
 */
export function checkParam(contract: CType, native: CType): Compat {
  if (isUnknown(native) || isUnknown(contract)) return { level: "unverified" };
  const c = nonNull(contract);
  const n = nonNull(native);
  const cAtoms = atoms(c);
  const uncovered = cAtoms.filter((a) => !covers(n, a));
  // A lib taking only some values of a kind (`"SP" | "RJ"` where the contract says `string`)
  // is narrower, not incompatible.
  const widened = union(atoms(n).map(widen));
  const incompatible = uncovered.filter((a) => !covers(widened, a));
  if (incompatible.length === cAtoms.length) {
    return { level: "error", reason: `expects ${format(contract)}, lib takes ${format(native)}` };
  }
  if (uncovered.length > 0) {
    const hard = uncovered.filter((a) => incompatible.includes(a));
    if (hard.length === 0) {
      const values = atoms(n).filter((a) => a.k === "literal").map(format);
      const shown = values.length > 6 ? `${values.slice(0, 6).join(" | ")} | … (${values.length} values)` : values.join(" | ");
      return { level: "warning", reason: `lib accepts only specific values: ${shown} (contract: ${format(contract)})` };
    }
    return {
      level: "warning",
      reason: `lib does not accept ${uncovered.map(format).join(" | ")} (contract: ${format(contract)}, lib: ${format(native)})`
    };
  }
  if (isNullable(contract) && !isNullable(native)) {
    return { level: "warning", reason: `lib does not accept null (contract: ${format(contract)})` };
  }
  return { level: "ok" };
}

/**
 * Return check: every value the lib may return must be allowed by the contract.
 */
export function checkReturn(contract: CType, native: CType): Compat {
  // A lib declaring `any`/`object`/`term()` makes no claim we could check.
  if (isUnknown(native) || isUnknown(contract) || native.k === "any") return { level: "unverified" };
  const c = nonNull(contract);
  const n = nonNull(native);
  const nAtoms = atoms(n);
  const uncovered = nAtoms.filter((a) => !covers(c, a));
  if (uncovered.length === nAtoms.length && !(c.k === "void" && n.k === "void")) {
    return { level: "error", reason: `returns ${format(native)}, contract says ${format(contract)}` };
  }
  if (uncovered.length > 0) {
    return {
      level: "warning",
      reason: `may return ${uncovered.map(format).join(" | ")} (contract: ${format(contract)})`
    };
  }
  if (isNullable(native) && !isNullable(contract)) {
    return { level: "warning", reason: `may return null, contract says ${format(contract)}` };
  }
  if (!isNullable(native) && isNullable(contract)) {
    return { level: "warning", reason: `never returns null, contract says ${format(contract)}` };
  }
  return { level: "ok" };
}
