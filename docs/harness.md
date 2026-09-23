# The conformance suite and a lib's harness

The contract's test vectors are published as plain JSON, one file per domain
(`api-validator cases`), in the style of JSON-Schema-Test-Suite or the WHATWG URL tests: the
suite knows nothing about any language. Each lib vendors a copy in `api-contract/`
(`api-validator export-cases`, refreshed by a nightly bot PR) and runs it with a **harness**:
a small test file written once, by hand, in the lib's own language and test framework.

```
api-contract/
  README.md
  cases.schema.json        JSON Schema of the domain files
  cases/index.json         domains, counts, digest, the comparison rules (text)
  cases/equality.json      self-test for the harness's comparison function
  cases/<domain>.json      { domain, functions: [{ id, level, summary, params, returns, network?, cases: [...] }] }
  skip.json                { "<case id>": "reason" } — cases this lib does not pass yet
```

A case: `{ "id": "cpf.isValid#valid-sample", "args": ["40364478081"], "expect": { "returns": true }, "repeat": 5?, "note": "…"? }`,
where `expect` is exactly one of `returns` (any JSON value, `null` included), `throws: true`,
`matches: "<regex>"` or `satisfies: "<contract function id>"`.

## What a harness does

1. **Registry.** A table from contract function id to a function of the lib that takes the
   case's JSON `args` (an array) and returns the result as a JSON-comparable value, or fails.
   It is the lib's explicit statement "contract function X is implemented by Y", one line per
   function, e.g. in Go `"cpf.isValid": func(a []any) (any, error) { return cpf.IsValid(str(a[0])), nil }`.
   Adapting idioms happens here: positional vs options, `(T, bool)`, `Option`, `{ok, V}`.
2. **Load** the files listed in `cases/index.json` → `files`, and `skip.json`.
3. **One native test per case**, named by the case id (table-driven / parametrized, as the
   framework prefers), and:
   - function not in the registry → skip, reason `not implemented` (one skip per function is
     fine): missing functions are TODOs, not failures;
   - function with `network: true` → skip unless an opt-in env var is set;
   - case id in `skip.json` → native skip with that reason;
   - `satisfies` whose target is not in the registry → skip;
   - otherwise run it `repeat` times (default 1) and check the expectation (below).
4. **Registry entries unknown to the suite fail** (a typo, or a contract function renamed).
5. **Equality self-test:** for every pair in `cases/equality.json` (`{id, expected, actual,
   equal, why}`), the harness's comparison function must return exactly `equal` — proof that it
   compares like every other lib.
6. **Environment variables** (same names in every lib):

   | Variable | Effect |
   |---|---|
   | `API_CONTRACT_NETWORK=1` | also run functions marked `network: true` |
   | `API_CONTRACT_NO_SKIP=1` | ignore `skip.json` (see what a fix unlocked, or check parity) |
   | `API_CONTRACT_DIR=<path>` | use another copy of `api-contract/` |

Frameworks without a native skip (EUnit) report a skipped case as an empty group titled
`SKIPPED <case id>: <reason>`: counted neither as passed nor failed, visible in verbose output.
Case ids can contain quotes, slashes and spaces (unnamed cases are keyed by their arguments);
use them as display names, and escape them where the framework's filter syntax needs it.

## Comparison rules

The authoritative text is `cases/index.json` → `comparison`. In short:

| Expectation | Passes when |
|---|---|
| `returns: v` (v not null) | the call succeeds and its result, in JSON form, equals `v`: numbers within `1e-9 × max(1, |v|)` (v = the expected value); object keys compared after lowercasing and dropping non-alphanumerics (`zipCode` = `zip_code`); a null field equals an absent one; arrays element-wise |
| `returns: null` | the idiomatic "no result": `null`, `None`, `nil`, `Option::None`, `undefined`, an Erlang `{error, _}` |
| `throws: true` | the call fails the idiomatic way: exception, `Err`, a non-nil `error`, `{error, _}` |
| `matches: re` | the result is a string matching `re` |
| `satisfies: fn` | `registry[fn]([result])` returns `true` |

"JSON form": dates as ISO-8601 strings, enums as their value, structs/records/maps as
objects, tuples and sets as arrays.

## Rules

- The suite is **vendored and never edited** in the lib: expectations change in
  `api-validator/contract/`, behaviour changes in the lib. `export-cases --check` (in the
  api-validator Action) tells when the copy is behind. Exclude `api-contract/` from the lib's
  formatter and linters, like any vendored or generated file (e.g. `fmt.ignorePatterns` in a
  Vite+ config, `.prettierignore`, `extend-exclude` for ruff); the check compares JSON by
  value, so a formatter that did touch the files would not make them stale.
- A function can have zero cases (not every contract function has vectors yet): register it
  anyway; frameworks that reject empty groups should skip emitting one.
- `skip.json` is generated from the api-validator baseline and `knownFailures`: fixing a case
  in the lib makes the next refresh drop its entry, and the harness then runs it.
- Adding a function to the lib = implementing it + one registry line. The harness then runs
  its cases, and the validator sees it too.
- The harness uses only the lib's language, standard library and existing test dependencies.

Reference harnesses for every language are in [`templates/harness/`](../templates/harness).
