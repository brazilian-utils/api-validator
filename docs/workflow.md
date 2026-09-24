# Maintaining N implementations of one library

Use this page to learn how a change to the library reaches every implementation: one
repository per language, one library. We considered a code generator and rejected it
(too complex to make idiomatic output in every language). Porting every change by hand, once
per language, without a shared definition does not scale either. The libraries drift apart, fixes go
into one repo only, and nobody knows what is missing where.

This approach is **contract-first**. People write the libraries by hand, in the idiom of each
language. But every change goes through one shared, executable definition of the API. The
contract defines the API, and the libraries follow it. The tooling makes drift impossible to miss and cheap
to fix.

```
                    ┌──────────────────────────────────────────────┐
                    │ api-validator (this repo)                    │
                    │  contract/*/contract.json = names, in/out    │
                    │                     + shared test cases      │
                    └───────┬───────────────────────────▲──────────┘
             contract change│ merged                    │ PR: new function,
                            ▼                           │ new case (bug fix)
      ┌──────────────────────────────────┐              │
      │ Conformance workflow             │              │
      │  check --tests (every lib)       │      ┌───────┴────────┐
      │  diff (differential testing)     │      │ any lib repo   │
      │  issues: one per function per    │─────▶│ CI: the Action │
      │  lib (implement / fix), auto-close│     │ fails on       │
      └──────────────────────────────────┘      │ regressions &  │
                                                │ API outside    │
                                                │ the contract   │
                                                └────────────────┘
```

## The three guarantees

| You want | Mechanism | Where |
|---|---|---|
| Same API everywhere: names, inputs, outputs, in the idiom of each language | The contract declares `domain.operation` and canonical types. Each language adapter maps them to its idiom (`cpf.isValid` → `isValidCpf` / `cpf.is_valid` / `cpf.IsValid` / `CPFUtils.valid?`...) and checks the real signature extracted from source | `check` |
| Same logic everywhere | Shared test cases in the contract run unchanged in every language through a thin runner per language, **and** inside every library as a JSON suite that its own harness runs. `diff` gives the same mined inputs to all libraries and fails on any *new* disagreement | `check --tests`, `export-cases`, `diff --fail-on-new` |
| Libraries stay in sync (same functions, fixes propagated) | CI enforces the contract-first rule. Also, one issue per function per library, opened and closed automatically, with a porting brief | Action, `issue`, `brief` |

## The flows

### 1. Add a function

1. **Contract PR** (this repo): add the function to `contract/<domain>/contract.json` with its
   signature and test cases. If other libraries already have something similar, run
   `api-validator diff --fn '<domain>.*'` to see how they behave today.
2. The Conformance run of the PR shows which libraries have the function (usually none yet).
   It also **lists the issues that the merge will open**. Nothing breaks: missing functions
   are TODOs, not failures.
3. On merge, the pipeline opens an **`[api-contract] Implement <fn>` issue in every library
   that does not have the function**. The issue has a porting brief: the idiomatic name for
   that language, the signature, the acceptance tests, links to the status page of the
   function and to every existing implementation, and the reference source inline.
4. Each library implements the function. A person can do it, or a coding agent that gets the
   brief. The shared tests are the objective acceptance criterion, so the agent does not need
   to "understand" the other codebase. The CI of the library (the Action) shows that it
   passes.
5. Run `api-validator baseline` in this repo to lock it in. After that, if any library breaks
   the function, the CI of that library fails. The next nightly updates `api-contract/` in
   each library (bot PR), and the harness runs the new cases. The run that sees the function
   implemented **closes the issue of the library** with a comment that says so.

The first library that implements the function can also start the flow. Its CI fails with
"public but not in the contract" (see the rules below). This failure tells you to open the
contract PR with the cases that the library already tested.

### 2. Fix a bug

A bug in one library is probably in the others too (same algorithm, often ported from the same
source). So do these steps:

1. First, write the failing case as a **contract test case** (contract PR). That single case
   now runs against every library.
2. The Conformance run shows exactly which libraries have the bug. On merge, each affected
   library gets an **`[api-contract] Fix <fn>` issue** with the failing cases (expected and
   actual). The issue closes itself when every case of the function passes in that library.
3. Fix the bug in each library. The case keeps all of them correct from then on. It is also
   in every library's own test suite (copied, and skipped until that library is fixed).

`diff` often finds these bugs before users do. The first run of this repo found that four
libraries accept `"00000000000"` as a valid PIS. It also found that Python rejects CNHs that
the other libraries accept.

### 3. Behavior questions ("what *should* it return?")

`diff` shows the places where libraries disagree and there is no obvious right answer. For
example: does `isValid` accept a formatted CPF? Does `format` of an invalid value return
`null`, `""` or the input? You decide these questions once, in the contract, when you add the
case. For the current list, see [findings.md](findings.md). Until a library converges, it can
list the case under `knownFailures` in its `libs/<lib>.json` with the reason. This keeps the
case visible without a CI failure.

## Tests here and in the libraries

The contract cases run in two places, on purpose, from one source:

| | Through the validator (`check --tests`) | Inside the library (its harness over `api-contract/`) |
|---|---|---|
| Runs | here (nightly, contract PRs) and in the CI of the library through the Action | in the library's own test command: `npm test`, `python -m unittest`, `go test ./...`, `cargo test`, `rspec`, `rebar3 eunit`, `dotnet test` |
| Needs this repo | yes | no: a copied JSON suite and one test file in the language of the library |
| Good for | the view across libraries: same answer in every library, API and signature checks, the status pages of the docs site, issues, differential testing | the inner loop of the developer: a case fails in the `test` command they already run, and shows up in coverage and mutation testing |
| Kept correct by | baselines (ratchet) | `export-cases --check` in the Action, and a nightly bot PR that updates `api-contract/` |

**Why JSON and a hand-written harness, not generated test code.** The suite is data: one file
per domain, with no knowledge of any language (the model of JSON-Schema-Test-Suite and the
WHATWG URL tests). Each library owns a small harness, written once in its own idiom. The
harness has three parts:

- A registry from contract id to the function of the library. The registry adapts the idioms:
  options objects, `(T, bool)`, `Option`, `{ok, V}`.
- A loop over the cases.
- One shared set of comparison rules, checked by `cases/equality.json`.

So nobody here needs to know every test framework. A new language needs no code in this repo
to run the suite. To add a function to a library, you add one registry line. For typed
languages, the harness can also do *more* than the generated runners of the validator. It can
supply a default for an argument that Go or Rust requires. It can read a result type that the
runner cannot serialize.

Some tests stay **only in the library**: tests of internals and of surface specific to the
language (option objects, overloads, type-level tests, property tests with the generators of
the language, error messages). Some checks stay **only here**: API matching, control of the
public surface, differential testing, and anything about *comparing* libraries.

The library keeps the suite as a copy and never edits it. Fix a wrong expectation in
`contract/`. Fix a wrong behavior in the library. The `skip.json` of a library lists the cases
that it does not pass yet, with the reason (the last failure message). So the suite of the
library is green when the library adopts it. After a fix, the next update removes the entry,
and the case runs from then on.

## What runs automatically

| When | What | Fails on |
|---|---|---|
| Contract or library-config PR here | `lint`, `fmt --check`, `check --tests` on all libraries, `diff --fail-on-new`. The job summary shows the contract `changelog` and the issues that the merge will open | regressions, new divergences, invalid contract |
| Merge to main here | The same run on the merged contract. Then: an `Implement <fn>` issue in every library that does not have a function the merge added, and a `Fix <fn>` issue in every library that fails a case the merge added or changed | regressions, new divergences |
| Nightly here | All of the above on the default branch of every library. Then: build and publish the docs site (a page per utility and per library, badges, the JSON suite), update open issues and close the done ones. It opens no issues: `Fix` issues come from a merge that adds or changes cases, or from a manual run with `since` or `backfill`. Also open or update an `api-contract/cases` PR in every library whose `api-contract/` changed | regressions, new divergences |
| Every library push or PR | The Action: `check --tests` against the baseline and `export-cases --check`. The library's own test job runs its harness | regressions, public API outside the contract, (optionally) an old suite copy |

If the run of a merge fails before it opens its issues, run the Conformance workflow by hand with `since` set to the commit before the merge.

The site page [How the pipeline works](../site/content/docs/contributing/pipeline.mdx) describes each workflow, its secrets and what to do when it fails.

Nobody has to remember a step. A merged contract change reaches every library in these ways:

- as an issue per function (what to implement or fix, with a brief)
- as a PR (the new cases)
- on its status page
- as a new section of the docs site (the spec immediately, and the usage tab of each library
  when it arrives)

A new function, from start to end:

1. A contract PR adds the function to `contract/<domain>/contract.json` with its cases (and
   `spec.*.md` prose if it needs any). The `summary` and `description` of the function can be
   English only or bilingual (`{ "en": ..., "pt-BR": ... }`). The job summary of the PR shows
   the changelog and the issues that the merge will open.
2. The merge opens an `Implement <fn>` issue in every library that does not have the function,
   with the brief and the usage section to add. The site gets the function, and the tab of
   every library says "not implemented yet".
3. A library implements the function, registers it in its harness and adds `## <op>` to
   `docs/usage/<util>.md` (`usage --scaffold` writes it from the passing cases). On the next
   run, the issue closes itself. After the release of the library (`lib-released` dispatch),
   its tab shows the example.

## Where a library sees its status

The docs site (`site/`) shows the status. The badge in the README of every library links to
it.

- **Library page** (`/libs/<lib>/`): core coverage and passing cases, next to every other
  library. The work list, in this order: failing first, then signatures, then missing core,
  then extended. Inside each group, the order is by how many libraries already have each
  function. Failing cases with expected and actual values. Functions it implements without a
  usage example. Public API outside the contract.
- **Utility page** (`/utils/<util>/`): the spec. Then, for each function: its signature, a
  status chip per library (implemented, failing, missing), the description from the contract,
  a usage tab per library, and the shared cases with the result of each library.
- **Parity matrix**: utility × library.

The site computes everything from the contract, the usage files of the libraries and the
latest run. `api-validator site-data` writes `site/.generated/status.json`, which scripts can
also read.

## Rules that make it work

1. **Contract-first.** After a library has a baseline, a public function that is not in the
   contract is a CI failure in the library ("public but not in the contract"). You can bind it
   to an existing contract function (`bindings`), propose it in the contract, or mark it
   internal (`ignore`). Nothing reaches the users of one language without the others knowing.
2. **Every bug fix adds a case.** No case, no fix: the case is what propagates the fix.
3. **Ratchet, do not block.** CI fails only on regressions against `baselines/`. Libraries
   adopt the validator today and converge at their own pace. The issue shows the distance.
4. **Idioms are the job of the adapter, not of the contract.** Names, optional parameters
   (Go/Rust have none), `null` or `None` or `nil` or `{error, _}`, exceptions or error values:
   the contract uses one canonical language, and the adapters translate.
5. **Waivers are explicit.** A library that will not implement something on purpose says so in
   `waivers`, with a reason. So "missing" always means "not done yet".

## Day to day

| Who | Does |
|---|---|
| Library maintainer | Works from the `api-contract` issues (one per function) and the status page of the library. The CI of the library (Action) shows progress in the job summary |
| Contract maintainer | Reviews contract PRs. Runs `diff` for new domains. Decides behavior questions |
| Anyone | Runs `api-validator brief <fn> --lib <lib>` before porting something |
| Nightly job | Syncs all libraries, runs `check --tests` + `diff`, builds and publishes the docs site, updates issues, opens PRs that update the suite |
| New machine / new contributor | Runs `api-validator doctor`, which lists every toolchain that the configured libraries need and what is missing |

## Use a coding agent for the ports

The brief contains all that the agent needs: expected name, signature, test cases, reference
source. Use this loop for each library:

1. Give the agent one `api-contract` issue (or `api-validator brief <fn> --lib <lib>`).
2. Tell it to implement the function in the idiom of the language and to add the cases to the
   library's own test suite.
3. Tell it to run `api-validator check --lib <lib> --path . --tests --only '<fn>'` until the
   result is ok.
4. Review the result like any PR. The shared tests guarantee that the behavior matches, not
   the memory of the reviewer about the other six codebases.
