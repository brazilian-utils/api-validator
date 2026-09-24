<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## format

```go
import "github.com/brazilian-utils/go/licenseplate"

licenseplate.Format("wdg1s21")  // "WDG1S21"
licenseplate.Format("gjg8u81")  // "GJG8U81"
licenseplate.Format("kds4w15")  // "KDS4W15"
```

## convertToMercosul

```go
import "github.com/brazilian-utils/go/licenseplate"

licenseplate.ConvertToMercosul("ABC1234")  // "ABC1C34"
licenseplate.ConvertToMercosul("ABC0000")  // "ABC0A00"
licenseplate.ConvertToMercosul("ABC9999")  // "ABC9J99"
```

## getFormat

```go
import "github.com/brazilian-utils/go/licenseplate"

licenseplate.GetFormat("WDG1S21")  // "LLLNLNN"
licenseplate.GetFormat("WDG1S22")  // "LLLNLNN"
licenseplate.GetFormat("wdg1s21")  // "LLLNLNN"
```
