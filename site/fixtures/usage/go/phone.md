<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## format

```go
import "github.com/brazilian-utils/go/phone"

phone.Format("")  // ""
```

## removeInternationalDialingCode

```go
import "github.com/brazilian-utils/go/phone"

phone.RemoveInternationalDialingCode("48976579784")  // "48976579784"
phone.RemoveInternationalDialingCode("48976579785")  // "48976579785"
phone.RemoveInternationalDialingCode("00000000000")  // "00000000000"
```
