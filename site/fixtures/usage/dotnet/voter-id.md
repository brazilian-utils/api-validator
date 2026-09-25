<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```csharp
using BrazilianUtils;

VoterId.isValid("652688902801");  // true
VoterId.isValid("652688902802");  // false
VoterId.isValid("000000000000");  // false
```

## format

```csharp
using BrazilianUtils;

VoterId.formatVoterId("652688902801");  // Some("6526 8890 28 01")
VoterId.formatVoterId("051401322801");  // Some("0514 0132 28 01")
VoterId.formatVoterId("859962902836");  // Some("8599 6290 28 36")
```
