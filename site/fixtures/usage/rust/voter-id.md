<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```rust
use brazilian_utils::voter_id;

voter_id::is_valid("652688902801");  // true
voter_id::is_valid("652688902802");  // false
voter_id::is_valid("000000000000");  // false
```

## format

```rust
use brazilian_utils::voter_id;

voter_id::format_voter_id("652688902801");  // Some("6526 8890 28 01")
voter_id::format_voter_id("051401322801");  // Some("0514 0132 28 01")
voter_id::format_voter_id("859962902836");  // Some("8599 6290 28 36")
```
