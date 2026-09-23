<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::pis;

pis::is_valid("55984775363");  // true
pis::is_valid("55984775364");  // false
pis::is_valid("36365790380");  // true
```

## format

```rust
use brazilian_utils::pis;

pis::format_pis("55984775363");  // Some("559.84775.36-3")
pis::format_pis("00000000000");  // Some("000.00000.00-0")
pis::format_pis("36365790380");  // Some("363.65790.38-0")
```

## removeSymbols

```rust
use brazilian_utils::pis;

pis::remove_symbols("559.84775.36-3");  // "55984775363"
pis::remove_symbols("363.65790.38-0");  // "36365790380"
pis::remove_symbols("735.32010.29-4");  // "73532010294"
```

## generate

```rust
use brazilian_utils::pis;

pis::generate();  // random valid value
```
