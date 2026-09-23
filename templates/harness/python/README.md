# Python harness (brazilian-utils/python)

Runs the vendored contract suite (`api-contract/`) with the lib's own `unittest` setup.
No dependencies beyond the standard library and `brutils`.

## Where it goes

Copy `tests/test_api_contract.py` to `tests/test_api_contract.py` in the lib, next to the
other `test_*.py` files. `api-contract/` must sit at the repo root; the harness finds it by
walking up from its own file, so it works from any working directory.

## Running

```sh
python -m unittest discover tests/          # whole suite (make test), harness included
python -m unittest tests.test_api_contract -v   # harness only, one line per case
python -m unittest tests.test_api_contract -k 'cpf.isValid'   # one function
API_CONTRACT_NETWORK=1 python -m unittest tests.test_api_contract   # include network functions
```

Each case is its own test method named `test_<case id>` (e.g.
`test_cpf.isValid#["83159562131"]`), grouped in one `TestCase` per domain
(`CpfContractTest`, ...). Skips are native unittest skips:

- contract function not in `REGISTRY` → one `not implemented` skip for the function;
- case id in `api-contract/skip.json` → skipped with its reason;
- `network: true` functions → skipped unless `API_CONTRACT_NETWORK=1`;
- `satisfies` target not in `REGISTRY` → skipped.

`ContractHarnessTest` also checks that every `REGISTRY` id exists in the suite and runs
`cases/equality.json` against the comparison function.

## Adding a registry entry

When brutils implements a contract function, add one line to `REGISTRY` in its domain group:

```python
"cnh.format": call(brutils.format_cnh),
```

`call(fn)` passes the case's JSON `args` positionally. If the brutils signature differs from
the contract (options object, different order, ...), write the adaptation inline, e.g. a
contract options object mapped to keyword arguments (pattern, field names illustrative):

```python
"x.generate": lambda a: brutils.generate_x(**(a[0] if a else {})),
```

Do not register a function whose signature is incompatible with the contract (the
validator's `sig` status) without such an adaptation: its cases would fail.

The entry must return a value whose JSON form (see `to_json`) matches the contract, return
`None` for "no result", or raise for "throws".
