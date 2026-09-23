<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## format

```rust
use brazilian_utils::license_plate;

license_plate::format_license_plate("wdg1s21");  // Some("WDG1S21")
license_plate::format_license_plate("gjg8u81");  // Some("GJG8U81")
license_plate::format_license_plate("kds4w15");  // Some("KDS4W15")
```

## removeSymbols

```rust
use brazilian_utils::license_plate;

license_plate::remove_symbols("WDG1S21");  // "WDG1S21"
license_plate::remove_symbols("WDG1S22");  // "WDG1S22"
license_plate::remove_symbols("wdg1s21");  // "wdg1s21"
```

## convertToMercosul

```rust
use brazilian_utils::license_plate;

license_plate::convert_to_mercosul("ABC1234");  // Some("ABC1C34")
license_plate::convert_to_mercosul("ABC0000");  // Some("ABC0A00")
license_plate::convert_to_mercosul("ABC9999");  // Some("ABC9J99")
```

## getFormat

```rust
use brazilian_utils::license_plate;

license_plate::get_format("WDG1S21");  // Some("LLLNLNN")
license_plate::get_format("WDG1S22");  // Some("LLLNLNN")
license_plate::get_format("wdg1s21");  // Some("LLLNLNN")
```
