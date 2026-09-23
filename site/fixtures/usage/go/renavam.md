<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```go
import "github.com/brazilian-utils/go/renavam"

renavam.IsValid("72028649661")  // true
renavam.IsValid("72028649662")  // false
renavam.IsValid("00000000000")  // false
```
