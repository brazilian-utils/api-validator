---
id: cnpj
title: "CNPJ"
language: en-US
references:
  - in-rfb-2119-2022
  - in-rfb-2229-2024
---

# CNPJ — Brazilian Company Registration Number

## Summary

The CNPJ is a unique identification number issued by the Brazilian Federal Revenue Service to register companies, public agencies, and other entities in Brazil. It is composed of 14 characters: 8 for the root, 4 for the establishment's order, and 2 check digits. CNPJs issued before the implementation of the alphanumeric format contain only numeric digits. Since July 2026, new registrations may contain uppercase letters and digits in the first 12 characters, while the 2 check digits remain exclusively numeric.

## Operations

- **Validation**: Verify whether an unformatted CNPJ is valid according to official rules.
- **Formatting**: Format the CNPJ as `XX.XXX.XXX/XXXX-DV`, where:
    - `X` – Alphanumeric character (digits `0` to `9` and uppercase letters `A` to `Z`).
    - `DV` – Check digits calculated using the modulo 11 algorithm.
- **Symbol removal**: Remove the `.`, `/` and `-` characters, keeping only alphanumeric characters.
- **Generation**: Generate a random valid CNPJ string.

## Validation Rules

1. The input must contain exactly 14 characters.
2. The first 12 characters may contain digits from `0` to `9` and uppercase letters from `A` to `Z`.
3. The last 2 characters correspond to the check digits and must be numeric.
4. The check digits must be calculated using the modulo 11 algorithm.
5. For the calculation of the check digits, the first 12 characters must be converted into numeric values using their decimal ASCII codes, subtracting 48 from the corresponding value.
   
   Examples:
   - `0` → `48 - 48 = 0`
   - `9` → `57 - 48 = 9`
   - `A` → `65 - 48 = 17`
   - `B` → `66 - 48 = 18`
   - `Z` → `90 - 48 = 42`

## Algorithm

1. Verify that the input contains exactly 14 characters.
2. Verify that the first 12 characters are alphanumeric and the last 2 are numeric.
3. Convert alphanumeric characters to numeric values:
   - Numeric digits retain their original values.
   - Letters are converted using their ASCII decimal values minus `48`.
4. Calculate the first check digit (DV1):
   - For the first 12 characters, assign weights from `2` to `9` from right to left, restarting at `2` after weight `9`.
   - Multiply each value by its corresponding weight and sum the results.
   - Calculate the remainder when the sum is divided by `11`.
   - If the remainder is `0` or `1`, DV1 is `0`; otherwise, it is `11 - remainder`.
5. Calculate the second check digit (DV2):
   - For the 13 characters, append DV1 to the sequence and assign weights from `2` to `9` from right to left.
   - Multiply each value by its corresponding weight and sum the results.
   - Calculate the remainder of the sum divided by `11`.
   - If the remainder is `0` or `1`, DV2 is `0`; otherwise, it is `11 - remainder`.
6. Compare the calculated check digits with the last two characters of the CNPJ.

## Regex

- Unformatted CNPJ: `^[A-Z0-9]{12}[0-9]{2}$`
- Formatted CNPJ: `^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}/[A-Z0-9]{4}-[0-9]{2}$`

## Examples

- Valid: `03560714000142` (valid numeric CNPJ)
- Valid: `9359QAG9000184` (valid alphanumeric CNPJ)
- Invalid: `03.560.714/0001-42` (validation only accepts unformatted CNPJs)
- Invalid: `00111222000133` (invalid check digits)
- Invalid: `12ABC34501DE3X` (the check digits must be numeric)
- Invalid: `12abc34501DE35` (lowercase letters are not allowed)
- Invalid: `12ABC34501DE3` (must contain exactly 14 characters)
- Invalid: `12ABC34501DE345` (must contain exactly 14 characters)
