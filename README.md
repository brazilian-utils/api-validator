# Brazilian Utils doc

This repository keeps the [brazilian-utils](https://github.com/brazilian-utils) libraries
(JavaScript/TypeScript, Python, Go, Ruby, Rust, .NET, Erlang) in step: same functions, same
behavior.

- **Same API**: one language-agnostic contract (`contract/<domain>/contract.json`) declares every function
  with its inputs and outputs. Each language adapter extracts the real API and checks it
  against the contract in the idiom of that language (`cpf.isValid` → `isValidCpf` ·
  `cpf.is_valid` · `cpf.IsValid` · `CPFUtils.valid?` · `brutils:is_valid_cpf/1` ·
  `Cpf.IsValid`).
- **Same behavior**: the contract holds shared test cases. They run, unchanged, against every
  library in two places. Here, a thin runner per language runs them. Inside each library, a
  JSON conformance suite (`api-contract/`) runs them through a small harness and the normal
  test command of the library. Differential testing gives the same mined inputs to all
  libraries and fails on any new disagreement.
- **In sync**: CI in each library fails on regressions and on public API added outside the
  contract. When someone merges a new function, the pipeline opens an issue with a porting brief
  in every library that does not have it. A merged bug-fix case opens an issue in every
  library that fails it. The pipeline closes these issues automatically when the work is
  done. A bot also opens a PR in a library when its copy of the suite changes.
- **Documented once**: the docs site ([`site/`](site), Next.js + Fumadocs, English and Portuguese) is
  built from the contract. It has one page per utility with the spec, the signature of each
  function, its status in every library, a usage tab per library (from the
  `docs/usage/<util>.md` file of each library) and the shared cases. The `summary` and
  `description` of a contract function can be English only (a string) or bilingual
  (`{ "en": ..., "pt-BR": ... }`). `site/scripts/check-i18n.mjs --strict` requires both
  languages.
- **Status pages**: each library has a status page, and the README badge of the library links
  to it. The page shows how the library compares with the others, what it does not have yet,
  what fails and why.

For more information, read these pages:

- **[docs/workflow.md](docs/workflow.md)**: the maintenance workflow.
- **[docs/findings.md](docs/findings.md)**: what the first run found.
- **[docs/roadmap.md](docs/roadmap.md)**: the plan.

## Quick start

```bash
npm ci
npx tsx src/cli.ts doctor          # which toolchains are installed / missing
npx tsx src/cli.ts sync            # clone/update every lib into .repos/
npx tsx src/cli.ts check --tests   # contract + shared tests for all libs
npx tsx src/cli.ts site-data       # results for the docs site (status, badges, JSON suite)
(cd site && npm ci && npm run dev) # the docs site at http://localhost:3000/doc/
```

To run the shared tests, install the toolchain and the dependencies of each library. When the
toolchain of a library is missing, the validator still checks its API.

## Commands

Run `npx tsx src/cli.ts <command>` (or `npm run doc -- <command>`). Most commands
take `-l/--lib <names...>`. The value can be the full name, a short name like `python`, or the
language.

| Command | What it does |
|---|---|
| `sync` | Clones or updates the libraries listed in `libs/` into `.repos/` |
| `check [--tests] [-v]` | Compares libraries with the contract. Writes `output/` (dashboard, markdown and JSON per library) and `snapshots/`. Exits non-zero on regressions against `baselines/` (`--fail-on regression\|error\|never`) |
| `todo -l <lib>` | Writes a markdown TODO list for a library, most important first |
| `brief <fn> -l <lib>` | Writes a porting brief: idiomatic name, signature, acceptance tests, reference source, links to every implementation |
| `issues [--since ref] [--backfill core\|all] [--apply]` | Opens one GitHub issue per function per library: `Implement <fn>` for functions the contract got after `ref`, `Fix <fn>` for new or changed cases a library fails. Updates the open issues and closes the ones that are done. The pipeline runs it on every merge |
| `cases` | Writes the JSON conformance suite (`cases/<domain>.json`, schema, index, equality self-test) |
| `export-cases -l <lib> [--path .] [--check]` | Copies the suite into a library (`api-contract/`, with the `skip.json` of the library). `--check` fails when the copy is behind |
| `site-data [--out site]` | Exports the latest reports for the docs site: `site/.generated/status.json` (status per library and function, failing cases, usage), badges, the JSON suite |
| `usage [--scaffold] [--materialize] [--path .] [--strict]` | Shows which implemented functions each library documents (its usage files and reference page, else `site/fixtures/usage/<lib>/`). `--scaffold` writes the missing sections from the cases the library passes. `--materialize` writes a reference page out as usage files |
| `diff [--fn 'cpf.*']` | Runs differential testing across libraries. `--baseline` records the current splits. `--fail-on-new` fails only on new splits. `--propose [--unanimous] [--apply]` turns agreed answers into contract tests |
| `changelog [--from ref] [--to ref]` | Writes the contract changes between git refs (new functions, signature changes, new or changed cases) as markdown |
| `doctor` | Lists the toolchains that every configured library needs, and what is missing |
| `probe <fn> <args...>` | Calls one function with the same arguments in every library and shows the results side by side |
| `baseline [--tests]` | Records what conforms now. CI then fails only when something stops conforming |
| `extract` | Writes `snapshots/<lib>.api.json` (the public API as extracted) |
| `suggest -l <lib>` | Writes JSON bindings for symbols that look like contract functions under other names |
| `lint [--strict]` / `fmt [--check]` | Validates or formats (canonical form) the contract and the library configs. Lists functions without test cases (`--strict` fails on them) |

```console
$ npx tsx src/cli.ts probe cpf.format 123
brazilian-utils-dotnet       "123."  Cpf.Format(cpf: string) -> string
brazilian-utils-erlang       null ({error, invalid})  brutils.format_cpf(cpf: binary()) -> {ok, brutils_cpf:formatted_cpf()} | {error, invalid}
brazilian-utils-go           "123"  cpf.Format(cpf: string) -> string
brazilian-utils-javascript   "123"  formatCpf(value: string | number, options?: FormatCpfOptions) -> string
brazilian-utils-python       null  format_cpf(cpf: str) -> str
brazilian-utils-ruby         null  CPFUtils.format_cpf(cpf: String) -> String | nil
brazilian-utils-rust         null  cpf.format_cpf(cpf: &str) -> Option<String>

3 different answers
```

## Use the validator in the CI of a library

[`templates/lib-ci/`](templates/lib-ci) has ready-to-copy workflows for each library. They set
up the language and call the Action of this repository:

```yaml
      - uses: brazilian-utils/doc@main
        with:
          library: brazilian-utils-python   # name in libs/
          # tests: "true"                   # run the shared tests (default)
          # fail-on: regression             # regression | error | never
```

The job summary shows the TODO list of the library. The job fails in two cases:

- Something in the baseline of the library stops conforming.
- A new public function appears that the contract does not know.

The job also warns when the conformance suite copied into the library is behind the contract.
Set `cases: check` to make it fail instead.

### Shared cases inside the library

Each library keeps a copy of the JSON suite in `api-contract/`. A nightly bot PR updates this
copy. Each library also has a **harness**: one test file, written once in the language of the
library, with a registry from contract function id to the function of the library. The normal
test command of the library runs every case. It skips missing functions as "not implemented".
It skips cases that the library does not pass yet, with the reason (`skip.json`). For the
spec, read [docs/harness.md](docs/harness.md). For ready harnesses for every library, see
[templates/harness/](templates/harness).

| Lib | Harness | Run with |
|---|---|---|
| JavaScript | `src/api-contract.test.ts` | `npm test` |
| Python | `tests/test_api_contract.py` | `python -m unittest tests.test_api_contract` |
| Go | `apicontract/apicontract_test.go` | `go test ./apicontract` |
| Ruby | `spec/api_contract_spec.rb` | `bundle exec rspec spec/api_contract_spec.rb` |
| Rust | `tests/api_contract.rs` (`harness = false`) | `cargo test --test api_contract` |
| .NET | `BrazilianUtils.Tests/ApiContractTests.fs` | `dotnet test --filter FullyQualifiedName~ApiContractTests` |
| Erlang | `test/brutils_api_contract_tests.erl` | `rebar3 eunit --module=brutils_api_contract_tests` |

To add a function to a library, implement it and add one registry line. To learn why the cases
run both here and in the library, read
[docs/workflow.md](docs/workflow.md#tests-here-and-in-the-libraries).

### Status page and badge

The pipeline publishes the docs site (`vars.PUBLISH_SITE`), with a status page per library.
Add this badge to the README of each library:

```markdown
[![API contract](https://brazilian-utils.github.io/doc/badges/python.svg)](https://brazilian-utils.github.io/doc/libs/python/)
```

Each library keeps the usage examples for the site (`docs/usage/<util>.md`, one
`## <operation>` section per contract function).
`doc usage --lib python --path . --scaffold` writes the missing sections from the
cases the library passes. For the format, read the
[usage files](site/content/docs/contributing/usage-files.mdx) page of the site.

To run the check locally from a library checkout, use `npx tsx /path/to/doc/src/cli.ts check --lib
brazilian-utils-python --path . --tests`.

[`templates/lib-ci/port-with-claude.yml`](templates/lib-ci/port-with-claude.yml) is an optional
workflow. It gives the porting brief of the selected functions to a coding agent. The agent
implements them, changes the code until the shared tests pass and opens a PR for review.


## How it works

```
contract/*/contract.json ─┐
                          ├─► match (conventions + bindings) ─► signature check ─► shared tests ─► report
libs/*.json ──────────────┤         ▲
lib checkout ─► adapter.extract (native parser / reflection / scanner)
```

The validator reads each language with the standard tooling of its own ecosystem. This is the
view of the public API from the compiler or the runtime, never a parser written here. When the
toolchain is missing, the check fails and shows the install instruction. It does not guess.

| Language | API extraction (source of truth) | Types from | Shared tests |
|---|---|---|---|
| TypeScript | TypeScript compiler API / type checker ([ts-morph](https://github.com/dsherret/ts-morph)) | declarations, inferred | ✅ Node (tsx) |
| Python | [griffe](https://github.com/mkdocstrings/griffe) (mkdocstrings) + [griffe-warnings-deprecated](https://github.com/mkdocstrings/griffe-warnings-deprecated) for PEP 702 | annotations | ✅ |
| Go | [`go/packages`](https://pkg.go.dev/golang.org/x/tools/go/packages) + `go/types` (build constraints honored) | type-checked signatures | ✅ generated program in a `go.work` |
| Ruby | runtime reflection (what is actually callable) + [YARD](https://yardoc.org) for `@param`/`@return`/`@deprecated` | YARD tags | ✅ |
| Rust | rustdoc JSON (nightly), cross-checked against [cargo-public-api](https://github.com/cargo-public-api/cargo-public-api) | signatures | ✅ generated crate |
| .NET (F#, C#) | reflection on the compiled assembly, `NullabilityInfoContext`, portable PDB for lines | real types, incl. F#-inferred and C# `?` | ✅ generated F# project |
| Erlang | compiled `.beam`: `module_info(exports)` + `beam_lib` abstract code (specs, types) | `-spec` | ✅ `erlc` + escript |

Types stay structured from start to end. Each extractor converts the type objects that its tool
already has into one shared tree. These objects come from rustdoc JSON, `go/types`, the
TypeScript checker, griffe expressions, the type parser of YARD, Erlang abstract forms and
`System.Type`. The adapters map the tree to canonical types, and the runners use it to make
typed arguments. The validator parses no type text. Build metadata also comes from the tools
(`cargo metadata`, `go mod edit -json`, `dotnet msbuild -getProperty`,
`cargo build --message-format=json`).

Some adapters need tools in addition to the language itself (griffe, YARD, x/tools). The
validator pins these tools and installs them into the work dir, never into the environment of
the library.

To add a language, write one adapter file: [docs/adding-a-language.md](docs/adding-a-language.md).
For the contract and library config format, read [docs/contract.md](docs/contract.md).

## Layout

```
contract/        the shared contract: one folder per domain (kebab-case), contract.json with
                 functions and test cases, plus optional specs and references
libs/            one JSON per implementation: repo, language, bindings, ignores, waivers
baselines/       what conforms today, per lib (CI fails on regressions); _corpus.json = the mined inputs `diff` compares; _divergences.json = known splits
snapshots/       extracted public API per lib (API changes show up in PR diffs)
src/core/        contract, types, matching, signatures, conformance, diff, baselines
src/languages/   one adapter per language (+ helper scripts in the language itself)
src/reporters/   console, markdown, brief, HTML dashboard
test/            unit + integration tests, fixtures per language
action.yml       GitHub Action for the libs' CI
templates/       workflows and test harnesses to copy into each lib repo
site/            the docs site (Next.js + Fumadocs), built from all of the above
vercel.json      review deployments of the site on Vercel
```

## Development

```bash
npm run typecheck
npm test          # unit + extractor/runner integration tests (skips absent toolchains)
npm run lint      # contract + lib configs + formatting
```
