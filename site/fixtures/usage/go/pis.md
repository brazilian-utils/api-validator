<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```go
import "github.com/brazilian-utils/go/pis"

pis.IsValid("55984775363")  // true
pis.IsValid("55984775364")  // false
pis.IsValid("36365790380")  // true
```

## format

```go
import "github.com/brazilian-utils/go/pis"

pis.Format("55984775363")  // "559.84775.36-3"
pis.Format("00000000000")  // "000.00000.00-0"
pis.Format("36365790380")  // "363.65790.38-0"
```

## generate

```go
import "github.com/brazilian-utils/go/pis"

pis.Generate()  // random valid value
```
