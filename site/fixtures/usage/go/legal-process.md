<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```go
import "github.com/brazilian-utils/go/legalprocess"

legalprocess.IsValid("16669239820269264932")  // false
legalprocess.IsValid("00000000000000000000")  // false
legalprocess.IsValid("55079546820269134837")  // false
```

## format

```go
import "github.com/brazilian-utils/go/legalprocess"

legalprocess.Format("16669239820269264931")  // "1666923-98.2026.9.26.4931"
legalprocess.Format("16669239820269264932")  // "1666923-98.2026.9.26.4932"
legalprocess.Format("00000000000000000000")  // "0000000-00.0000.0.00.0000"
```
