<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```csharp
using BrazilianUtils;

LegalProcess.isValid("16669239820269264932");  // false
LegalProcess.isValid("00000000000000000000");  // false
LegalProcess.isValid("55079546820269134837");  // false
```

## format

```csharp
using BrazilianUtils;

LegalProcess.formatLegalProcess("16669239820269264931");  // Some("1666923-98.2026.9.26.4931")
LegalProcess.formatLegalProcess("16669239820269264932");  // Some("1666923-98.2026.9.26.4932")
LegalProcess.formatLegalProcess("00000000000000000000");  // Some("0000000-00.0000.0.00.0000")
```

## removeSymbols

```csharp
using BrazilianUtils;

LegalProcess.removeSymbols("1666923-98.2026.9.26.4931");  // "16669239820269264931"
LegalProcess.removeSymbols("5507954-68.2026.9.13.4836");  // "55079546820269134836"
LegalProcess.removeSymbols("4709757-95.2026.3.00.5802");  // "47097579520263005802"
```
