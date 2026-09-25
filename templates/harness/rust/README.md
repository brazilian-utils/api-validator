# Rust harness (brazilian-utils-rust)

Runs the vendored conformance suite (`api-contract/`) with the lib's own `cargo test`, one test
per case, named by the case id. Spec: [docs/harness.md](../../../docs/harness.md).

## Where it goes

```
<lib>/
  api-contract/            vendored suite (export-cases), never edited
  tests/api_contract.rs    this harness (integration test)
  Cargo.toml               + the [[test]] section below
```

Add to the lib's `Cargo.toml`:

```toml
# API contract harness (tests/api_contract.rs): its own `main` reports one test per case.
[[test]]
name = "api_contract"
harness = false
```

Why `harness = false`: stable Rust cannot register `#[test]`s at run time, and one `#[test]`
looping over 800 cases would report a single pass/fail and hide skips. The file's `main` is a
tiny libtest look-alike (std only, no `libtest-mimic`): it prints
`test <case id> ... ok | FAILED | ignored, <reason>` per case, a failures section, the usual
`test result:` line, and exits non-zero on failure.

Dependencies: only what the lib already has: `serde_json` + `serde` (to put results in JSON form)
and `regex` (for `matches`), all regular `[dependencies]` of brazilian_utils.

## Running

```sh
cargo test                                   # whole suite, harness included
cargo test --test api_contract               # harness only
cargo test --test api_contract -- cpf.       # filter (substring); also --exact, --skip, --list
API_CONTRACT_NETWORK=1 cargo test --test api_contract   # also network functions (cep lookups)
API_CONTRACT_DIR=/path/to/api-contract cargo test --test api_contract   # another copy of the suite
```

The suite is found at `$CARGO_MANIFEST_DIR/api-contract`, so the working directory does not matter.

## Adding a registry entry

Implement the function in the lib, then add one line to `registry()` (grouped by domain) and bump
the array length:

```rust
("cpf.isValid", |a| ok(cpf::is_valid(s(a, 0)?))),
```

Argument helpers: `s(a, i)` string, `n(a, i)` number, `opt_s(a, i)` optional string
(`Option<&str>`), `none(a)` no arguments. `ok(v)` serializes any `Serialize` result to JSON
(`Option::None` -> `null`, maps -> objects). Return `Err(CallError::Threw(..))` for a lib `Err`
(what `throws: true` expects); arguments the lib cannot take become `BadArgs`, which is always a
failure. A panic counts as "throws". Ids unknown to the suite fail `registry::ids_are_contract_functions`.
