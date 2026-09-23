# API Validator

Keeps the [brazilian-utils](https://github.com/brazilian-utils) implementations —
JavaScript/TypeScript, Python, Go, Rust, Ruby, Erlang and .NET — one library in seven
languages.

- **Same API**: one language-agnostic contract (`contract/*.json`) declares every function,
  its inputs and outputs; each language adapter checks the real, extracted API against it
  in that language's idiom (`cpf.isValid` → `isValidCpf` · `cpf.is_valid` · `cpf.IsValid` ·
  `CPFUtils.valid?` · `brutils:is_valid_cpf/1` · `Cpf.IsValid`).
- **Same behaviour**: the contract carries shared test vectors that run, unchanged, against
  every lib — here through a thin runner per language, and inside each lib as a JSON
  conformance suite (`api-contract/`) its own small harness runs with its own test command.
  Differential testing feeds the same mined inputs to all libs and fails on any new
  disagreement.
- **In sync**: CI in each lib fails on regressions and on public API added outside the
  contract; every lib repo gets an auto-maintained issue with a porting brief for each
  missing or failing function, and a bot PR whenever its copy of the suite changes.
- **Visible**: a status site (a page per lib and per function) that each lib's README badge
  links to: how the lib compares with the others, what it is missing, what fails and why.

See **[docs/workflow.md](docs/workflow.md)** for the maintenance workflow,
**[docs/findings.md](docs/findings.md)** for what the first run found and
**[docs/roadmap.md](docs/roadmap.md)** for the plan.

## Quick start

```bash
npm ci
npx tsx src/cli.ts doctor          # which toolchains are installed / missing
npx tsx src/cli.ts sync            # clone/update every lib into .repos/
npx tsx src/cli.ts check --tests   # contract + shared tests for all libs
npx tsx src/cli.ts site            # status site in output/site/ (open index.html)
```

Running the shared tests needs each lib's toolchain (and dependencies) installed; libs whose
toolchain is missing are still checked for API.

## Commands

`npx tsx src/cli.ts <command>` (or `npm run api-validator -- <command>`). Most take
`-l/--lib <names...>` (full name, short name like `python`, or language).

| Command | What it does |
|---|---|
| `sync` | Clone or update the libs listed in `libs/` into `.repos/` |
| `check [--tests] [-v]` | Compare libs with the contract; writes `output/` (dashboard, per-lib markdown and JSON) and `snapshots/`. Exits non-zero on regressions vs `baselines/` (`--fail-on regression\|error\|never`) |
| `todo -l <lib>` | Markdown TODO list of a lib, most important first |
| `brief <fn> -l <lib>` | Porting brief: idiomatic name, signature, acceptance tests, reference source, links to every implementation |
| `issue -l <lib>` | Body of the lib's sync issue (TODO + briefs) |
| `cases` | Write the JSON conformance suite (`cases/<domain>.json`, schema, index, equality self-test) |
| `export-cases -l <lib> [--path .] [--check]` | Vendor the suite into a lib (`api-contract/`, with the lib's `skip.json`); `--check` fails when it is behind |
| `site [--base-url url]` | Build the status site from the latest reports: overview, a page per lib and per function, badges, the suite |
| `diff [--fn 'cpf.*']` | Differential testing across libs; `--baseline` records today's splits, `--fail-on-new` fails only on new ones; `--propose [--unanimous] [--apply]` turns agreed answers into contract tests |
| `changelog [--from ref] [--to ref]` | Contract changes between git refs (new functions, signature changes, new/changed vectors) as markdown |
| `doctor` | Toolchains every configured lib needs, and what is missing |
| `probe <fn> <args...>` | Call one function with the same args in every lib, side by side |
| `baseline [--tests]` | Record what conforms now; CI then fails only when it stops conforming |
| `extract` | Write `snapshots/<lib>.api.json` (public API as extracted) |
| `suggest -l <lib>` | JSON bindings for symbols that look like contract functions under other names |
| `lint [--strict]` / `fmt [--check]` | Validate / canonically format the contract and lib configs; lists functions without test vectors (`--strict` fails on them) |

```console
$ npx tsx src/cli.ts probe cpf.format 123
brazilian-utils-go           "123"  cpf.Format(cpf: string) -> string
brazilian-utils-javascript   "123"  formatCpf(value: string | number, options?: FormatCpfOptions) -> string
brazilian-utils-python       null   format_cpf(cpf: str) -> str
brazilian-utils-ruby         null   CPFUtils.format_cpf(cpf: String) -> String | nil
brazilian-utils-rust         null   cpf.format_cpf(cpf: &str) -> Option<String>

2 different answers
```

## Using it in a lib's CI

Ready-to-copy workflows for each lib are in [`templates/lib-ci/`](templates/lib-ci): they set
up the language and call this repository's Action:

```yaml
      - uses: brazilian-utils/api-validator@main
        with:
          library: brazilian-utils-python   # name in libs/
          # tests: "true"                   # run the shared tests (default)
          # fail-on: regression             # regression | error | never
```

The job summary shows the lib's TODO list. It fails when something in the lib's baseline
stops conforming, or when a new public function appears that the contract does not know.
It also warns (`cases: check` to fail) when the lib's vendored conformance suite is behind
the contract.

### The shared cases inside the lib

Each lib keeps a copy of the JSON suite in `api-contract/` (refreshed by a nightly bot PR) and a
**harness**: one test file, written once in the lib's language, with a registry from contract
function id to the lib's function. Its normal test command runs every case; missing functions
are skipped as "not implemented", cases the lib does not pass yet are skipped with the reason
(`skip.json`). Spec: [docs/harness.md](docs/harness.md); ready harnesses for every lib:
[templates/harness/](templates/harness).

| Lib | Harness | Run with |
|---|---|---|
| JavaScript | `src/api-contract.test.ts` | `npm test` |
| Python | `tests/test_api_contract.py` | `python -m unittest tests.test_api_contract` |
| Go | `apicontract/apicontract_test.go` | `go test ./apicontract` |
| Rust | `tests/api_contract.rs` (`harness = false`) | `cargo test --test api_contract` |
| Ruby | `spec/api_contract_spec.rb` | `bundle exec rspec spec/api_contract_spec.rb` |
| Erlang | `test/brutils_api_contract_tests.erl` | `rebar3 eunit --module=brutils_api_contract_tests` |
| .NET | `BrazilianUtils.Tests/ApiContractTests.fs` | `dotnet test --filter FullyQualifiedName~ApiContractTests` |

Adding a function to a lib = implement it + one registry line. Why the cases run both here and
in the lib: [docs/workflow.md](docs/workflow.md#tests-here-and-in-the-libs-too).

### Status page and badge

The nightly run publishes the status site. Each lib's README:

```markdown
[![API contract](https://brazilian-utils.github.io/api-validator/badges/python.svg)](https://brazilian-utils.github.io/api-validator/libs/python/)
```

Locally, from a lib checkout: `npx tsx /path/to/api-validator/src/cli.ts check --lib
brazilian-utils-python --path . --tests`.

[`templates/lib-ci/port-with-claude.yml`](templates/lib-ci/port-with-claude.yml) is an optional
workflow that hands the porting brief of the chosen functions to a coding agent, which
implements them, iterates until the shared tests pass and opens a PR for review.


## How it works

```
contract/*.json ──┐
                  ├─► match (conventions + bindings) ─► signature check ─► shared tests ─► report
libs/*.json ──────┤         ▲
lib checkout ─► adapter.extract (native parser / reflection / scanner)
```

Each language is read with its own ecosystem's standard tooling — the compiler's or
runtime's view of the public API, never a parser written here. Without the toolchain the
check fails with the install instruction instead of guessing.

| Language | API extraction (source of truth) | Types from | Shared tests |
|---|---|---|---|
| TypeScript | TypeScript compiler API / type checker ([ts-morph](https://github.com/dsherret/ts-morph)) | declarations, inferred | ✅ Node (tsx) |
| Python | [griffe](https://github.com/mkdocstrings/griffe) (mkdocstrings) + [griffe-warnings-deprecated](https://github.com/mkdocstrings/griffe-warnings-deprecated) for PEP 702 | annotations | ✅ |
| Go | [`go/packages`](https://pkg.go.dev/golang.org/x/tools/go/packages) + `go/types` (build constraints honoured) | type-checked signatures | ✅ generated program in a `go.work` |
| Rust | rustdoc JSON (nightly), cross-checked against [cargo-public-api](https://github.com/cargo-public-api/cargo-public-api) | signatures | ✅ generated crate |
| Ruby | runtime reflection (what is actually callable) + [YARD](https://yardoc.org) for `@param`/`@return`/`@deprecated` | YARD tags | ✅ |
| Erlang | compiled `.beam`: `module_info(exports)` + `beam_lib` abstract code (specs, types) | `-spec` | ✅ `erlc` + escript |
| .NET (F#, C#) | reflection on the compiled assembly, `NullabilityInfoContext`, portable PDB for lines | real types, incl. F#-inferred and C# `?` | ✅ generated F# project |

Types travel structured end to end: each extractor converts the type objects its tool
already has (rustdoc JSON, `go/types`, the TypeScript checker, griffe expressions, YARD's type
parser, Erlang abstract forms, `System.Type`) into one shared tree, which the adapters map to
canonical types and the runners use to build typed arguments. No type text is parsed.
Build metadata comes from the tools too (`cargo metadata`, `go mod edit -json`,
`dotnet msbuild -getProperty`, `cargo build --message-format=json`).

Tools the adapters need beyond the language itself (griffe, YARD, x/tools) are pinned and
installed into the work dir, never into the lib's environment.

Adding a language is one adapter file: [docs/adding-a-language.md](docs/adding-a-language.md).
Contract and lib config format: [docs/contract.md](docs/contract.md).

## Layout

```
contract/        the shared contract, one JSON per domain (+ tests)
libs/            one JSON per implementation: repo, language, bindings, ignores, waivers
baselines/       what conforms today, per lib (CI fails on regressions); _divergences.json = known splits
snapshots/       extracted public API per lib (API changes show up in PR diffs)
src/core/        contract, types, matching, signatures, conformance, diff, baselines
src/languages/   one adapter per language (+ helper scripts in the language itself)
src/reporters/   console, markdown, brief, HTML dashboard
test/            unit + integration tests, fixtures per language
action.yml       GitHub Action for the libs' CI
templates/       workflows to copy into each lib repo
```

## Development

```bash
npm run typecheck
npm test          # unit + extractor/runner integration tests (skips absent toolchains)
npm run lint      # contract + lib configs + formatting
```
