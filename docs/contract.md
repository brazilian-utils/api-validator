# Contract reference

One YAML file per domain in `contract/`, named after the domain. Files starting with `_`
are ignored (e.g. `contract/_proposals/`). Validate with `api-validator lint`, format with
`api-validator fmt` (CI runs `fmt --check`).

```yaml
domain: legalProcess            # lowerCamelCase, = file name
title: Legal process            # optional
aliases: [processoJuridico]     # other names of the domain used by some libs
functions:
  isValid:                      # operation -> id "legalProcess.isValid"
    summary: Checks whether a legal process number (NUP) is valid.
    flatName: isValidLegalProcess   # facade name; default = operation + Domain
    aliases: [lawsuit.check]        # other domain.operation spellings in use
    level: core                     # core: every lib must have it; extended (default)
    network: false                  # true: calls a remote service (skipped in tests/diff by default)
    params:
      - { name: value, type: string }
      - { name: options, type: IsValidOptions, optional: true }
    returns: boolean
    tests:
      - { args: ["68476506020233030000"], returns: true }
      - { args: [""], returns: false }
      - { args: ["x"], throws: true }                     # must fail (exception / error value)
      - { args: [], matches: "^\\d{20}$", repeat: 3 }      # regex on a string result
      - { args: [], satisfies: legalProcess.isValid, repeat: 5 }  # result fed to another function must return true
      - { name: repeated-digits, args: ["0000"], returns: false, note: "why" }
```

## Canonical types

`string`, `integer`, `number`, `boolean`, `date`, `void`, `any`, `null`; `T?` (nullable),
`T[]`, `A | B`, literals (`"a"`, `1`, `true`), and named object types (`Address`) which are
compared only as "an object" across languages. Each language adapter maps its native types
to these; anything it cannot map is reported as unverified rather than wrong.

Signature rules (from the caller's point of view): a call written against the contract must
work — the lib may accept more (extra optional params, wider types) but not less; and every
value the lib may return must be allowed by the contract (`string?` vs `string` is a
warning in either direction).

## Test ids and values

A test's id is `<fn>#<name>` or `<fn>#<index>`; `knownFailures`/baselines refer to these,
so prefer `name` for hand-written vectors. Values are JSON: `null` stands for
`None`/`nil`/`undefined`/`Option::None`/`{error, _}`; objects compare keys
case/separator-insensitively (`zipCode` == `zip_code`) and absent == `null`.

Mined vectors (`api-validator diff --propose --unanimous --apply`) carry a `note` saying
which libs agreed.

## Lib config (`libs/<name>.yaml`)

```yaml
name: brazilian-utils-python
language: python             # adapter id or alias
repo: https://github.com/brazilian-utils/python
entry: brutils               # adapter-specific: package dir, entry file, src dir...
bindings:                    # contract id -> native symbol(s) when conventions don't find it
  state.getCodeByName: ibge.uf.convert_name_to_uf
ignore: ["*.sieve"]          # public symbols that are intentionally outside the contract
waivers:                     # contract functions this lib will not implement, with reason
  cep.getAddressInfo: "no network access in this runtime"
knownFailures:               # test (or function) ids expected to fail for now, with reason
  pis.isValid#repeated-digits: "fix in progress (#123)"
options: { namespace: BrazilianUtils }   # adapter options
```
