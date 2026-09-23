import { T } from "../../core/ctype.js";
import { isStringTrait } from "./traits.js";
import { snake } from "../../core/naming.js";
import { firstArg, listOf, makeTypeMapper, nullableOf } from "../shared/typemap.js";
import type { LanguageAdapter } from "../types.js";
import { which } from "../../core/shell.js";
import { extractWithRustdoc, nightlyToolchain } from "./rustdoc.js";
import { runRust } from "./runner.js";

const int = T.integer;

const mapRust = makeTypeMapper({
  names: {
    str: T.string,
    String: T.string,
    char: T.string,
    bool: T.boolean,
    i8: int, i16: int, i32: int, i64: int, i128: int, isize: int,
    u8: int, u16: int, u32: int, u64: int, u128: int, usize: int,
    f32: T.number,
    f64: T.number,
    Option: nullableOf,
    Vec: listOf,
    VecDeque: listOf,
    HashSet: listOf,
    BTreeSet: listOf,
    HashMap: T.object(),
    BTreeMap: T.object(),
    Box: firstArg,
    Rc: firstArg,
    Arc: firstArg,
    Cow: (args, map) => (args.length ? map(args[args.length - 1]) : T.unknown),
    Result: firstArg, // the error channel is the idiomatic "throws"
    "()": T.void,
    // `impl Into<String>` / `impl AsRef<str>` / `impl ToString` parameters take strings.
    impl: (args) => (args.some(isStringTrait) ? T.string : T.unknown),
    NaiveDate: T.date,
    NaiveDateTime: T.date,
    DateTime: T.date
  },
  tuple: (items, map) => (items.length === 0 ? T.void : T.list(T.union(...items.map(map))))
});

export const rust: LanguageAdapter = {
  id: "rust",
  aliases: ["rs"],
  displayName: "Rust",
  optionalParams: false,
  candidates: (fn) => [
    `${snake(fn.domain)}.${snake(fn.operation)}`, // cpf::is_valid
    `${snake(fn.domain)}.${snake(fn.flatName)}`, // cpf::format_cpf
    snake(fn.flatName) // crate root re-export
  ],
  async extract(ctx) {
    const toolchain = which("rustup") ? nightlyToolchain(ctx) : undefined;
    if (!toolchain) throw new Error("the Rust adapter reads rustdoc JSON, which needs a nightly toolchain: rustup toolchain install nightly --profile minimal");
    return { symbols: extractWithRustdoc(ctx, toolchain), warnings: [] };
  },
  mapType(native, position) {
    if (!native) return position === "return" ? T.void : T.unknown;
    return mapRust(native);
  },
  tools: [
    { bin: "cargo", purpose: "shared tests", install: "https://rustup.rs" },
    {
      bin: "rustup",
      version: ["run", "nightly", "rustc", "--version"],
      purpose: "extraction (rustdoc JSON needs a nightly toolchain: rustup toolchain install nightly)",
      install: "https://rustup.rs, then rustup toolchain install nightly --profile minimal"
    },
  ],
  runner: { requires: ["cargo"], run: runRust }
};
