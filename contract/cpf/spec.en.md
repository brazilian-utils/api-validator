---
id: cpf
title: "CPF"
language: en-US
references:
  - IN RFB nº 2.172/2024
  - law 14.534/2023
---

# CPF — Brazilian Individual Taxpayer Registry

## Summary

The CPF is an 11-digit national identification number. The first eight digits correspond to the registration number and are randomly assigned. The ninth digit identifies the Fiscal Region responsible for the registration, and the last two digits are check digits. Since January 2023, Brazil has adopted the CPF as its single identification number.

## Operations

- **Validation**: Verify whether an unformatted CPF is valid according to official rules.
- **Formatting**: Present the CPF in the standard format `XXX.XXX.XXX-YY`.
- **Symbol removal**: Remove the `.` and `-` characters, keeping only numeric digits.
- **Generation**: Generate a valid CPF randomly or following specific rules.

## Validation Rules

1. The input must contain exactly 11 characters.
2. Check digits are calculated using the standard mod-11 algorithm.
3. Sequences with all digits equal (e.g., `00000000000`) are invalid.

## Algorithm

1. Reject if length != 11 or if repeated sequence
2. Calculate first check digit (DV1):
   - Multiply the first 9 digits by weights 10..2
   - Sum results
   - DV1 = (sum % 11 < 2 ? 0 : 11 - (sum % 11))
3. Calculate second check digit (DV2):
   - Multiply the first 10 digits (including DV1) by weights 11..2
   - Sum results
   - DV2 = (sum % 11 < 2 ? 0 : 11 - (sum % 11))
4. Compare DV1 and DV2 with last two digits

## Regex

- Unformatted CPF: `^\d{11}$`
- Formatted CPF: `^\d{3}\.\d{3}\.\d{3}-\d{2}$`

## Examples

- Valid: `11144477735` 
- Invalid: `111.444.777-35` (validation only accepts unformatted CPFs)
- Invalid: `00000000000` (repeated sequence)
- Invalid: `1114447773` (must contain exactly 11 characters)
- Invalid: `111444777355` (must contain exactly 11 characters)
