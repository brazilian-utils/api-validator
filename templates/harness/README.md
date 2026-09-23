# Harnesses

One per lib, written once in the lib's language, verified against the real lib: natively it
passes exactly the cases `api-validator check --tests` passes, and with `API_CONTRACT_NO_SKIP=1`
it fails exactly the ones the validator fails. Spec: [docs/harness.md](../../docs/harness.md).

Adopting it in a lib (one PR):

```bash
cd <lib checkout>
git apply <api-validator>/templates/harness/<lang>/adoption.patch    # harness (+ project wiring)
npx tsx <api-validator>/src/cli.ts export-cases --lib <lib> --path .  # vendors api-contract/
<the lib's test command>                                              # runs every case
```

From then on the nightly api-validator run keeps `api-contract/` current with a bot PR, and
adding a function to the lib means one more registry line in the harness.

| Lang | Harness | Wiring in the patch |
|---|---|---|
| javascript | `src/api-contract.test.ts` | `api-contract` in the formatter's `ignorePatterns` |
| python | `tests/test_api_contract.py` | — |
| go | `apicontract/apicontract_test.go` | — |
| rust | `tests/api_contract.rs` | `[[test]] harness = false` in `Cargo.toml` |
| ruby | `spec/api_contract_spec.rb` | — |
| erlang | `test/brutils_api_contract_tests.erl` | — (JSON decoder fallback for OTP < 27 inside) |
| dotnet | `BrazilianUtils.Tests/ApiContractTests.fs` | `<Compile Include>` in the test project |
