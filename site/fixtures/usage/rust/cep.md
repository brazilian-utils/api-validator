<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::cep;

cep::is_valid("91906292");  // true
cep::is_valid("abc");       // false
cep::is_valid("91906293");  // true
```

## format

```rust
use brazilian_utils::cep;

cep::format_cep("91906292");  // Some("91906-292")
cep::format_cep("91906293");  // Some("91906-293")
cep::format_cep("00000000");  // Some("00000-000")
```

## removeSymbols

```rust
use brazilian_utils::cep;

cep::remove_symbols("91906-292");  // "91906292"
cep::remove_symbols("21749-676");  // "21749676"
cep::remove_symbols("41790-070");  // "41790070"
```

## generate

```rust
use brazilian_utils::cep;

cep::generate();  // random valid value
```
