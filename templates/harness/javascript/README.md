# JavaScript/TypeScript harness (brazilian-utils-javascript)

`src/api-contract.test.ts` goes at the same path in the lib, next to `src/index.test.ts`. The lib's
normal test command picks it up, and it imports the utils from the public entry (`./index`) the way
a user would. It uses the lib's cross-runtime test shim (`./_internals/test/runtime`), so the same
file runs under Vitest (`vp test`) and Bun. Deno should work too, but it has not been tried.
There are no new dependencies.

The vendored suite is loaded with `import(\`../api-contract/cases/${name}.json\`, { with: { type:
"json" } })`. That path is relative to the test file, so it works from any cwd and needs no
`node:fs`. It also works in Vitest's browser mode. Vite's dynamic-import-vars supports only one
variable path segment, which is why there are two loaders: `cases/<name>` and `<name>` (for
`skip.json`). Domains come from `cases/index.json` → `domains` because there is no directory
listing.

Where the file sits was checked against the lib's tooling:

- It is not in a `src/<dir>/` folder, so it is not a subpath build entry (`vite.config.ts`).
- knip treats it as a test entry.
- jsr and api-extractor exclude `*.test.ts`.
- The coverage config excludes `src/**/*.test.ts`.

## Run

    npx vp test run src/api-contract.test.ts          # also part of `npm test` / `vp test`
    npx vp test run src/api-contract.test.ts -t 'cpf.isValid'
    bun test src/api-contract.test.ts                 # `npm run test:bun` runs it too
    API_CONTRACT_NETWORK=1 npx vp test run src/api-contract.test.ts   # also run `network: true` functions
    API_CONTRACT_NO_SKIP=1 npx vp test run src/api-contract.test.ts   # ignore skip.json (see what got fixed)

Each case is its own test, titled with the case id, under `api contract > <function id>`. A skipped
case sits inside a skipped `describe` named by the reason (`not implemented`,
`skip.json: <reason>`, …). The shim has `describe.skip` but no `test.skip`.

There are also two other checks:

- `every registry id is a contract function`: a registry id the suite doesn't know fails.
- `equality self-test (cases/equality.json)`: runs `jsonEqual` against every pair.

## Add a registry entry

Add one line to `REGISTRY`, in its domain group, and add the util to the `./index` import:

    "cpf.isValid": positional(isValidCpf),

`positional(fn)` spreads the case's JSON `args` as positional parameters. Use it when the util's
parameters line up with the contract's `params`, including an options object passed as an argument.
Write an adapter by hand when they don't, or when `positional` would pick a deprecated overload.
For example:

    "ie.isValid": ([params]) => isValidIe(params as unknown as IsValidIeParams),

The result can be a promise, and the harness awaits it. The harness converts the result to its JSON
form before it compares (`Date` becomes an ISO string, `Map` an object, `Set` an array, and
`undefined` becomes `null`). A thrown error or a rejected promise satisfies `throws: true`.
