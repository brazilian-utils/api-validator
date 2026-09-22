# API Validator

Keeps the [brazilian-utils](https://github.com/brazilian-utils) implementations —
JavaScript/TypeScript, Python, Go, Rust, Ruby, Erlang and .NET — one library in seven
languages.

- **Same API**: one language-agnostic contract (`contract/*.yaml`) declares every function,
  its inputs and outputs; each language adapter checks the real, extracted API against it
  in that language's idiom (`cpf.isValid` → `isValidCpf` · `cpf.is_valid` · `cpf.IsValid` ·
  `CPFUtils.valid?` · `brutils:is_valid_cpf/1` · `Cpf.IsValid`).
- **Same behaviour**: the contract carries shared test vectors that run, unchanged, against
  every lib; differential testing feeds the same mined inputs to all libs and reports every
  disagreement.
- **In sync**: CI in each lib fails on regressions and on public API added outside the
  contract; every lib repo gets an auto-maintained issue with a porting brief for each
  missing or failing function.

See **[docs/workflow.md](docs/workflow.md)** for the maintenance workflow and
**[docs/findings.md](docs/findings.md)** for what the first run found.

## Quick start

```bash
npm ci
npx tsx src/cli.ts sync            # clone/update every lib into .repos/
npx tsx src/cli.ts check --tests   # contract + shared tests for all libs
open output/index.html             # dashboard; output/<lib>.md = TODO list per lib
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
| `diff [--fn 'cpf.*']` | Differential testing across libs; `--propose [--unanimous] [--apply]` turns agreed answers into contract tests |
| `probe <fn> <args...>` | Call one function with the same args in every lib, side by side |
| `baseline [--tests]` | Record what conforms now; CI then fails only when it stops conforming |
| `extract` | Write `snapshots/<lib>.api.json` (public API as extracted) |
| `suggest -l <lib>` | YAML bindings for symbols that look like contract functions under other names |
| `lint` / `fmt [--check]` | Validate / canonically format the contract and lib configs |

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

Add a job to the lib repository (after installing its toolchain and dependencies):

```yaml
# .github/workflows/api-contract.yml
name: API contract
on: [push, pull_request]
jobs:
  contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... set up the language and install dependencies, as for the lib's own tests ...
      - uses: brazilian-utils/api-validator@main
        with:
          library: brazilian-utils-python   # name in libs/
          # tests: "true"                   # run the shared tests (default)
          # fail-on: regression             # regression | error | never
```

The job summary shows the lib's TODO list. It fails when something in the lib's baseline
stops conforming, or when a new public function appears that the contract does not know.

Locally, from a lib checkout: `npx tsx /path/to/api-validator/src/cli.ts check --lib
brazilian-utils-python --path . --tests`.

## How it works

```
contract/*.yaml ──┐
                  ├─► match (conventions + bindings) ─► signature check ─► shared tests ─► report
libs/*.yaml ──────┤         ▲
lib checkout ─► adapter.extract (native parser / reflection / scanner)
```

| Language | API extraction | Types from | Shared tests |
|---|---|---|---|
| TypeScript | TypeScript type checker (ts-morph) | declarations, inferred | ✅ Node (tsx) |
| Python | `ast` (no import needed) | annotations | ✅ |
| Go | `go/parser` | signatures | ✅ generated program in a `go.work` |
| Rust | module-tree scanner (`mod`, `pub use`, `#[cfg(test)]`, `pub(crate)`) | signatures | ✅ generated crate |
| Ruby | runtime reflection | YARD tags | ✅ |
| Erlang | `-export` / `-spec` / `-type` parser | specs | — (contributions welcome) |
| .NET (F#, C#) | module/indentation scanner | annotations | — (contributions welcome) |

Adding a language is one adapter file: [docs/adding-a-language.md](docs/adding-a-language.md).
Contract and lib config format: [docs/contract.md](docs/contract.md).

## Layout

```
contract/        the shared contract, one YAML per domain (+ tests)
libs/            one YAML per implementation: repo, language, bindings, ignores, waivers
baselines/       what conforms today, per lib (CI fails on regressions)
snapshots/       extracted public API per lib (API changes show up in PR diffs)
src/core/        contract, types, matching, signatures, conformance, diff, baselines
src/languages/   one adapter per language (+ helper scripts in the language itself)
src/reporters/   console, markdown, brief, HTML dashboard
test/            unit + integration tests, fixtures per language
action.yml       GitHub Action for the libs' CI
```

## Development

```bash
npm run typecheck
npm test          # unit + extractor/runner integration tests (skips absent toolchains)
npm run lint      # contract + lib configs + formatting
```
