<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## format

```csharp
using BrazilianUtils;

LicensePlate.formatLicensePlate("wdg1s21");  // Some("WDG1S21")
LicensePlate.formatLicensePlate("gjg8u81");  // Some("GJG8U81")
LicensePlate.formatLicensePlate("kds4w15");  // Some("KDS4W15")
```

## convertToMercosul

```csharp
using BrazilianUtils;

LicensePlate.convertToMercosul("ABC1234");  // Some("ABC1C34")
LicensePlate.convertToMercosul("ABC0000");  // Some("ABC0A00")
LicensePlate.convertToMercosul("ABC9999");  // Some("ABC9J99")
```

## getFormat

```csharp
using BrazilianUtils;

LicensePlate.getFormat("WDG1S21");  // Some("LLLNLNN")
LicensePlate.getFormat("WDG1S22");  // Some("LLLNLNN")
LicensePlate.getFormat("wdg1s21");  // Some("LLLNLNN")
```
