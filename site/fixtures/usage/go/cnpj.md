<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```go
import "github.com/brazilian-utils/go/cnpj"

cnpj.IsValid("10799163989271")  // true
cnpj.IsValid("10799163989272")  // false
cnpj.IsValid("00000000000000")  // false
```

## format

```go
import "github.com/brazilian-utils/go/cnpj"

cnpj.Format("10799163989271")  // "10.799.163/9892-71"
cnpj.Format("64977017647333")  // "64.977.017/6473-33"
cnpj.Format("62932200808587")  // "62.932.200/8085-87"
```
