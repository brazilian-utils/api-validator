# Contract reference

One JSON file per domain in `contract/`, named after the domain. Files starting with `_` are
ignored (e.g. `contract/_proposals/`). Validate with `api-validator lint`, format with
`api-validator fmt` (CI runs `fmt --check`). Every file points at `schema/contract.schema.json`,
so editors (VS Code, JetBrains…) validate and autocomplete it as you type.

`fmt` keeps one test case per line, and writes multi-line text (`description`) as an array of
lines, so a file reads like this:

```json
{
  "$schema": "../schema/contract.schema.json",
  "domain": "legalProcess",
  "title": "Legal process (número único de processo, CNJ)",
  "aliases": ["processoJuridico"],
  "functions": {
    "isValid": {
      "summary": "Checks whether a legal process number (NUP) is valid.",
      "description": [
        "Validates the 20-digit number: check digits (ISO 7064 MOD 97-10), segment and court.",
        "",
        "- Accepts the formatted form `NNNNNNN-DD.AAAA.J.TR.OOOO`."
      ],
      "references": ["https://atos.cnj.jus.br/atos/detalhar/119"],
      "flatName": "isValidLegalProcess",
      "aliases": ["lawsuit.check"],
      "level": "core",
      "params": [
        { "name": "value", "type": "string" },
        { "name": "options", "type": "IsValidOptions", "optional": true }
      ],
      "returns": "boolean",
      "tests": [
        { "args": ["68476506020233030000"], "returns": true },
        { "args": [""], "returns": false },
        { "args": ["x"], "throws": true },
        { "args": [], "matches": "^\\d{20}$", "repeat": 3 },
        { "args": [], "satisfies": "legalProcess.isValid", "repeat": 5 },
        { "name": "repeated-digits", "args": ["0000"], "returns": false, "note": "why this case matters" }
      ]
    }
  }
}
```

| Field | Meaning |
|---|---|
| `domain` | lowerCamelCase, same as the file name |
| `aliases` (domain) | other names of the domain some libs use |
| function key | the operation: `isValid` → id `legalProcess.isValid` |
| `summary` | one sentence |
| `description` | the language-neutral spec (markdown; string or array of lines): rules, edge cases, bad input |
| `references` | official sources (laws, manuals, specs) |
| `flatName` | facade name; default = operation + Domain (`isValidLegalProcess`) |
| `aliases` (function) | other `domain.operation` spellings in use |
| `level` | `core`: every lib must have it; `extended` (default) |
| `network` | `true`: calls a remote service (skipped in tests and diff by default) |
| `params`, `returns` | canonical types (below); `optional: true` for optional params |
| `tests[]` | args + exactly one of `returns` (any JSON value), `throws: true` (must fail), `matches` (regex on a string result), `satisfies` (result fed to that function must return `true`); optional `name`, `repeat`, `note` |

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

## Lib config (`libs/<name>.json`)

Validated by `schema/lib.schema.json`.

```json
{
  "$schema": "../schema/lib.schema.json",
  "name": "brazilian-utils-python",
  "language": "python",
  "notes": "Free text for maintainers (JSON has no comments).",
  "repo": "https://github.com/brazilian-utils/python",
  "entry": "brutils",
  "options": { "namespace": "BrazilianUtils" },
  "bindings": { "state.getCodeByName": "ibge.uf.convert_name_to_uf" },
  "ignore": ["*.sieve"],
  "waivers": { "cep.getAddressInfo": "no network access in this runtime" },
  "knownFailures": { "pis.isValid#repeated-digits": "fix in progress (#123)" }
}
```

| Field | Meaning |
|---|---|
| `language` | adapter id or alias |
| `entry` | adapter-specific: package dir, entry file, src dir… |
| `options` | adapter options (`namespace`, `app`, `casesDir`, `testFile`…) |
| `bindings` | contract id → native symbol(s), when the naming conventions don't find it |
| `ignore` | public symbols intentionally outside the contract (globs) |
| `waivers` | contract functions this lib will not implement, with the reason |
| `knownFailures` | test (or function) ids expected to fail for now, with the reason |

