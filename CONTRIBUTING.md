# Contributing

This repository holds the shared contract of the brazilian-utils libraries and the tooling
that checks every implementation against it. Read [docs/workflow.md](docs/workflow.md) first.

## Changing the contract

The contract defines the names, inputs, outputs and behavior. The libraries follow it.

- **New function:** add it to `contract/<domain>/contract.json` with a `summary`, `params`, `returns`
  and test cases. If a library already has it, run `npx tsx src/cli.ts diff --fn '<domain>.*'`
  to see how the existing implementations behave before writing the cases.
- **Bug fix in any library:** add the case that exposes the bug here first. It then runs against
  every library, which is how the fix reaches the other six.
- **Behavior decision** (see [docs/findings.md](docs/findings.md)): add the case with a
  `note` saying what was decided and why.
- **Names:** the contract uses `domain.operation` in camelCase; each language adapter derives
  the idiomatic name. A library that uses another name gets a `bindings` entry in `libs/<lib>.json`;
  a name several libraries share can become a contract `aliases` entry instead.

Then `npx tsx src/cli.ts fmt && npm run lint`, and open the PR. The Conformance job on the PR
shows which libraries are affected and the contract changelog; nothing fails for functions libraries
have not implemented yet. Every function needs test cases: `lint` lists the ones without.
After merge, the pipeline opens an `Implement`/`Fix` issue in every affected library, updates the status pages, and opens a
PR refreshing its `api-contract/` copy of the suite.

## Changing a library config

`libs/<lib>.json`: `bindings` for irregular names, `ignore` for public symbols that are
deliberately outside the contract, `waivers` for functions a library will not implement (with the
reason), `knownFailures` for cases a library is known to fail while the fix is in progress.

## Updating baselines

After libraries improve, lock the gains in so they cannot regress:

```bash
npx tsx src/cli.ts sync
npx tsx src/cli.ts baseline --tests
npx tsx src/cli.ts diff --baseline   # known splits between libraries; the nightly fails only on new ones
```

## Changing the tooling

`npx tsx src/cli.ts doctor` shows which toolchains are missing. Then
`npm run typecheck && npm test && npm run lint`. Tests skip languages whose toolchain is not
installed; CI installs all seven. Adding a language: [docs/adding-a-language.md](docs/adding-a-language.md).
