<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```csharp
using BrazilianUtils;

Cep.IsValid("91906292");  // true
Cep.IsValid("abc");       // false
Cep.IsValid("91906293");  // true
```

## format

```csharp
using BrazilianUtils;

Cep.Format("91906292");  // "91906-292"
Cep.Format("91906293");  // "91906-293"
Cep.Format("00000000");  // "00000-000"
```
