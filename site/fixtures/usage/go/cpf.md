<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```go
import "github.com/brazilian-utils/go/cpf"

cpf.IsValid("83159562131")  // true
cpf.IsValid("83159562132")  // false
cpf.IsValid("00000000000")  // false
```

## format

```go
import "github.com/brazilian-utils/go/cpf"

cpf.Format("83159562131")  // "831.595.621-31"
cpf.Format("02746891972")  // "027.468.919-72"
cpf.Format("52708175602")  // "527.081.756-02"
```

## generate

```go
import "github.com/brazilian-utils/go/cpf"

cpf.Generate()  // random valid value
```
