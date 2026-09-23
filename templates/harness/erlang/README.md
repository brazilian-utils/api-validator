# Erlang harness (brazilian-utils-erlang)

`test/brutils_api_contract_tests.erl` goes at the same path in the lib: an EUnit module, so
`rebar3 eunit` picks it up with the rest of the suite. It runs the vendored suite in
`api-contract/`, which it finds by walking up from the module's source path (as recorded by the
compiler), its beam and the cwd, so any cwd works. It uses only OTP (`eunit`, `re`, `file`) and
no test dependency.

**JSON:** OTP's `json` module only exists from OTP 27, and the lib supports 25-27
(`minimum_otp_vsn`, CI matrix). The lib has no JSON dependency and adding one was ruled out.
So the module uses `json:decode/1` when it exists and otherwise a small RFC 8259 decoder of
about 70 lines that returns the same term shapes (binaries, maps with binary keys, `null`).
Delete the decoder once `minimum_otp_vsn` is 27.

## Run

    rebar3 eunit --module=brutils_api_contract_tests    # also part of plain `rebar3 eunit`
    API_CONTRACT_NETWORK=1 rebar3 eunit ...             # also run `network: true` functions
    API_CONTRACT_NO_SKIP=1 rebar3 eunit ...             # ignore skip.json (check what got fixed)
    API_CONTRACT_DIR=/path/to/api-contract ...          # use another copy of the suite

Without rebar3:

    mkdir -p /tmp/b && erlc +debug_info +warnings_as_errors -o /tmp/b src/*.erl test/brutils_api_contract_tests.erl
    erl -noshell -pa /tmp/b -eval 'eunit:test(brutils_api_contract_tests, [verbose]), halt().'

Tests:
- `contract_test_/0` has one group per contract function and one test per case, titled with
  the case id.
- `registry_ids_are_in_the_suite_test/0` fails when the registry has an id the suite does not
  know.
- `equality_self_test_/0` checks the comparator against `cases/equality.json`.

**Skips:** EUnit has no skipped status. A skipped function or case is an empty group titled
`SKIPPED <id>: <reason>`. It appears in `verbose` output, runs nothing and is not counted as
passed or failed. A passing placeholder test would inflate the pass count, and a failing one
would break CI, so neither was used.

## Add a registry entry

Add one line to `registry/0`, grouped by domain. The value is a fun with the same arity as the
case's `args`:

    {<<"cpf.isValid">>, fun brutils:is_valid_cpf/1},

- Args arrive as JSON terms: strings are binaries, `null` is `undefined`, objects are maps
  with binary keys.
- The result is compared in JSON form: `{ok, V}` is unwrapped and `{error, _}` is "no result",
  which satisfies both `returns: null` and `throws`. An exception also satisfies `throws`.
  Atoms become strings, tuples become arrays and map keys become strings.
- An idiom that needs adapting goes in its own fun, for example
  `fun(V) -> brutils_phone:is_valid(V, mobile) end`.
- A case with a different number of args than the fun's arity is skipped. This matches the
  api-validator, which calls `M:F/length(Args)`.
