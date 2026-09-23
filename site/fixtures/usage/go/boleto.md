<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```go
import "github.com/brazilian-utils/go/boleto"

boleto.IsValid("60757135008571297205909229083648919190488862573")  // true
boleto.IsValid("60757135008571297205909229083648919190488862574")  // false
boleto.IsValid("00000000000000000000000000000000000000000000000")  // false
```
