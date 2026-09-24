---
id: cep
title: "CEP"
language: en-US
references:
  - law 6.538/1978
---

# CEP: Brazilian Postal Code

## Summary

The CEP is a numeric code of eight digits. The postal service assigns these codes to localities, streets, postal units, services, public agencies, companies and buildings. The codes guide and speed up the routing, processing and delivery of mail items.

## Functions

- **Validation**: Check that the CEP has `8` digits.
- **Formatting**: Show the CEP in the standard format `XXXXX-XXX`.
- **Parsing**: Keep only the digits, up to 8.
- **Generation**: Generate a random CEP of `8` digits.

## Validation rules

1. The input must contain exactly `8` digits.

## Algorithm

1. Check that the input contains exactly `8` characters.
2. Check that all characters are digits.
3. If both conditions are true, return valid. If not, return invalid.

## Regex

- Unformatted CEP: `^\d{8}$`
- Formatted CEP: `^\d{5}-\d{3}$`

## Examples

- Valid: `01310200`
- `01310-200`: pending decision. The reference (JS) accepts it, the other libraries do not.
- Invalid: `12345` (must contain exactly `8` characters)
- Invalid: `123456789` (must contain exactly `8` characters)
- Invalid: `abcdefgh` (must contain only digits)
