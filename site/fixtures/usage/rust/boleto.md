<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::boleto;

boleto::is_valid("60757135008571297205909229083648919190488862573");  // true
boleto::is_valid("60757135008571297205909229083648919190488862574");  // false
boleto::is_valid("00000000000000000000000000000000000000000000000");  // false
```
