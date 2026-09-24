<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```go
import "github.com/brazilian-utils/go/voterid"

voterid.IsValid("652688902801")  // true
voterid.IsValid("652688902802")  // false
voterid.IsValid("000000000000")  // false
```

## format

```go
import "github.com/brazilian-utils/go/voterid"

voterid.Format("652688902801")  // "6526 8890 28 01"
voterid.Format("051401322801")  // "0514 0132 28 01"
voterid.Format("859962902836")  // "8599 6290 28 36"
```

## generate

```go
import "github.com/brazilian-utils/go/voterid"

voterid.Generate()  // random valid value
```
