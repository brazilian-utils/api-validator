---
id: cpf
title: "CPF"
language: en-US
references:
  - IN RFB nº 2.172/2024
  - law 14.534/2023
---

# CPF: Brazilian Individual Taxpayer Registry

## Summary

The CPF is an 11-digit national identification number. The first eight digits are the registration number, assigned at random. The ninth digit identifies the Fiscal Region responsible for the registration. The last two digits are check digits. Since January 2023, Brazil has used the CPF as its single identification number.

## Functions

- **Validation**: Check whether an unformatted CPF is valid according to the official rules.
- **Formatting**: Show the CPF in the standard format `XXX.XXX.XXX-YY`.
- **Symbol removal**: Remove the `.` and `-` characters and keep only the digits.
- **Generation**: Generate a valid CPF, at random or according to specific rules.

## Validation rules

1. The input must contain exactly 11 characters.
2. The check digits come from the standard mod-11 algorithm.
3. Sequences with all digits equal (for example, `00000000000`) are invalid.

## Algorithm

1. Reject the input if its length != 11 or if it is a repeated sequence.
2. Calculate the first check digit (DV1):
   - Multiply the first 9 digits by the weights 10..2.
   - Add the results.
   - DV1 = (sum % 11 < 2 ? 0 : 11 - (sum % 11))
3. Calculate the second check digit (DV2):
   - Multiply the first 10 digits (including DV1) by the weights 11..2.
   - Add the results.
   - DV2 = (sum % 11 < 2 ? 0 : 11 - (sum % 11))
4. Compare DV1 and DV2 with the last two digits.

## Regex

- Unformatted CPF: `^\d{11}$`
- Formatted CPF: `^\d{3}\.\d{3}\.\d{3}-\d{2}$`

## Examples

- Valid: `11144477735`
- Invalid: `111.444.777-35` (validation accepts only unformatted CPFs)
- Invalid: `00000000000` (repeated sequence)
- Invalid: `1114447773` (must contain exactly 11 characters)
- Invalid: `111444777355` (must contain exactly 11 characters)
