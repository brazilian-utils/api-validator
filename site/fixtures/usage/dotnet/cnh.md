<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```csharp
using BrazilianUtils;

Cnh.isValidCnh("73918433737");  // true
Cnh.isValidCnh("73918433738");  // false
Cnh.isValidCnh("00000000000");  // false
```
