# Adding a language

A language is one adapter: `src/languages/<id>/index.ts` implementing `LanguageAdapter`
(`src/languages/types.ts`), registered in `src/languages/registry.ts`. Nothing in the core
knows about specific languages.

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
  testgen: { framework: "JUnit", path, command, render, format, wire } // optional: export-tests
};
```

Then add `libs/<name>.yaml` (`language: kotlin`), run `api-validator check -l <name> -v`,
and add a fixture + tests under `test/`.

## 1. `candidates(fn, lib)` — naming conventions

Return the native names that would implement `fn` if the lib follows the language's idiom,
most preferred first. `fn.domain`, `fn.operation` and `fn.flatName` are camelCase
(`licensePlate`, `isValid`, `isValidLicensePlate`); `src/core/naming.ts` has `snake`,
`pascal`, `camel`, `flat`. Lookup is case- and separator-insensitive, and domain/function
aliases from the contract are tried automatically. Examples:

| Language | Candidates for `licensePlate.isValid` |
|---|---|
| TypeScript | `isValidLicensePlate` |
| Python | `is_valid_license_plate`, `license_plate.is_valid`, `license_plate.is_valid_license_plate` |
| Go | `licenseplate.IsValid`, `licenseplate.IsValidLicensePlate` |
| Ruby | `LicensePlateUtils.valid?`, `LicensePlateUtils.is_valid`, ... |

Irregular names are handled per lib with `bindings`, not here.

## 2. `extract(ctx)` — the public API

Return every symbol a *user of the lib* can call, and nothing else. Reliability matters
more than speed, in this order of preference:

1. **What the compiler or runtime exposes**: compile the lib into `ctx.workDir` and read the
   result (rustdoc JSON, `.beam` abstract code, .NET assembly reflection), load it and
   reflect (Ruby), or use the ecosystem's standard API tool (TypeScript compiler API,
   griffe for Python, `go/packages` for Go). Run helpers as a process printing
   `"\0JSON\0"` then `{ "symbols": [...], "warnings": [...] }`; parse with `parseJsonOutput`.
2. **Do not write a parser for the language.** If no suitable tool exists, look for a
   well-known, maintained open source one before writing anything; pin its version and
   install it into the work dir. If the toolchain is missing at run time, throw an error
   with the install instruction rather than guessing.

Each symbol: `name` (dotted path relative to the lib root, as users write it), `params`
(`name`, `type` as written, `optional`, `rest`, `keyword`), `returns`, `deprecated`,
`aliasOf` for re-exports (so a facade and its module function count once), `location`
(shown in reports), and `meta` for anything the runner needs later.

Get visibility exactly right: private/internal modules, test files, `pub(crate)`,
unexported names must not appear. Deprecated symbols must be flagged: they are matched
only when nothing else implements the function.

## 3. Types: structured, then `mapType`

Report every type twice: `type` (text, for humans) and `typeNode` / `returnsNode`, the
structured tree from `src/core/model.ts` (`name` with `args`, `list`, `ref`, `union`,
`tuple`, `lit`, `object`, `function`, `unknown`), converted from what the tool already gives
you structured — rustdoc JSON types, `go/types`, the TypeScript checker's `Type`, griffe
expressions, YARD's type parser, Erlang abstract type forms, `System.Type`. Never parse
type text.

`mapType(node, position, symbol)` turns that tree into a canonical type. Build it with
`makeTypeMapper` (`src/languages/shared/typemap.ts`): a name table (`String: T.string`,
`Option: nullableOf`, `Vec: listOf`, `Result: firstArg`...) and, if needed, rules for tuples
(Go `(T, error)`, Erlang `{ok, T}`) and references.

For returns, produce the *success* type: the error channel (exceptions, `error`, `Err`,
`{error, _}`) is an idiom, not part of the contract. Return `T.unknown` whenever unsure:
unknown types are reported as "unverified", never as mismatches.

## 4. `runner` — the shared tests (optional, but it is what proves behaviour)

`run(ctx, calls)` receives `{ id, symbol, args }` (args are JSON values) and returns
`{ id, ok: true, value }` or `{ id, ok: false, error }`, one per call, never throwing.
Use `{ ok: false, unsupported: true }` for calls the runner cannot express (they are
skipped, not failed). Values go back as JSON: `null` for the language's nothing, lists
for tuples, objects for records/structs, ISO strings for dates.

- **Dynamic languages:** a small script that loads the lib, resolves the dotted symbol and
  calls it — see `python/runner.py`, `ruby/runner.rb`, `typescript/runner.mjs`, using
  `runJsonProcess` (`shared/process-runner.ts`) for the wire protocol.
- **Static languages:** generate a program with one function per call, turning JSON args
  into typed literals from the parameters' `typeNode`s; build it next to the lib without
  modifying it (Go: a `go.work`; Rust: a crate with a path dependency); map compile errors
  back to the calls and drop those as unsupported, then rebuild — see `go/runner.ts`,
  `rust/runner.ts`.

Always work in `ctx.workDir`, never in the lib checkout.

## 5. `testgen` — the contract tests as a native test file (optional)

`export-tests` hands the generator the bound contract tests (`ExportGroup[]`, one per
function, each case with its native symbol, args, expectation, `repeat`, `skip` reason and
the `satisfies` target) and writes whatever `render` returns into the lib. Rules:

- **Same semantics as the runner.** Reuse its literal builders and call code (the Go, Rust,
  .NET and Erlang generators import them from their `runner.ts`), so a test passes natively
  exactly when `check --tests` passes it. Verify this on the real lib, test by test.
- **The lib's framework and layout**, idiomatic and readable: one test per case, named from
  `case.slug`, with `case.id` and `case.note` as comments; native skip with the reason.
- Cases the language cannot express go to `unexpressible` (and a comment), never broken code.
- **Deterministic output**, and clean under the lib's formatter/linter: emit compliant code
  or declare `format` (commands run over a scratch copy, e.g. `gofmt -w {file}`).
- `wire` returns other files to update when the framework needs registration (an `.fsproj`).

## Checklist

- [ ] fixture under `test/fixtures/<id>/` exercising visibility, re-exports, deprecation and
      optional/rest params
- [ ] extractor + type mapping tests in `test/extractors.test.ts` / `test/core.test.ts`
- [ ] runner test in `test/runners.test.ts` (skipped when the toolchain is absent)
- [ ] `tools` listed (so `api-validator doctor` checks them)
- [ ] test generator + `test/testgen-<id>.test.ts` (render + a native run on the fixture)
- [ ] toolchain added to `.github/workflows/ci.yml` and `conformance.yml`
- [ ] `libs/<name>.yaml` + `api-validator baseline -l <name> --tests`
