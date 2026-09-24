<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::renavam;

renavam::is_valid("72028649661");  // true
renavam::is_valid("72028649662");  // false
renavam::is_valid("00000000000");  // false
```

## generate

```rust
use brazilian_utils::renavam;

renavam::generate();  // random valid value
```
