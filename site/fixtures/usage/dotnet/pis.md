<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```csharp
using BrazilianUtils;

Pis.isValid("55984775363");  // true
Pis.isValid("55984775364");  // false
Pis.isValid("36365790380");  // true
```

## format

```csharp
using BrazilianUtils;

Pis.formatPis("55984775363");  // Some("559.84775.36-3")
Pis.formatPis("00000000000");  // Some("000.00000.00-0")
Pis.formatPis("36365790380");  // Some("363.65790.38-0")
```

## generate

```csharp
using BrazilianUtils;

Pis.generate();  // random valid value
```
