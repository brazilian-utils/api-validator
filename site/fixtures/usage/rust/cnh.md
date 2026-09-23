<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::cnh;

cnh::is_valid_cnh("73918433737");  // true
cnh::is_valid_cnh("73918433738");  // false
cnh::is_valid_cnh("00000000000");  // false
```
