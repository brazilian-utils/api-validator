<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```csharp
using BrazilianUtils;

Phone.IsValid("48976579784");  // true
Phone.IsValid("00000000000");  // false
Phone.IsValid("48976579785");  // true
```
