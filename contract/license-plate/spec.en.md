---
id: license-plate
title: "License Plate"
language: en-US
references:
  - law-9503-1997
---

# Vehicle license plate

## Summary

Vehicle license plates are the front and rear plates fixed to a vehicle. A plate contains 7 unique alphanumeric characters.

## Functions

- **Validation**: Check that the vehicle license plate is valid according to the official rules.
- **Formatting**: Show the license plate in the standard format `LLLNLNN` or `LLLNNNN`. `L` is a letter and `N` is a digit.
- **Generation**: Make a valid license plate in the given format. If you give no format, the function returns a license plate in the Mercosul format.

## Validation rules

### Mercosul standard
1. The plate must have 7 (seven) alphanumeric characters in the `LLLNLNN` pattern.

### Pre-Mercosul standard
1. The plate must contain 7 (seven) unique alphanumeric characters in the `LLLNNNN` pattern, in two groups:
   - The first group has 3 (three) characters. It comes from the permutation, with repetition, of 26 (twenty-six) letters, taken three at a time.
   - The second group has 4 (four) characters. It comes from the permutation, with repetition, of 10 (ten) digits, taken four at a time.

## Algorithm

1. Remove the whitespace at the start and at the end of the input.
2. Check that the input has exactly 7 characters.
3. Check that all characters are alphanumeric.
4. Check that the input follows one of the valid patterns:
   - Mercosul: `LLLNLNN`
   - Pre-Mercosul: `LLLNNNN`
5. If the input follows neither pattern, the license plate is invalid.

## Regex

- Raw input: `^[A-Za-z0-9 -]{1,}$`
- Characters only (pre-Mercosul or Mercosul pattern): `^(?:[A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2})$`

## Examples

- Valid: `ABC1234` (pre-Mercosul standard)
- Valid: `ABC1D23` (Mercosul standard)
- Invalid: `AB12345` (does not follow any valid format)
- Invalid: `ABCD123` (incorrect number of letters)
- Invalid: `ABC123` (fewer than 7 characters)
- Invalid: `ABC12D4` (incorrect character order)
