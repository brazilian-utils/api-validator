---
id: cep
title: "CEP"
language: en-US
references:
  - law 6.538/1978
---

# CEP - Brazilian Postal Code

## Summary

CEP is a numeric code consisting of eight digits that guides and speeds up the routing, processing, and delivery of mail items by assigning codes to localities, streets, postal units, services, public agencies, companies, and buildings.

## Operations

- **Validation**: Verify whether an unformatted CEP contains exactly `8` numeric digits.
- **Formatting**: Format the CEP using the standard `XXXXX-XXX` format.
- **Symbol removal**: Remove the `.` and `-` characters from the input.
- **Generation**: Generate a random `8`-digit CEP.

## Validation Rules

1. The input must contain exactly `8` numeric digits.

## Algorithm

1. Verify that the input contains exactly `8` characters.
2. Verify that all characters are numeric digits.
3. Return valid if both conditions are met, otherwise, return invalid.

## Regex

- Unformatted CEP: `^\d{8}$`
- Formatted CEP: `^\d{5}-\d{3}$`

## Examples

- Valid: `01310200`
- Invalid: `01310-200` (validation only accepts unformatted CEPs)
- Invalid: `12345` (must contain exactly `8` characters)
- Invalid: `123456789` (must contain exactly `8` characters)
- Invalid: `abcdefgh` (must contain only numeric digits)
