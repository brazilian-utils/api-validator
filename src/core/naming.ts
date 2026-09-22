/**
 * Identifier helpers. Every function works on "words": an identifier is split on
 * case changes, digits boundaries, `_`, `-`, spaces and `?`/`!` suffixes.
 */

/** Split an identifier into lowercase words: `isValidCPF2` -> [is, valid, cpf, 2]. */
export function words(identifier: string): string[] {
  return identifier
    .replace(/[?!=]+$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

export const snake = (id: string) => words(id).join("_");
export const kebab = (id: string) => words(id).join("-");
export const flat = (id: string) => words(id).join("");
export const pascal = (id: string) => words(id).map(cap).join("");
export function camel(id: string): string {
  const [first = "", ...rest] = words(id);
  return first + rest.map(cap).join("");
}

/** Case- and separator-insensitive key used for lookups: `CPFUtils.valid?` -> `cpfutils.valid?`. */
export function lookupKey(symbol: string): string {
  return symbol
    .split(".")
    .map((part) => {
      const suffix = /[?!]$/.test(part) ? part.slice(-1) : "";
      return flat(part) + suffix;
    })
    .join(".");
}

/** Match `name` against a pattern where `*` matches any run of characters (case-insensitive). */
export function globMatch(pattern: string, name: string): boolean {
  const re = new RegExp(
    `^${pattern
      .split("*")
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
    "i"
  );
  return re.test(name);
}

// ---------------------------------------------------------------------------
// Fuzzy matching between native symbols and contract functions
// ---------------------------------------------------------------------------

/** Words that carry no meaning for matching. */
const STOP = new Set(["utils", "brutils", "brazilian", "br", "the", "by", "from", "to", "of", "info", "information"]);

/** Synonyms seen across the brazilian-utils implementations, folded to one token. */
const SYNONYMS: Record<string, string> = {
  validate: "valid",
  valid: "valid",
  display: "format",
  sieve: "strip",
  remove: "strip",
  symbols: "strip",
  clean: "strip",
  unformat: "strip",
  gen: "generate",
  random: "generate",
  rand: "generate",
  uf: "state",
  ufs: "state",
  estado: "state",
  states: "state",
  cities: "city",
  municipalities: "municipality",
  municipio: "municipality",
  plates: "plate",
  processo: "process",
  juridico: "legal",
  natureza: "nature",
  titulo: "voter",
  eleitor: "voter",
  holidays: "holiday",
  feriado: "holiday",
  real: "currency",
  text: "words",
  extenso: "words",
  cnpjs: "cnpj",
  cpfs: "cpf"
};

export function tokens(symbol: string): Set<string> {
  const out = new Set<string>();
  for (const w of words(symbol)) {
    if (STOP.has(w) || w === "is") continue;
    out.add(SYNONYMS[w] ?? w);
  }
  return out;
}

/** Similarity in [0, 1] between two token sets (Dice coefficient). */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const t of a) if (b.has(t)) common += 1;
  return (2 * common) / (a.size + b.size);
}
