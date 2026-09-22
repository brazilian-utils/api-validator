// Prelude of the generated .NET conformance runner (see runner.ts): JSON encoding of F#/.NET values.
module Prelude

open System
open System.Collections
open System.Globalization
open System.Text.Json
open Microsoft.FSharp.Reflection

let private str (s: string) = JsonSerializer.Serialize(s)

let rec toJson (o: obj) : string =
    match o with
    | null -> "null" // also F# None
    | :? string as s -> str s
    | :? bool as b -> if b then "true" else "false"
    | :? char as c -> str (string c)
    | :? int | :? int64 | :? int16 | :? byte | :? uint32 | :? uint64 | :? decimal ->
        Convert.ToString(o, CultureInfo.InvariantCulture)
    | :? float as f -> f.ToString("R", CultureInfo.InvariantCulture)
    | :? float32 as f -> f.ToString("R", CultureInfo.InvariantCulture)
    | :? DateTime as d -> str (d.ToString("o"))
    | :? DateOnly as d -> str (d.ToString("yyyy-MM-dd"))
    | _ ->
        let t = o.GetType()
        if FSharpType.IsUnion(t, true) then
            let case, fields = FSharpValue.GetUnionFields(o, t, true)
            if case.Name = "None" || case.Name = "ValueNone" then "null"
            elif fields.Length = 0 then str case.Name
            elif fields.Length = 1 && (case.Name = "Some" || case.Name = "ValueSome" || case.Name = "Ok") then toJson fields.[0]
            else "[" + String.Join(",", fields |> Array.map toJson) + "]"
        elif FSharpType.IsRecord(t, true) then
            let fields = FSharpType.GetRecordFields(t, true)
            "{" + String.Join(",", fields |> Array.map (fun f -> str f.Name + ":" + toJson (f.GetValue o))) + "}"
        elif FSharpType.IsTuple t then
            "[" + String.Join(",", FSharpValue.GetTupleFields o |> Array.map toJson) + "]"
        elif (o :? IDictionary) then
            let d = o :?> IDictionary
            let items = [ for k in d.Keys -> str (string k) + ":" + toJson d.[k] ]
            "{" + String.Join(",", items) + "}"
        elif (o :? IEnumerable) then
            "[" + String.Join(",", [ for x in (o :?> IEnumerable) -> toJson x ]) + "]"
        else str (o.ToString())

let private isError (o: obj) =
    match o with
    | null -> false
    | _ ->
        let t = o.GetType()
        FSharpType.IsUnion(t, true) && (fst (FSharpValue.GetUnionFields(o, t, true))).Name = "Error"

let results = ResizeArray<string>()

let run (id: string) (f: unit -> obj) =
    try
        let v = f ()
        if isError v then
            results.Add(sprintf "{\"id\":%s,\"ok\":false,\"error\":%s}" (str id) (str (toJson v)))
        else
            results.Add(sprintf "{\"id\":%s,\"ok\":true,\"value\":%s}" (str id) (toJson v))
    with e ->
        results.Add(sprintf "{\"id\":%s,\"ok\":false,\"error\":%s}" (str id) (str (e.GetType().Name + ": " + e.Message)))

let flush () =
    Console.Out.Write("\u0000JSON\u0000[" + String.Join(",", results) + "]")
