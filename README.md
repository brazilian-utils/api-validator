# API Validator

Automated validator for logical API compatibility across `brazilian-utils` implementations.

## Structure

- `src/libs.config.json`: repository and language definitions
- `src/spec.json`: canonical API contract
- `src/exceptions.json`: allowed aliases and structural differences
- `src/specs/`: one generated JSON spec per implementation
- `output/`: generated artifacts
- `src/`: CLI, extraction, normalization, comparison, and report logic

## Install

```bash
npm ci
```

## Commands

`npm run build` runs the full validation pipeline (including comparison outputs).

```bash
npm run api-validator -- update-libs
npm run api-validator -- extract
npm run api-validator -- normalize
npm run api-validator -- bootstrap-spec --source brazilian-utils-javascript
npm run api-validator -- generate-lib-specs
npm run api-validator -- compare
npm run api-validator -- report
npm run api-validator -- all
```

`compare` reads from `src/specs/*.spec.json`.  
`compare` and `all` exit non-zero when CI-breaking mismatches exist.

## Outputs

- `output/extracted.json`
- `output/normalized.json`
- `src/specs/<lib>.spec.json`
- `output/matrix.json`
- `output/index.html`
