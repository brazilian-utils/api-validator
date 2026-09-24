<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```go
import "github.com/brazilian-utils/go/cnh"

cnh.IsValid("73918433737")  // true
cnh.IsValid("73918433738")  // false
cnh.IsValid("00000000000")  // false
```
