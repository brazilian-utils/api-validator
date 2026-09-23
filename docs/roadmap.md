# Roadmap

Where we are: every lib is measured against one contract, in all seven languages, for both
API and behaviour (see [findings.md](findings.md)). What remains is turning the tooling into
the org's routine and closing the gaps it shows. Each phase has an exit criterion so
progress is a number, not an opinion.

## Phase 0 — switch it on (days)

| Step | Who | How |
|---|---|---|
| Merge this repository's PR | maintainers | CI runs typecheck, tests with all 7 toolchains, contract lint |
| Publish the status site | org admin | enable GitHub Pages (source: GitHub Actions), set repository variables `PUBLISH_DASHBOARD=true` and `SITE_URL` |
| Turn on issue + test sync | org admin | a fine-grained token (or GitHub App) with `issues`, `contents` and `pull_requests: write` on the 7 lib repos, saved as secret `LIBS_TOKEN` |
| Add the Action to every lib | one PR per lib | copy `templates/lib-ci/<lang>.yml` to `.github/workflows/api-contract.yml`; add the badge to the README |
| Add the suite + harness to every lib | one PR per lib | `api-validator export-cases --lib <lib> --path .` vendors `api-contract/`; copy the lib's harness from `templates/harness/<lang>/` (already written and verified for all 7 libs) |
| Record the divergence baseline | maintainers | `api-validator diff --baseline` once; from then on the nightly fails only on *new* ways libs disagree |
| Optional: agent ports | org admin | secret `ANTHROPIC_API_KEY` in lib repos that adopt `templates/lib-ci/port-with-claude.yml` |

**Done when** all 7 lib repos show the API contract check on their PRs, the `api-contract` issues flowing,
a harness running the shared cases in their own test command, and a badge linking to their
status page.

## Phase 1 — agree on the contract (1–2 weeks)

The contract was bootstrapped mechanically (JS names and types, consensus vectors). It
needs one human pass, and the open behaviour questions need answers.

1. Decide the 3 confirmations and 9 decisions in [findings.md](findings.md); encode each as a
   vector with a `note`. Suggested defaults, to argue with: `isValid` accepts the usual masks
   (JS/Go/.NET already do, and every lib has `removeSymbols`); `format` of an invalid value
   returns `null` (the typed libs already say `Option`/`None`); empty input to `format` is
   `null`; PIS of repeated digits is invalid (same rule as CPF/CNPJ).
2. Review names: `legalProcess` vs `processoJuridico`, `removeSymbols` vs JS `parse*`
   (different semantics: keep both, or pick one), options objects vs positional parameters
   (the contract can declare the positional form and let JS keep options as an extra).
3. Give every function test vectors: `api-validator lint` lists the functions without any
   (only the name and signature of those are checked today). Then turn on `lint --strict`.
4. Review `level`: `core` is currently "≥4 libs had it". Promote what every lib must have,
   leave the rest `extended`; libs `waive` what they deliberately skip.

**Done when** `docs/findings.md` sections 1–2 are empty (everything is a vector) and the
contract has had a review PR per domain.

## Phase 2 — close the core gaps (2–6 weeks, parallel per lib)

Each lib works from its `api-contract` issues (run the Conformance workflow once with `backfill: core` to open one per missing core function and failing vector): missing core functions and failing vectors
first, then signature errors. Briefs make each item self-contained, so this parallelises
across people and agents. `api-validator baseline --tests` after each merge locks gains in.

**Done when** every lib has core coverage 100% (or explicit waivers) and 0 failing vectors;
the badge is green everywhere.

## Phase 3 — steady state (ongoing)

- **Contract-first rule** enforced by CI (new public API outside the contract fails the lib's
  check). New features start as contract PRs; bug fixes start as vectors.
- **Every merge + nightly** Conformance run: sync, `check --tests`, `diff`, status site, issues opened/refreshed/closed. New
  divergences found by `diff` become decisions, then vectors.
- **Releases:** tag the contract (`contract-v1.0`, ...) when a set of functions is stable;
  `api-validator changelog --from contract-v1.0 --to contract-v1.1` writes the release notes
  (new functions, signature changes, new and changed vectors).
  Libs note in their changelog which contract version they conform to, and the Action can
  be pinned to a tag in libs that want to adopt contract changes deliberately.

## Phase 4 — extended parity

JS implements ~92% of the 147 functions; the others 19–30%. Take the extended functions
domain by domain (fiscal: NF-e, CFOP, NCM, CST; banking: IBAN, bank, pix; IBGE: state,
municipality; dates and holidays), decide per domain whether every lib should have it, and
move those to `core`. The agent workflow is most useful here: many functions, clear vectors,
existing reference implementations.

**Done when** every lib implements or waives every contract function.

## Metrics to watch (dashboard)

- core coverage per lib → 100%
- failing vectors → 0; skipped vectors (runner can't express the call) → shrinking
- divergent inputs in `diff` for core functions → 0; known splits in `baselines/_divergences.json` → shrinking
- functions without vectors (`lint`) → 0
- public symbols outside the contract → 0 (all bound, proposed, or ignored)
