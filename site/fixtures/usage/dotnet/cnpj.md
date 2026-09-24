<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```csharp
using BrazilianUtils;

Cnpj.IsValid("10799163989271");  // true
Cnpj.IsValid("10799163989272");  // false
Cnpj.IsValid("00000000000000");  // false
```

## format

```csharp
using BrazilianUtils;

Cnpj.Format("10799163989271");  // "10.799.163/9892-71"
Cnpj.Format("64977017647333");  // "64.977.017/6473-33"
Cnpj.Format("62932200808587");  // "62.932.200/8085-87"
```

## generate

```csharp
using BrazilianUtils;

Cnpj.Generate();  // random valid value
```
