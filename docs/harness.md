# The conformance suite and the harness of a library

Use this page to write or maintain the harness that runs the shared cases inside a library.
`api-validator cases` publishes the test cases of the contract as plain JSON, one file per
domain. The style is the same as JSON-Schema-Test-Suite or the WHATWG URL tests: the suite
knows nothing about any language. Each library keeps a copy in `api-contract/`
(`api-validator export-cases`). A nightly bot PR updates this copy. The library runs the suite
with a **harness**: a small test file, written once, by hand, in the language and test
framework of the library.

```
api-contract/
  README.md
  cases.schema.json        JSON Schema of the domain files
  cases/index.json         domains, counts, digest, the comparison rules (text)
  cases/equality.json      self-test for the harness's comparison function
  cases/<domain>.json      { domain, functions: [{ id, level, summary, params, returns, network?, cases: [...] }] }
  skip.json                { "<case id>": "reason" } — cases this lib does not pass yet
```

A case looks like this:
`{ "id": "cpf.isValid#valid-sample", "args": ["40364478081"], "expect": { "returns": true }, "repeat": 5?, "note": "…"? }`.
`expect` is exactly one of `returns` (any JSON value, `null` included), `throws: true`,
`matches: "<regex>"` or `satisfies: "<contract function id>"`.

## What a harness does

1. **Registry.** The harness has a table from contract function id to a function of the
   library. This function takes the JSON `args` of the case (an array). It returns the result
   as a JSON-comparable value, or fails. The table is the explicit statement of the library
   that "contract function X is implemented by Y", with one line per function. For example, in
   Go: `"cpf.isValid": func(a []any) (any, error) { return cpf.IsValid(str(a[0])), nil }`.
   The registry adapts the idioms: positional arguments or options, `(T, bool)`, `Option`,
   `{ok, V}`.
2. **Load** the files listed in `cases/index.json` → `files`, and `skip.json`.
3. **Make one native test per case**, named by the case id (table-driven or parametrized, as
   the framework prefers). Then apply these rules:
   - Function not in the registry: skip, with the reason `not implemented`. One skip per
     function is fine. Missing functions are TODOs, not failures.
   - Function with `network: true`: skip, unless you set an opt-in env var.
   - Case id in `skip.json`: native skip with that reason.
   - `satisfies` whose target is not in the registry: skip.
   - Otherwise: run the case `repeat` times (default 1) and check the expectation (below).
4. **Fail on registry entries that the suite does not know** (a typo, or a contract function
   that has a new name).
5. **Equality self-test:** `cases/equality.json` has pairs (`{id, expected, actual, equal,
   why}`). For every pair, the comparison function of the harness must return exactly
   `equal`. This proves that it compares like every other library.
6. **Environment variables** (same names in every library):

   | Variable | Effect |
   |---|---|
   | `API_CONTRACT_NETWORK=1` | also run functions marked `network: true` |
   | `API_CONTRACT_NO_SKIP=1` | ignore `skip.json` (see what a fix unlocked, or check parity) |
   | `API_CONTRACT_DIR=<path>` | use another copy of `api-contract/` |

Some frameworks have no native skip (EUnit). They report a skipped case as an empty group with
the title `SKIPPED <case id>: <reason>`. The framework counts it as neither passed nor failed,
and it is visible in verbose output. Case ids can contain quotes, slashes and spaces (unnamed
cases use their arguments as keys). Use the ids as display names. Escape them where the filter
syntax of the framework needs it.

## Comparison rules

The authoritative text is in `cases/index.json` → `comparison`. In short:

| Expectation | Passes when |
|---|---|
| `returns: v` (v not null) | the call succeeds and its result, in JSON form, equals `v`. Numbers: within `1e-9 × max(1, |v|)` (v = the expected value). Object keys: compared after lowercasing and dropping non-alphanumerics (`zipCode` = `zip_code`). A null field equals an absent one. Arrays: element-wise |
| `returns: null` | the idiomatic "no result": `null`, `None`, `nil`, `Option::None`, `undefined`, an Erlang `{error, _}` |
| `throws: true` | the call fails the idiomatic way: exception, `Err`, a non-nil `error`, `{error, _}` |
| `matches: re` | the result is a string matching `re` |
| `satisfies: fn` | `registry[fn]([result])` returns `true` |

"JSON form" means: dates as ISO-8601 strings, enums as their value, structs, records and maps
as objects, tuples and sets as arrays.

## Rules

- The library keeps the suite as a **copy and never edits it**. Expectations change in
  `api-validator/contract/`. Behavior changes in the library. `export-cases --check` (in the
  api-validator Action) tells you when the copy is behind. Exclude `api-contract/` from the
  formatter and linters of the library, as you do for any copied or generated file (for
  example, `fmt.ignorePatterns` in a Vite+ config, `.prettierignore`, `extend-exclude` for
  ruff). The check compares JSON by value. So if a formatter changes the files, they do not
  become stale.
- A function can have zero cases, because not every contract function has cases yet. Register
  it anyway. If a framework rejects empty groups, do not make an empty group.
- The validator generates `skip.json` from the api-validator baseline and `knownFailures`. When you fix a
  case in the library, the next update removes its entry, and the harness then runs it.
- To add a function to the library, implement it and add one registry line. The harness then
  runs its cases, and the validator also sees it.
- The harness uses only the language, the standard library and the existing test dependencies
  of the library.

[`templates/harness/`](../templates/harness) has reference harnesses for every language.
