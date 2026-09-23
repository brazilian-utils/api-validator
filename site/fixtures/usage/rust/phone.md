<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## removeSymbols

```rust
use brazilian_utils::phone;

phone::remove_symbols("48976-5797");  // "489765797"
phone::remove_symbols("31479-8146");  // "314798146"
phone::remove_symbols("38942-4321");  // "389424321"
```

## removeInternationalDialingCode

```rust
use brazilian_utils::phone;

phone::remove_international_dialing_code("48976579784");  // "48976579784"
phone::remove_international_dialing_code("48976579785");  // "48976579785"
phone::remove_international_dialing_code("00000000000");  // "00000000000"
```
