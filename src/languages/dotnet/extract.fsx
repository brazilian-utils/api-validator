// Public API of a compiled .NET assembly, by reflection: what consumers actually see,
// including the types F# infers. Usage: dotnet fsi extract.fsx <assembly.dll>
// Prints "\0JSON\0" followed by a JSON array of symbols.
open System
open System.Collections.Generic
open System.IO
open System.Reflection
open System.Reflection.Metadata
open System.Reflection.Metadata.Ecma335
open System.Text.Json
open Microsoft.FSharp.Core

let dllPath = fsi.CommandLineArgs.[1]
let asm = Assembly.LoadFrom dllPath

// Source locations from the portable PDB next to the assembly (first sequence point).
let pdb =
    let path = Path.ChangeExtension(dllPath, ".pdb")
    if File.Exists path then Some((MetadataReaderProvider.FromPortablePdbStream(File.OpenRead path)).GetMetadataReader()) else None

let location (m: MethodInfo) : (string * int) option =
    pdb
    |> Option.bind (fun r ->
        let info = r.GetMethodDebugInformation(MetadataTokens.MethodDefinitionHandle(m.MetadataToken))
        info.GetSequencePoints()
        |> Seq.tryFind (fun sp -> not sp.IsHidden)
        |> Option.map (fun sp -> r.GetString(r.GetDocument(sp.Document).Name), sp.StartLine))

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

/// System.Type -> the shared structured type tree (src/core/model.ts), with F# names.
let rec typeNode (t: Type) : obj =
    let named (name: string) (args: obj[]) : obj =
        let d = Dictionary<string, obj>()
        d.["kind"] <- "name"
        d.["name"] <- name
        if args.Length > 0 then d.["args"] <- args
        box d
    let node (kind: string) (field: string) (value: obj) : obj =
        let d = Dictionary<string, obj>()
        d.["kind"] <- kind
        d.[field] <- value
        box d
    if t.IsArray then node "list" "of" (typeNode (t.GetElementType()))
    elif t.IsGenericType then
        let def = t.GetGenericTypeDefinition()
        let args = t.GetGenericArguments() |> Array.map typeNode
        if def = typedefof<option<_>> then named "option" args
        elif def = typedefof<voption<_>> then named "voption" args
        elif def = typedefof<list<_>> then named "list" args
        elif def = typedefof<seq<_>> then named "seq" args
        elif t.FullName <> null && t.FullName.StartsWith "System.Tuple" then node "tuple" "of" args
        else named (t.Name.Substring(0, t.Name.IndexOf '`')) args
    else named (typeName t) [||]

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

// Nullable reference types (C# `string?`) are only visible through compiler metadata.
let nullability = NullabilityInfoContext()
let isNullableRef (info: NullabilityInfo) = info.ReadState = NullabilityState.Nullable && not info.Type.IsValueType
let withNullability (name: string) (info: NullabilityInfo) = if isNullableRef info then name + "?" else name
let nodeWithNullability (node: obj) (info: NullabilityInfo) : obj =
    if isNullableRef info then
        let n = Dictionary<string, obj>()
        n.["kind"] <- "name"
        n.["name"] <- "null"
        let u = Dictionary<string, obj>()
        u.["kind"] <- "union"
        u.["of"] <- [| node; box n |]
        box u
    else node

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
                    let info = nullability.Create p
                    d.["type"] <- withNullability (typeName p.ParameterType) info
                    d.["typeNode"] <- nodeWithNullability (typeNode p.ParameterType) info
                    if p.IsOptional || p.HasDefaultValue then d.["optional"] <- true
                    if (attr<ParamArrayAttribute> p).IsSome then
                        d.["optional"] <- true
                        d.["rest"] <- true
                    box d
                let s = Dictionary<string, obj>()
                s.["name"] <- sourceName t + "." + name
                s.["params"] <- (ps |> Array.map param)
                let retInfo = nullability.Create m.ReturnParameter
                s.["returns"] <- withNullability (typeName m.ReturnType) retInfo
                if m.ReturnType <> typeof<Void> then s.["returnsNode"] <- nodeWithNullability (typeNode m.ReturnType) retInfo
                if (attr<ObsoleteAttribute> m).IsSome then s.["deprecated"] <- true
                match location m with
                | Some(file, line) ->
                    let loc = Dictionary<string, obj>()
                    loc.["file"] <- file
                    loc.["line"] <- line
                    s.["location"] <- loc
                | None -> ()
                let meta = Dictionary<string, obj>()
                meta.["qualified"] <- qualified t + "." + name
                meta.["groups"] <- groups
                meta.["fsharp"] <- fsharp
                s.["meta"] <- meta
                symbols.Add(box s)

Console.Out.Write("\u0000JSON\u0000" + JsonSerializer.Serialize(symbols))
