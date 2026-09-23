<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## format

```go
import "github.com/brazilian-utils/go/phone"

phone.Format("")  // ""
```

## removeSymbols

```go
import "github.com/brazilian-utils/go/phone"

phone.RemoveSymbols("48976-5797")  // "489765797"
phone.RemoveSymbols("31479-8146")  // "314798146"
phone.RemoveSymbols("38942-4321")  // "389424321"
```

## removeInternationalDialingCode

```go
import "github.com/brazilian-utils/go/phone"

phone.RemoveInternationalDialingCode("48976579784")  // "48976579784"
phone.RemoveInternationalDialingCode("48976579785")  // "48976579785"
phone.RemoveInternationalDialingCode("00000000000")  // "00000000000"
```
