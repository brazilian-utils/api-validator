// Public API of a compiled .NET assembly, by reflection: what consumers actually see,
// including the types F# infers. Usage: dotnet fsi extract.fsx <assembly.dll>
// Prints "\0JSON\0" followed by a JSON array of symbols.
open System
open System.Collections.Generic
open System.Reflection
open System.Text.Json
open Microsoft.FSharp.Core

let asm = Assembly.LoadFrom(fsi.CommandLineArgs.[1])

let rec typeName (t: Type) : string =
    if t.IsArray then typeName (t.GetElementType()) + "[]"
    elif t.IsGenericType then
        let def = t.GetGenericTypeDefinition()
        let args = t.GetGenericArguments() |> Array.map typeName
        if def = typedefof<option<_>> then args.[0] + " option"
        elif def = typedefof<voption<_>> then args.[0] + " voption"
        elif def = typedefof<list<_>> then args.[0] + " list"
        elif def = typedefof<seq<_>> then args.[0] + " seq"
        elif def = typedefof<Result<_, _>> then sprintf "Result<%s, %s>" args.[0] args.[1]
        elif t.FullName <> null && t.FullName.StartsWith "System.Tuple" then "(" + String.Join(" * ", args) + ")"
        else
            let name = t.Name.Substring(0, t.Name.IndexOf '`')
            sprintf "%s<%s>" name (String.Join(", ", args))
    else
        match t.FullName with
        | "System.String" -> "string"
        | "System.Boolean" -> "bool"
        | "System.Int32" -> "int"
        | "System.Int64" -> "int64"
        | "System.Int16" -> "int16"
        | "System.Byte" -> "byte"
        | "System.Double" -> "float"
        | "System.Single" -> "float32"
        | "System.Decimal" -> "decimal"
        | "System.Char" -> "char"
        | "System.Object" -> "obj"
        | "System.Void" | "Microsoft.FSharp.Core.Unit" -> "unit"
        | _ -> t.Name

let isModule (t: Type) =
    t.GetCustomAttributes(typeof<CompilationMappingAttribute>, false)
    |> Array.exists (fun a -> (a :?> CompilationMappingAttribute).SourceConstructFlags = SourceConstructFlags.Module)

/// Source name of a module/class: F# adds a "Module" suffix to modules named like a type.
let sourceName (t: Type) =
    let suffixed =
        t.GetCustomAttributes(typeof<CompilationRepresentationAttribute>, false)
        |> Array.exists (fun a -> (a :?> CompilationRepresentationAttribute).Flags.HasFlag CompilationRepresentationFlags.ModuleSuffix)
    if suffixed && t.Name.EndsWith "Module" then t.Name.Substring(0, t.Name.Length - 6) else t.Name

let rec qualified (t: Type) =
    if isNull t.DeclaringType then (if String.IsNullOrEmpty t.Namespace then "" else t.Namespace + ".") + sourceName t
    else qualified t.DeclaringType + "." + sourceName t

let attr<'T> (p: ICustomAttributeProvider) : 'T option =
    p.GetCustomAttributes(typeof<'T>, false) |> Array.tryHead |> Option.map (fun a -> a :?> 'T)

let symbols = List<obj>()
for t in asm.GetExportedTypes() do
    // Static classes: F# modules and C# static classes.
    if t.IsAbstract && t.IsSealed then
        let fsharp = isModule t
        for m in t.GetMethods(BindingFlags.Public ||| BindingFlags.Static ||| BindingFlags.DeclaredOnly) do
            if not m.IsSpecialName && not (m.Name.Contains "@") then
                let name =
                    match attr<CompilationSourceNameAttribute> m with
                    | Some a -> a.SourceName
                    | None -> m.Name
                let ps = m.GetParameters()
                let groups =
                    match attr<CompilationArgumentCountsAttribute> m with
                    | Some a -> a.Counts |> Seq.toArray
                    | None -> [| ps.Length |]
                let groups = if ps.Length = 0 then [| 0 |] else groups
                let param (p: ParameterInfo) : obj =
                    let d = Dictionary<string, obj>()
                    d.["name"] <- (if String.IsNullOrEmpty p.Name then sprintf "arg%d" p.Position else p.Name)
                    d.["type"] <- typeName p.ParameterType
                    if p.IsOptional || p.HasDefaultValue then d.["optional"] <- true
                    if (attr<ParamArrayAttribute> p).IsSome then
                        d.["optional"] <- true
                        d.["rest"] <- true
                    box d
                let s = Dictionary<string, obj>()
                s.["name"] <- sourceName t + "." + name
                s.["params"] <- (ps |> Array.map param)
                s.["returns"] <- typeName m.ReturnType
                if (attr<ObsoleteAttribute> m).IsSome then s.["deprecated"] <- true
                let meta = Dictionary<string, obj>()
                meta.["qualified"] <- qualified t + "." + name
                meta.["groups"] <- groups
                meta.["paramTypes"] <- (ps |> Array.map (fun p -> typeName p.ParameterType))
                meta.["fsharp"] <- fsharp
                s.["meta"] <- meta
                symbols.Add(box s)

Console.Out.Write("\u0000JSON\u0000" + JsonSerializer.Serialize(symbols))
