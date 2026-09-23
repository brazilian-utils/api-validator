<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```go
import "github.com/brazilian-utils/go/cep"

cep.IsValid("91906292")  // true
cep.IsValid("abc")       // false
cep.IsValid("91906293")  // true
```

## format

```go
import "github.com/brazilian-utils/go/cep"

cep.Format("91906292")  // "91906-292"
cep.Format("91906293")  // "91906-293"
cep.Format("00000000")  // "00000-000"
```

## generate

```go
import "github.com/brazilian-utils/go/cep"

cep.Generate()  // random valid value
```
