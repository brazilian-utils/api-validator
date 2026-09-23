# Go harness (brazilian-utils-go)

`apicontract/apicontract_test.go` goes at the same path in the lib: a test-only package
(`package apicontract_test`) that imports the lib's packages like a user would and runs the vendored
suite in `api-contract/` (found by walking up from the test file, so any cwd works). Only the
standard library (`encoding/json`, `regexp`, `testing`).

## Run

    go test ./...                                    # picked up by the lib's normal test command
    go test ./apicontract/ -v -run 'TestContract/cpf.isValid'
    API_CONTRACT_NETWORK=1 go test ./apicontract/    # also run `network: true` functions
    API_CONTRACT_NO_SKIP=1 go test ./apicontract/    # ignore skip.json (check what got fixed)

Tests: `TestContract/<case id>` (one subtest per case), `TestRegistryIDsExist` (registry ids
unknown to the suite fail), `TestEquality` (the comparator against `cases/equality.json`).
Go rewrites spaces in subtest names to `_`, and `/` in a case id splits `-run` patterns.

## Add a registry entry

One line in `registry`, grouped by domain, taking the case's JSON args (strings, `float64`
numbers, bools, `[]any`, `map[string]any`) and returning the result (converted to its JSON
form by `encoding/json` before comparing) or an error:

    "cpf.isValid": func(a []any) (any, error) { return cpf.IsValid(str(a, 0)), nil },

- `(T, error)` returns as-is: `return cep.GetAddressFromCEP(str(a, 0))` (a non-nil error
  satisfies `throws: true`; a nil pointer is `returns: null`).
- `(T, bool)`: return `nil, nil` when the bool is false.
- Required Go params the contract makes optional: `optStr(a, 0, "default")`.
- Arg helpers `str`, `num`, `optStr`, `strs` panic with an `argError` on a wrong JSON type:
  the case fails with "registry cannot pass these args" (never counted as a throw).
