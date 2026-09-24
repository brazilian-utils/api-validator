<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::legal_nature;

legal_nature::is_valid("3329");  // false
legal_nature::is_valid("2240");  // true
legal_nature::is_valid("0000");  // false
```

## getDescription

```rust
use brazilian_utils::legal_nature;

legal_nature::get_description("2240");   // Some("Sociedade Simples Limitada")
legal_nature::get_description("224-0");  // Some("Sociedade Simples Limitada")
```
