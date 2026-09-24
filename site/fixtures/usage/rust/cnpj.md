<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::cnpj;

cnpj::is_valid("10799163989271");  // true
cnpj::is_valid("10799163989272");  // false
cnpj::is_valid("00000000000000");  // false
```

## format

```rust
use brazilian_utils::cnpj;

cnpj::format_cnpj("10799163989271");  // Some("10.799.163/9892-71")
cnpj::format_cnpj("64977017647333");  // Some("64.977.017/6473-33")
cnpj::format_cnpj("62932200808587");  // Some("62.932.200/8085-87")
```
