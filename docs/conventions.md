# Cross-cutting conventions

Rules that hold for every contract function unless its `description` in `contract/<domain>.json`
says otherwise. They come from the "Conventions" section of the reference (JavaScript) docs,
checked against what the seven libs actually do (`api-validator check --tests` and `diff`,
recorded in [findings.md](findings.md)).

Status:

- **Agreed**: the contract and every lib that implements the functions already behave this way.
- **Pending decision**: the libs disagree. The rule shown is what the reference (JS) does. It
  is not settled until the linked finding is decided and its vector added to the contract.
- **Reference only**: only the reference lib implements or documents the rule, and the harness
  has not compared it across libs yet. New implementations should follow it.

"null" means the language's "no result" value, as in [contract.md](contract.md#test-ids-and-values):
`null`, `None`, `nil`, `Option::None` or `{error, _}`.

## Summary

| # | Convention | Status |
|---|---|---|
| 1 | Validators return false on bad input; they never fail | Agreed |
| 2 | Formatters on empty, garbage or incomplete input | Pending decision ([§2 #2, #3](findings.md#2-decisions-needed-not-encoded-yet--pick-one-answer-add-the-vector)) |
| 3 | Single-item lookups return null when nothing matches | Pending decision ([§2 #6](findings.md#2-decisions-needed-not-encoded-yet--pick-one-answer-add-the-vector)) |
| 4 | List lookups return an empty list when nothing matches | Reference only |
| 5 | Network functions fail with an error instead of returning null | Reference only |
| 6 | Validators accept masked input | Pending decision ([§2 #1](findings.md#2-decisions-needed-not-encoded-yet--pick-one-answer-add-the-vector)) |
| 7 | Formatters mask as far as the value goes (usable as input masks) | Pending decision ([§2 #2](findings.md#2-decisions-needed-not-encoded-yet--pick-one-answer-add-the-vector)) |
| 8 | `parse` keeps only the meaningful characters and caps the length | Reference only |
| 9 | Generated values are unformatted and pass the lib's own validator | Agreed |
| 10 | Generators are not cryptographically secure | Reference only |
| 11 | Reserved numbers (all digits the same) are invalid | Agreed for CPF and CNPJ; Pending decision for PIS ([§1](findings.md#1-vectors-in-the-contract-that-some-libs-fail)) |
| 12 | Lookups return fresh values | Reference only |
| 13 | Only network functions are asynchronous | Agreed |
| 14 | Text written out in words ("por extenso") is lower case | Pending decision ([§1b](findings.md#1b-found-by-the-506-vectors-added-from-the-js-reference-tests)) |
| 15 | Optional behaviours are optional parameters (`options`) | Pending decision ([§2](findings.md#2-decisions-needed-not-encoded-yet--pick-one-answer-add-the-vector), API shape) |

## Details

1. **Validators never fail on bad input.** `*.isValid` returns false for an empty string,
   whitespace or garbage, and never raises. The contract's `isValid`
   vectors for `""`, `"   "` and `"abc"` pass in every lib.

2. **Formatters on bad input.** The reference returns an empty string for empty or garbage
   input and masks an incomplete value as far as it goes (`"123"` gives `"123"`). Go and .NET
   do the same. Python, Ruby, Rust and Erlang return null for anything that is not a complete,
   valid value. This is also why `format` returns `string?` in those libs and `string` in the
   contract. Some functions are not covered by the vote yet: `currency.format` and
   `date.convertToWords` (§2 #9), `licensePlate.convertToMercosul` (§2 #5), and `phone.format`
   and `passport.format` on empty input.

3. **Single-item lookups** (`*.get`, `*.getInfo`, `*.getBy*`) return null when nothing matches.
   Go returns `""` for an unknown legal nature code (`legalNature.getDescription`) where
   Python, Ruby and Rust return null.

4. **List lookups** (`*.list`, `*.listBy*`, `date.getHolidays`) return an empty list for an
   unknown filter or out-of-range input, never null.

5. **Network functions** (`network: true` in the contract: `cep.getAddressInfo`,
   `cep.getInfoByAddress`) fail with an error for invalid input, "not found" and service
   failures, and the error kinds can be told apart. They are the exception to rules 1 to 4.
   Network calls are skipped in tests and in `diff`, so the other libs have not been compared.

6. **Masked input to validators.** The reference ignores the usual mask characters (`.`, `-`,
   `/`) and whitespace around and between groups, so input needs no stripping first. JS, Go and
   .NET accept `821.785.374-64`. Python, Ruby, Rust and Erlang accept digits only. The rule
   applies to `cpf`, `cnpj`, `cep`, `pis` and `voterId`. Each function's description lists
   the separators it accepts (for example, `voterId.isValid` rejects hyphens).

7. **Formatters as input masks.** Because the reference masks partial values, a formatter can
   be applied on every keystroke. This depends on decision 2.

8. **Parsers** (`*.parse`) do the reverse of `format`. They keep only the meaningful
   characters (digits, or upper-cased letters and digits for alphanumeric documents) and cap
   the result at the document's length. They pad nothing.

9. **Generators** (`*.generate`) return the unformatted value (digits only, or upper-case
   alphanumerics), and the result passes the lib's own `isValid`. This is encoded as
   `satisfies` vectors. In Go and Rust some generators take a required argument that the
   contract makes optional. That is an API-shape difference and does not change the output.

10. **Generators use a non-cryptographic random source.** They are meant for tests and
    fixtures, never for anything security related. The reference documents this, and the other
    libs have not been checked.

11. **Reserved numbers.** A CPF or CNPJ whose digits are all the same is invalid even when its
    check digits match, and every lib agrees. For PIS, the reference (JS) also rejects such
    numbers and the other six libs accept them (findings §1).

12. **Lookups return fresh values.** Mutating a returned list or record never affects the next
    call. Only the reference ships these lookups today, and in languages with immutable data
    the rule holds by construction.

13. **Synchronous API.** Every function returns its result directly, except the network
    functions of rule 5, which may be asynchronous where the language has an idiom for it.

14. **Words output.** The reference writes `currency.convertToWords` and `date.convertToWords`
    in lower case with no comma between groups ("mil quinhentos e vinte e três reais…"). For
    currency, .NET, Go, Python and Ruby capitalise the first word, and .NET, Go and Python add
    commas. For dates, Go and Ruby capitalise.

15. **Optional behaviours.** In the reference, optional behaviours (padding, obfuscation,
    version, mask, precision…) go in a single options object. Other libs take positional
    optional parameters or leave the behaviour out. The contract lists them as one optional
    `options` parameter. A few defaults are themselves disputed: the default phone mask
    (§2 #4) and whether `currency.format` adds `R$` (§1b).
