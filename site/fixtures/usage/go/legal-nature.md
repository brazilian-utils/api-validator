<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```go
import "github.com/brazilian-utils/go/legalnature"

legalnature.IsValid("3329")  // false
legalnature.IsValid("2240")  // true
legalnature.IsValid("0000")  // false
```

## getDescription

```go
import "github.com/brazilian-utils/go/legalnature"

legalnature.GetDescription("2240")   // "Sociedade Simples Limitada"
legalnature.GetDescription("224-0")  // "Sociedade Simples Limitada"
```
