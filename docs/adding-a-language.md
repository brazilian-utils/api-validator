# Adding a language

Use this page to add support for a new language to the validator. A language is one adapter:
`src/languages/<id>/index.ts`. It implements `LanguageAdapter` (`src/languages/types.ts`) and
is registered in `src/languages/registry.ts`. The core knows nothing about specific languages.

```ts
export const kotlin: LanguageAdapter = {
  id: "kotlin",
  displayName: "Kotlin",
  optionalParams: true,          // false for languages without optional params (Go, Rust)
  candidates(fn) { ... },        // idiomatic names for a contract function
  async extract(ctx) { ... },    // public API of the lib
  mapType(native, position) { ... }, // native type -> canonical type
  tools: [{ bin: "java", purpose: "extraction and shared tests", install: "https://adoptium.net" }], // for `doctor`
  runner: { requires: ["java"], run(ctx, calls) { ... } }, // optional: shared tests
};
```

After you write the adapter, do these steps:

1. Add `libs/<name>.json` (`"language": "kotlin"`).
2. Run `docs check -l <name> -v`.
3. Add a fixture and tests under `test/`.

## 1. `candidates(fn, lib)`: naming conventions

Return the native names that would implement `fn` if the library follows the idiom of the
language. Put the preferred name first. `fn.domain`, `fn.operation` and `fn.flatName` are
camelCase (`licensePlate`, `isValid`, `isValidLicensePlate`). `src/core/naming.ts` has
`snake`, `pascal`, `camel` and `flat`. The lookup ignores case and separators. The validator
also tries the domain and function aliases from the contract automatically. Examples:

| Language | Candidates for `licensePlate.isValid` |
|---|---|
| TypeScript | `isValidLicensePlate` |
| Python | `is_valid_license_plate`, `license_plate.is_valid`, `license_plate.is_valid_license_plate` |
| Go | `licenseplate.IsValid`, `licenseplate.IsValidLicensePlate` |
| Ruby | `LicensePlateUtils.valid?`, `LicensePlateUtils.is_valid`, ... |

Handle irregular names per library with `bindings`, not here.

## 2. `extract(ctx)`: the public API

Return every symbol that a *user of the library* can call, and nothing else. Reliability is
more important than speed. Use these methods in this order of preference:

1. **What the compiler or runtime exposes**: compile the library into `ctx.workDir` and read
   the result (rustdoc JSON, `.beam` abstract code, .NET assembly reflection). You can also
   load the library and reflect (Ruby), or use the standard API tool of the ecosystem
   (TypeScript compiler API, griffe for Python, `go/packages` for Go). Run helpers as a
   process that prints `"\0JSON\0"` and then `{ "symbols": [...], "warnings": [...] }`.
   Parse the output with `parseJsonOutput`.
2. **Do not write a parser for the language.** If no suitable tool exists, look for a
   well-known, maintained open source tool before you write anything. Pin its version and
   install it into the work dir. If the toolchain is missing at run time, throw an error
   with the install instruction. Do not guess.

Each symbol has these fields:

- `name`: the dotted path relative to the library root, as users write it.
- `params`: `name`, `type` as written, `optional`, `rest`, `keyword`.
- `returns`.
- `deprecated`.
- `aliasOf` for re-exports, so that a facade and its module function count once.
- `location`, shown in reports.
- `meta` for anything the runner needs later.

Get visibility exactly right. Private or internal modules, test files, `pub(crate)` and
unexported names must not appear. Flag deprecated symbols. The validator matches them only
when nothing else implements the function.

## 3. Types: structured, then `mapType`

Report every type twice:

- `type`: text, for humans.
- `typeNode` / `returnsNode`: the structured tree from `src/core/model.ts` (`name` with
  `args`, `list`, `ref`, `union`, `tuple`, `lit`, `object`, `function`, `unknown`).

Convert the tree from the structured data that the tool already gives you: rustdoc JSON
types, `go/types`, the `Type` of the TypeScript checker, griffe expressions, the type parser
of YARD, Erlang abstract type forms, `System.Type`. Never parse type text.

`mapType(node, position, symbol)` turns that tree into a canonical type. Make it with
`makeTypeMapper` (`src/languages/shared/typemap.ts`). Give it a name table (`String: T.string`,
`Option: nullableOf`, `Vec: listOf`, `Result: firstArg`...). If necessary, also give it rules
for tuples (Go `(T, error)`, Erlang `{ok, T}`) and references.

For returns, produce the *success* type. The error channel (exceptions, `error`, `Err`,
`{error, _}`) is an idiom. It is not part of the contract. Return `T.unknown` when you are
not sure. The validator reports unknown types as "unverified", never as mismatches.

## 4. `runner`: the shared tests (optional, but it is what proves behavior)

`run(ctx, calls)` receives `{ id, symbol, args }`, where args are JSON values. It returns
`{ id, ok: true, value }` or `{ id, ok: false, error }`, one per call. It never throws. Use
`{ ok: false, unsupported: true }` for calls that the runner cannot express. The validator
skips these calls and does not count them as failures. Send values back as JSON: `null` for
the "nothing" value of the language, lists for tuples, objects for records or structs, ISO
strings for dates.

- **Dynamic languages:** write a small script that loads the library, resolves the dotted
  symbol and calls it. See `python/runner.py`, `ruby/runner.rb` and `typescript/runner.mjs`.
  They use `runJsonProcess` (`shared/process-runner.ts`) for the wire protocol.
- **Static languages:** generate a program with one function per call. Turn the JSON args
  into typed literals from the `typeNode`s of the parameters. Build the program next to the
  library without changes to the library (Go: a `go.work`. Rust: a crate with a path
  dependency). Map compile errors back to the calls, drop those calls as unsupported, then
  build again. See `go/runner.ts` and `rust/runner.ts`.

Always work in `ctx.workDir`, never in the library checkout.

## 5. The harness of the library

The library runs the shared cases itself with a harness over the copied JSON suite. The
harness is written in the language of the library. This repository does not generate it.
Follow [harness.md](harness.md) and start from the closest template in `templates/harness/`.
Check parity: with `API_CONTRACT_NO_SKIP=1`, the cases that the harness fails must be exactly
the cases that `check --tests` fails.

## Checklist

- [ ] fixture under `test/fixtures/<id>/` that tests visibility, re-exports, deprecation and
      optional/rest params
- [ ] extractor and type mapping tests in `test/extractors.test.ts` / `test/core.test.ts`
- [ ] runner test in `test/runners.test.ts` (skipped when the toolchain is absent)
- [ ] `tools` listed (so `docs doctor` checks them)
- [ ] the harness of the library (`templates/harness/<id>/`), parity with `check --tests` verified
- [ ] toolchain added to `.github/workflows/ci.yml` and `conformance.yml`
- [ ] `libs/<name>.json` + `docs baseline -l <name> --tests`
