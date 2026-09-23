<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::cpf;

cpf::is_valid("83159562131");  // true
cpf::is_valid("83159562132");  // false
cpf::is_valid("00000000000");  // false
```

## format

```rust
use brazilian_utils::cpf;

cpf::format_cpf("83159562131");  // Some("831.595.621-31")
cpf::format_cpf("02746891972");  // Some("027.468.919-72")
cpf::format_cpf("52708175602");  // Some("527.081.756-02")
```

## removeSymbols

```rust
use brazilian_utils::cpf;

cpf::remove_symbols("831.595.621-31");  // "83159562131"
cpf::remove_symbols("027.468.919-72");  // "02746891972"
cpf::remove_symbols("527.081.756-02");  // "52708175602"
```

## generate

```rust
use brazilian_utils::cpf;

cpf::generate();  // random valid value
```
