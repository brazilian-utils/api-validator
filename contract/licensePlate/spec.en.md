---
id: license-plate
title: "License Plate"
language: en-US
references:
  - law-9503-1997
---

# Vehicle License Plate

## Summary

Vehicle license plates are front and rear plates affixed to a vehicle, containing 7 unique alphanumeric characters.

## Operations

- **Validation**: Verify that the vehicle license plate is valid according to official rules.
- **Formatting**: Display the license plate in the standard format `LLLNLNN` or `LLLNNNN`, where `L` refers to a letter and `N` refers to a digit.
- **Generation**: Generate a valid license plate in the given format. In case no format is provided, it will return a license plate in the Mercosul format.

## Validation Rules

### Mercosur Standard
1. It must consist of 7 (seven) alphanumeric characters following the `LLLNLNN` pattern.

### Pre-Mercosur Standard
1. It must contain 7 (seven) alphanumeric characters, with the first group consisting of 3 (three) characters, resulting from the permutation, with repetition of 26 (twenty-six) letters, taken three at a time, and the second group consisting of 4 (four) characters, resulting from the permutation, with repetition of 10 (ten) digits, taken four at a time, forming the `LLLNNNN` pattern.

## Algorithm

1. Remove leading and trailing whitespace from the input.
2. Verify that the input has exactly 7 characters.
3. Verify that all characters are alphanumeric.
4. Verify that the input follows one of the valid patterns:
   - Mercosur: `LLLNLNN`
   - Pre-Mercosur: `LLLNNNN`
5. If the input does not follow either pattern, the license plate is considered invalid.

## Regex

- Raw input: `^[A-Za-z0-9 -]{1,}$`
- Characters only (pre-Mercosur or Mercosur pattern): `^(?:[A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2})$`

## Examples

- Valid: `ABC1234` (Pre-Mercosur standard)
- Valid: `ABC1D23` (Mercosur standard)
- Invalid: `AB12345` (does not follow any valid format)
- Invalid: `ABCD123` (incorrect number of letters)
- Invalid: `ABC123` (fewer than 7 characters)
- Invalid: `ABC12D4` (incorrect character order)
