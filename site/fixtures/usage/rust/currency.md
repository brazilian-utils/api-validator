<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## convertToWords

```rust
use brazilian_utils::currency;

currency::convert_real_to_text(0);     // "zero reais"
currency::convert_real_to_text(0.01);  // "um centavo"
currency::convert_real_to_text(1);     // "um real"
```
