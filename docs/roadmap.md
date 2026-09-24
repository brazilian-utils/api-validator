# Roadmap

Use this page to see the plan and what each phase must deliver. Today, the validator measures
every library against one contract, in every language, for both API and behavior (see
[findings.md](findings.md)). The remaining work: make the tooling a routine of the
organization, and close the gaps that it shows. Each phase has an exit criterion, so progress
is a number, not an opinion.

## Phase 0: switch it on (days)

| Step | Who | How |
|---|---|---|
| Merge the PR of this repository | maintainers | CI runs typecheck, the tests with the language toolchains, contract lint |
| Publish the docs site | org admin | Enable GitHub Pages (source: GitHub Actions). Set the repository variable `PUBLISH_SITE=true` (and `SITE_URL` when a custom domain serves the site) |
| Turn on issue and test sync | org admin | Save a fine-grained token (or GitHub App) with `issues`, `contents` and `pull_requests: write` on every library repo as the secret `LIBS_TOKEN`. Do not give it the `workflows` permission |
| Optional: release notification | org admin | Save a token that can send `repository_dispatch` to the doc repository (`contents: write`) as the secret `DOC_DISPATCH_TOKEN` in each library, and add the step in [usage-files.mdx](../site/content/docs/contributing/usage-files.mdx#update-the-site-on-each-release) to its release workflow. A release then refreshes the site at once, not at the next nightly |
| Add the Action to every library | one PR per library | Copy `templates/lib-ci/<lang>.yml` to `.github/workflows/api-contract.yml`. Add the badge to the README |
| Add usage files to every library | one PR per library | Copy `site/fixtures/usage/<lib>/` (scaffolded from the cases each library passes) to `docs/usage/`. Cut the README down to a link to the site |
| Add the suite and the harness to every library | one PR per library | `doc export-cases --lib <lib> --path .` copies `api-contract/` into the library. Copy the harness of the library from `templates/harness/<lang>/` (already written and verified for every library) |
| Record the divergence baseline | maintainers | Run `doc diff --baseline` once. After that, the nightly fails only on *new* ways that libraries disagree |
| Optional: agent ports | org admin | Add the secret `ANTHROPIC_API_KEY` in the library repos that adopt `templates/lib-ci/port-with-claude.yml` |

**Done when** every library repo shows these items:

- the API contract check on their PRs
- the `api-contract` issues, opened and closed as the work moves
- a harness that runs the shared cases in their own test command
- a badge that links to their status page

## Phase 1: agree on the contract (1 to 2 weeks)

We bootstrapped the contract mechanically (JS names and types, consensus cases). It needs one
human review, and the open behavior questions need answers.

1. Decide the 3 confirmations and 9 decisions in [findings.md](findings.md). Encode each one
   as a case with a `note`. These are suggested defaults, open to discussion:
   - `isValid` accepts the usual masks (JS/Go/.NET already do, and every library can
     `parse`).
   - `format` of an invalid value returns `null` (the typed libraries already say
     `Option`/`None`).
   - Empty input to `format` gives `null`.
   - PIS of repeated digits is invalid (same rule as CPF/CNPJ).
2. Review names: `legalProcess` or `processoJuridico` (decided: every library
   exposes `parse`, with the name and the behavior of JS `parse*`), options objects or positional parameters
   (the contract can declare the positional form and let JS keep options as an extra).
3. Give every function test cases. `doc lint` lists the functions without any. Today,
   the validator checks only the name and signature of those functions. Then turn on
   `lint --strict`.
4. Review `level`. Today, `core` means "≥4 libs had it". Promote what every library must have,
   and leave the rest `extended`. Libraries `waive` what they skip on purpose.

**Done when** sections 1 and 2 of `docs/findings.md` are empty (everything is a case) and each
domain of the contract has had a review PR.

## Phase 2: close the core gaps (2 to 6 weeks, in parallel per library)

Each library works from its `api-contract` issues. Run the Conformance workflow once with
`backfill: core` to open one issue per missing core function and per failing case. Do the
missing core functions and failing cases first, then the signature errors. Briefs make each
item self-contained, so people and agents can work in parallel. Run
`doc baseline --tests` after each merge to lock in the gains.

**Done when** every library has 100% core coverage (or explicit waivers) and 0 failing cases,
and the badge is green everywhere.

## Phase 3: steady state (ongoing)

- **Contract-first rule**, enforced by CI: new public API outside the contract fails the check
  of the library. New features start as contract PRs. Bug fixes start as cases.
- **Conformance run on every merge and nightly:** sync, `check --tests`, `diff`, docs site,
  issues opened, updated or closed. When `diff` finds new divergences, they become decisions,
  then cases.
- **Releases:** tag the contract (`contract-v1.0`, ...) when a set of functions is stable.
  `doc changelog --from contract-v1.0 --to contract-v1.1` writes the release notes
  (new functions, signature changes, new and changed cases). Libraries write in their
  changelog which contract version they conform to. A library that wants to adopt contract
  changes on purpose can pin the Action to a tag.

## Phase 4: extended parity

JS implements 136 of the 138 contract functions. The others implement far less: in the run of September 2026, each of them passed 16 to 21% of the functions. Take the extended
functions one domain at a time (fiscal: NF-e, CFOP, NCM, CST. Banking: IBAN, bank, pix. IBGE:
state, municipality. Dates and holidays). For each domain, decide whether every library should
have it, and move those functions to `core`. The agent workflow is most useful here: many
functions, clear cases, existing reference implementations.

**Done when** every library implements or waives every contract function.

## Metrics to watch (dashboard)

- core coverage per library → 100%
- failing cases → 0. Skipped cases (the runner cannot express the call) → fewer over time
- divergent inputs in `diff` for core functions → 0. Known splits in `baselines/_divergences.json` → fewer over time
- functions without cases (`lint`) → 0
- public symbols outside the contract → 0 (all bound, proposed, or ignored)
