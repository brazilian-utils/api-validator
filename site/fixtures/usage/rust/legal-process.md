<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::legal_process;

legal_process::is_valid("16669239820269264932");  // false
legal_process::is_valid("00000000000000000000");  // false
legal_process::is_valid("55079546820269134837");  // false
```

## format

```rust
use brazilian_utils::legal_process;

legal_process::format_legal_process("16669239820269264931");  // Some("1666923-98.2026.9.26.4931")
legal_process::format_legal_process("16669239820269264932");  // Some("1666923-98.2026.9.26.4932")
legal_process::format_legal_process("00000000000000000000");  // Some("0000000-00.0000.0.00.0000")
```
