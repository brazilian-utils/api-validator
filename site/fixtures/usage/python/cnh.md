<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```python
from brutils import is_valid_cnh

is_valid_cnh('73918433737')  # True
is_valid_cnh('73918433738')  # False
is_valid_cnh('00000000000')  # False
```
