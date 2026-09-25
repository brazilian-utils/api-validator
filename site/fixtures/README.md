# fixtures/usage

Temporary stand-in for the `docs/usage/<util>.md` files that each library repository will own.

`scripts/fetch-usage.mjs` tries GitHub first. Only when a library has no `docs/usage/` folder yet
does it fall back to `fixtures/usage/<lib>/`, and it prints a warning when it does.

Each file here follows the exact contract described on the site's "Usage files" page, so it can be
copied as-is into the library repo (`docs/usage/<util>.md`) in the PR that adopts the contract.
Once a library has its own files, delete its folder here.

The examples were transcribed from each library's current documentation
(`javascript/docs/utilities.md` and `python/README_EN.md`).
