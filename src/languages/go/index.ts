import fs from "node:fs";
import path from "node:path";
import { T, union, type CType } from "../../core/ctype.js";
import { flat, pascal } from "../../core/naming.js";
import { LANGUAGES_DIR } from "../../core/paths.js";
import { parseJsonOutput, runOrThrow } from "../../core/shell.js";
import { makeTypeMapper } from "../shared/typemap.js";
import type { TypeNode } from "../shared/typeparse.js";
import type { Extraction, LanguageAdapter } from "../types.js";
import { runGo } from "./runner.js";

const int = T.integer;
const isError = (n: TypeNode) => n.kind === "name" && n.name === "error";
const isBool = (n: TypeNode) => n.kind === "name" && n.name === "bool";

const mapGo = makeTypeMapper({
  names: {
    string: T.string,
    rune: T.string,
    bool: T.boolean,
    int, int8: int, int16: int, int32: int, int64: int,
    uint: int, uint8: int, uint16: int, uint32: int, uint64: int, byte: int, uintptr: int,
    float32: T.number,
    float64: T.number,
    any: T.any,
    error: T.void,
    "time.Time": T.date,
    Time: T.date
  },
  // `*T` may be nil.
  ref: (_op, of) => T.nullable(of),
  // Multi-returns: (T, error) -> T ; (T, bool) comma-ok -> T? ; others unknown.
  tuple(items, map): CType {
    const values = items.filter((n) => !isError(n));
    if (values.length === 1) return map(values[0]);
    if (values.length === 2 && isBool(values[1])) return T.nullable(map(values[0]));
    if (values.length === 0) return T.void;
    return T.unknown;
  }
});

export const go: LanguageAdapter = {
  id: "go",
  aliases: ["golang"],
  displayName: "Go",
  optionalParams: false,
  candidates: (fn) => [
    `${flat(fn.domain)}.${pascal(fn.operation)}`, // cpf.IsValid
    `${flat(fn.domain)}.${pascal(fn.flatName)}`, // cpf.FormatCpf
    pascal(fn.flatName) // root package: IsValidCpf
  ],
  async extract(ctx): Promise<Extraction> {
    fs.mkdirSync(ctx.workDir, { recursive: true });
    const out = runOrThrow("go", ["run", path.join(LANGUAGES_DIR, "go", "extract.go"), ctx.root], {
      cwd: ctx.workDir,
      env: { ...process.env, GOWORK: "off", GOFLAGS: "", GO111MODULE: "on", GOTOOLCHAIN: "local" }
    });
    return parseJsonOutput<Extraction>(out, "go extractor");
  },
  mapType(native, position) {
    const t = mapGo(native);
    // A Go func with no results returns nothing.
    if (position === "return" && !native) return T.void;
    return t.k === "union" ? union(t.of.filter((x) => x.k !== "void")) : t;
  },
  runner: { requires: ["go"], run: runGo }
};
