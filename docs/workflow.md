# Maintaining N implementations of one library

Seven repositories, seven languages, one library. A code generator was considered and
rejected (too complex for idiomatic output in every language). Hand-porting every change
six times without a shared definition does not scale either: libs drift, fixes land in one
repo only, and nobody knows what is missing where.

The approach here is **contract-first**: the libraries are written by hand, idiomatically,
but every change goes through one shared, executable definition of the API. The contract
is the single source of truth; the tooling makes drift impossible to miss and cheap to fix.

```
                    ┌──────────────────────────────────────────────┐
                    │ api-validator (this repo)                    │
                    │  contract/*.yaml  = names + input/output     │
                    │                     + shared test vectors    │
                    └───────┬───────────────────────────▲──────────┘
             contract change│ merged                    │ PR: new function,
                            ▼                           │ new vector (bug fix)
      ┌──────────────────────────────────┐              │
      │ Conformance workflow             │              │
      │  check --tests (all 7 libs)      │      ┌───────┴────────┐
      │  diff (differential testing)     │      │ any lib repo   │
      │  issue --lib X → "api-contract"  │─────▶│ CI: the Action │
      │  issue in every lib repo         │      │ fails on       │
      └──────────────────────────────────┘      │ regressions &  │
                                                │ API outside    │
                                                │ the contract   │
                                                └────────────────┘
```

## The three guarantees

| You want | Mechanism | Where |
|---|---|---|
| Same API everywhere: names, inputs, outputs, in each language's idiom | The contract declares `domain.operation` + canonical types; each language adapter maps them to its idiom (`cpf.isValid` → `isValidCpf` / `cpf.is_valid` / `cpf.IsValid` / `CPFUtils.valid?`...) and checks the real signature extracted from source | `check` |
| Same logic everywhere | Shared test cases in the contract run unchanged in every language through a thin per-language runner, **and** inside every lib as a JSON suite its own harness runs; `diff` feeds the same mined inputs to all libs and fails on any *new* disagreement | `check --tests`, `export-cases`, `diff --fail-on-new` |
| Libs stay in sync (same functions, fixes propagated) | Contract-first rule enforced by CI + an auto-maintained "api-contract" issue in every repo with a porting brief per missing/failing item | Action, `issue`, `brief` |

## The flows

### 1. Adding a function

1. **Contract PR** (this repo): add the function to `contract/<domain>.yaml` with its
   signature and test vectors. Run `api-validator diff --fn '<domain>.*'` if other libs
   already have something similar, to see how they behave today.
2. The PR's Conformance run shows which libs have it (usually none yet). Nothing breaks:
   missing functions are TODOs, not failures.
3. On merge, every lib's `api-contract` issue gains an item with a **porting brief**:
   idiomatic name for that language, signature, the acceptance tests, links to every
   existing implementation and the reference source inline.
4. Each lib implements it (a person, or a coding agent handed the brief: the shared tests
   are the objective acceptance criterion, so the agent does not need to "understand" the
   other codebase). The lib's CI (the Action) shows it passing.
5. `api-validator baseline` in this repo locks it in: from now on, breaking it in any lib
   fails that lib's CI. The next nightly refreshes each lib's `api-contract/` (bot PR), and
   its harness runs the new cases.

The first lib to implement it can also start the flow: its CI fails with
"public but not in the contract" (see rule below), which is the prompt to open the
contract PR with the vectors it already tested.

### 2. Fixing a bug

A bug found in one lib is most likely in the others too (same algorithm, often ported from
the same source). So:

1. Write the failing case as a **contract test vector** first (contract PR). That single
   vector now runs against all seven libs.
2. The Conformance run shows exactly which libs have the bug. On merge, each affected
   lib's issue lists the failing vector with expected vs actual.
3. Fix in each lib; the vector keeps all of them honest forever: it is in every lib's own
   test suite too (vendored, skipped until that lib is fixed).

`diff` often finds these before users do: this repo's first run found that four libs
accept `"00000000000"` as a valid PIS, and that Python rejects CNHs the other libs accept.

### 3. Behaviour questions ("what *should* it return?")

`diff` surfaces places where libs disagree and there is no obvious right answer (does
`isValid` accept a formatted CPF? does `format` of an invalid value return `null`, `""`
or the input?). These are decided once, in the contract, by adding the vector — see
[findings.md](findings.md) for the current list. Until a lib converges, it can list the
vector under `knownFailures` in its `libs/<lib>.yaml` with the reason, which keeps it
visible without failing CI.

## Tests: here, and in the libs too

The contract cases run in two places, on purpose, from one source:

| | Via the validator (`check --tests`) | Inside the lib (its harness over `api-contract/`) |
|---|---|---|
| Runs | here (nightly, contract PRs) and in the lib's CI through the Action | in the lib's own test command: `npm test`, `python -m unittest`, `go test ./...`, `cargo test`, `rspec`, `rebar3 eunit`, `dotnet test` |
| Needs this repo | yes | no: a vendored JSON copy + one test file in the lib's language |
| Good for | the cross-lib view: same answer in all 7 libs, API/signature checks, the status site, issues, differential testing | the developer's inner loop: a case fails in the `test` command they already run, shows up in coverage and mutation testing |
| Kept honest by | baselines (ratchet) | `export-cases --check` in the Action + a nightly bot PR refreshing `api-contract/` |

**Why JSON + a hand-written harness, not generated test code.** The suite is data — one
file per domain, no knowledge of any language (the model of JSON-Schema-Test-Suite and the
WHATWG URL tests). Each lib owns a small harness written once in its own idiom: a registry
from contract id to its function (where idioms are adapted: options objects, `(T, bool)`,
`Option`, `{ok, V}`), a loop over the cases, and one shared set of comparison rules (checked
by `cases/equality.json`). Nobody here needs to know seven test frameworks, a new language
needs no code in this repo to run the suite, and adding a function to a lib is one registry
line. The harness is also *more* capable than the validator's generated runners for typed
languages: it can supply a default for an argument Go or Rust requires, or read a result
type the runner cannot serialise.

What stays **only in the lib**: tests of internals and language-specific surface (option
objects, overloads, type-level tests, property tests with the language's own generators,
error messages). What stays **only here**: API matching, public-surface control,
differential testing, and anything about *comparing* libs.

The suite is vendored, never edited: a wrong expectation is fixed in `contract/`, a wrong
behaviour in the lib. Cases a lib does not pass yet are listed in its `skip.json` with the
reason (the last failure message), so the lib's suite is green on adoption; the refresh after
a fix drops the entry and the case runs from then on.

## What runs automatically

| When | What | Fails on |
|---|---|---|
| Contract / lib-config PR here | `lint`, `fmt --check`, `check --tests` on all libs, `diff --fail-on-new`, contract `changelog` in the job summary | regressions, new divergences, invalid contract |
| Nightly here | all of the above on every lib's default branch, then: publish the status site (a page per lib and per function, badges, the JSON suite), sync the `api-contract` issue in every lib, and open/update an `api-contract/cases` PR in every lib whose `api-contract/` changed | regressions, new divergences |
| Every lib push/PR | the Action: `check --tests` against the baseline + `export-cases --check`; the lib's own test job runs its harness | regressions, public API outside the contract, (optionally) a stale suite copy |

Nothing needs a person to remember a step: a merged contract change reaches every lib as an
issue item (what to implement or fix, with a brief), as a PR (the new cases), and on its
status page.

## Where a lib sees how it stands

The status site, linked from the badge in every lib's README:

- **lib page**: core coverage and cases passing next to every other lib; the work list
  (failing first, then signatures, then missing core, then extended — ordered by how many libs
  already have each function); failing cases with expected vs actual; public API outside the
  contract; inputs where it answers differently from the others.
- **function page**: the spec (summary, description, references), the implementation in each
  lib with a link to its source, a case × lib matrix, failures, divergences, and the reference
  implementation's source.

Everything on it is computed from the contract and the nightly reports (`api-validator site`);
the same data is in `api/libs/<lib>.json` for scripts.

## Rules that make it work

1. **Contract-first.** A public function that is not in the contract is a CI failure in
   the lib ("public but not in the contract") once the lib has a baseline. Either bind it
   to an existing contract function (`bindings`), propose it in the contract, or mark it
   internal (`ignore`). Nothing reaches users of one language without the others hearing.
2. **Every bug fix adds a vector.** No vector, no fix: that is what propagates it.
3. **Ratchet, don't block.** CI fails only on regressions against `baselines/`. Libs adopt
   the validator today and converge at their own pace; the issue shows the distance.
4. **Idioms are the adapter's job, not the contract's.** Names, optional parameters
   (Go/Rust have none), `null` vs `None` vs `nil` vs `{error, _}`, exceptions vs error
   values: the contract speaks one canonical language, adapters translate.
5. **Waivers are explicit.** A lib that deliberately won't implement something says so in
   `waivers` with a reason, so "missing" always means "not done yet".

## Day to day

| Who | Does |
|---|---|
| Lib maintainer | Works from the `api-contract` issue; the lib CI (Action) shows progress in the job summary |
| Contract maintainer | Reviews contract PRs; runs `diff` for new domains; decides behaviour questions |
| Anyone | `api-validator brief <fn> --lib <lib>` before porting something |
| Nightly job | Syncs all libs, runs `check --tests` + `diff`, publishes the status site, refreshes issues, opens suite-refresh PRs |
| New machine / new contributor | `api-validator doctor` lists every toolchain the configured libs need and what is missing |

## Using a coding agent for the ports

The brief is written to be sufficient on its own: expected name, signature, test vectors,
reference source. A good loop per lib:

1. Give the agent the lib's `api-contract` issue (or `api-validator brief <fn> --lib <lib>`).
2. Ask it to implement idiomatically, add the vectors to the lib's own test suite, and run
   `api-validator check --lib <lib> --path . --tests --only '<fn>'` until it is ok.
3. Review like any PR. The shared tests, not the reviewer's memory of the other six
   codebases, are what guarantee the behaviour matches.
