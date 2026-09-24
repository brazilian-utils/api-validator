<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## convertToWords

```go
import "github.com/brazilian-utils/go/date"

date.ConvertDateToText("29/02/2023")  // ""
date.ConvertDateToText("31/04/2024")  // ""
date.ConvertDateToText("not a date")  // ""
```
