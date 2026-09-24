# Contract reference

Use this page to write or change a contract file or a library config. The contract has one
folder per domain in `contract/`, named after the domain in kebab-case (`cpf/`,
`license-plate/`). The folder holds `contract.json`, the long spec (`spec.en.md`, `spec.pt-br.md`),
`references.md` and, optionally, `references/*.pdf`; `lint` names the domains whose spec is still
missing. The validator ignores names that start
with `_` (for example, `contract/_proposals/`). Validate the files with
`doc lint` and format them with `doc fmt` (CI runs `fmt --check`). Every
file points at `schema/contract.schema.json`, so editors (VS Code, JetBrains…) validate and
autocomplete it as you type.

`fmt` keeps one test case per line. It writes multi-line text (`description`) as an array of
lines. A file looks like this:

```json
{
  "$schema": "../../schema/contract.schema.json",
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
| `title` (domain) | short name for the sidebar and the page title. A string, or `{ "en": "…", "pt-BR": "…" }` with both languages |
| `summary` (domain) | one or two sentences: what the domain is. `{ "en": "…", "pt-BR": "…" }`, both languages required |
| `aliases` (domain) | other names of the domain that some libraries use |
| function key | the function: `isValid` → id `legalProcess.isValid` |
| `summary` (function) | one sentence. English only (a string) or bilingual (`{ "en": "…", "pt-BR": "…" }`, see below) |
| `label` (function) | name of the function on the docs site, `{ "en": "…", "pt-BR": "…" }` (default: derived from the function id) |
| `description` (function) | the language-neutral spec (markdown, a string or an array of lines): rules, edge cases, bad input. English only or bilingual, like `summary` |
| `references` | official sources (laws, manuals, specs) |
| `flatName` | facade name. Default: function + Domain (`isValidLegalProcess`) |
| `aliases` (function) | other `domain.operation` spellings in use |
| `level` | `core`: every library must have it. `extended` (default) |
| `network` | `true`: calls a remote service (tests and diff skip it by default) |
| `params`, `returns` | canonical types (below). `optional: true` for optional params |
| `tests[]` | args and exactly one of `returns` (any JSON value), `throws: true` (must fail), `matches` (regex on a string result), `satisfies` (the result, given to that function, must return `true`). Optional: `name`, `repeat`, `note` |

## Bilingual summary and description

The `summary` and `description` of a function accept two forms:

- A plain string (for `description`, also an array of lines): English only.
- An object with one entry per site language. `en` is required. `pt-BR` is optional in the
  schema. In `description`, each language can be a string or an array of lines.

```json
"summary": {
  "en": "Checks whether a legal process number (NUP) is valid.",
  "pt-BR": "Verifica se um número de processo judicial (NUP) é válido."
}
```

The validator (issues, briefs, reports, the exported suite) uses the English text. The docs
site reads the contract files directly and shows the text in the language of the page. When a
language is missing, the site shows the English text. `site/scripts/check-i18n.mjs` reports
every function `summary` or `description` that does not have both `en` and `pt-BR`. A plain
string counts as English only. With `--strict` (used in CI on pull requests), the script exits
with code 1 when anything is missing.

## Canonical types

The canonical types are `string`, `integer`, `number`, `boolean`, `date`, `void`, `any` and
`null`. You can also write `T?` (nullable), `T[]`, `A | B`, literals (`"a"`, `1`, `true`) and
named object types (`Address`). The validator compares named object types across languages
only as "an object". Each language adapter maps its native types to these types. When an
adapter cannot map a type, it reports the type as unverified, not as wrong.

Signature rules (from the point of view of the caller):

- A call written against the contract must work. The library may accept more (extra optional
  params, wider types) but not less.
- The contract must allow every value that the library may return. `string?` against `string`
  is a warning in either direction.

## Test ids and values

The id of a test is `<fn>#<name>` or `<fn>#<index>`. `knownFailures` and baselines refer to
these ids, so give hand-written cases a `name`. Values are JSON. `null` stands for
`None`/`nil`/`undefined`/`Option::None`/`{error, _}`. The comparison of object keys ignores
case and separators (`zipCode` == `zip_code`), and an absent key equals `null`.

Mined cases (`doc diff --propose --unanimous --apply`) have a `note` that says which
libraries agreed.

## Library config (`libs/<name>.json`)

`schema/lib.schema.json` validates this file.

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
| `entry` | specific to the adapter: package dir, entry file, src dir… |
| `options` | adapter options (`namespace`, `app`, `casesDir`, `testFile`…) |
| `bindings` | contract id → native symbol(s), when the naming conventions do not find it |
| `ignore` | public symbols that are outside the contract on purpose (globs) |
| `waivers` | contract functions that this library will not implement, with the reason |
| `knownFailures` | test (or function) ids that are expected to fail for now, with the reason |
