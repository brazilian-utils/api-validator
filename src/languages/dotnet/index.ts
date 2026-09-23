/**
 * .NET adapter (F# and C#). The lib is built into the work dir and its public API read from
 * the compiled assembly by reflection (extract.fsx): exactly what consumers see, with the
 * types F# infers, C# nullable reference types (NullabilityInfoContext) and source lines
 * from the portable PDB.
 */
import { T } from "../../core/ctype.js";
import { pascal } from "../../core/naming.js";
import { firstArg, listOf, makeTypeMapper, nullableOf } from "../shared/typemap.js";
import type { AdapterContext, Extraction, LanguageAdapter } from "../types.js";
import { extractFromAssembly, runDotnet } from "./runner.js";
import { which } from "../../core/shell.js";

async function extract(ctx: AdapterContext): Promise<Extraction> {
  if (!which("dotnet")) throw new Error("the .NET adapter needs the .NET SDK (dotnet) on PATH to build and reflect the lib");
  const symbols = extractFromAssembly(ctx);
  return { symbols, warnings: symbols.length ? [] : [`no public functions found in the ${ctx.lib.entry} assembly`] };
}

const int = T.integer;
const mapDotnet = makeTypeMapper({
  names: {
    string: T.string, String: T.string, char: T.string, Char: T.string,
    bool: T.boolean, Boolean: T.boolean,
    int: int, Int32: int, int64: int, Int64: int, long: int, short: int, byte: int, uint: int, ulong: int,
    float: T.number, double: T.number, Double: T.number, decimal: T.number, Decimal: T.number, single: T.number,
    unit: T.void, void: T.void,
    obj: T.any, object: T.any,
    DateTime: T.date, DateOnly: T.date, DateTimeOffset: T.date,
    option: nullableOf, voption: nullableOf, Option: nullableOf, Nullable: nullableOf, null: T.null,
    list: listOf, List: listOf, IList: listOf, IEnumerable: listOf, IReadOnlyList: listOf, seq: listOf, array: listOf, ICollection: listOf,
    Task: firstArg, Async: firstArg, Result: firstArg
  }
});

export const dotnet: LanguageAdapter = {
  id: "dotnet",
  aliases: ["csharp", "fsharp", "c#", "f#"],
  displayName: ".NET",
  optionalParams: false,
  candidates: (fn) => {
    const mod = pascal(fn.domain);
    return [`${mod}.${pascal(fn.operation)}`, `${mod}.${pascal(fn.flatName)}`, `${mod}Utils.${pascal(fn.operation)}`];
  },
  extract,
  mapType(native, position) {
    if (!native) return position === "return" ? T.void : T.unknown;
    const t = mapDotnet(native);
    return position === "return" && t.k === "void" ? T.void : t;
  },
  tools: [{ bin: "dotnet", purpose: "extraction (reflection), shared tests", install: "https://dotnet.microsoft.com/download (SDK 8+)" }],
  runner: { requires: ["dotnet"], run: runDotnet }
};
