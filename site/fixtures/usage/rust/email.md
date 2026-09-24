<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::email;

email::is_valid("abc");  // false
email::is_valid("");     // false
email::is_valid("   ");  // false
```
