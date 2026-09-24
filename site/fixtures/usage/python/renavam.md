<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```python
from brutils import is_valid_renavam

is_valid_renavam('72028649661')  # True
is_valid_renavam('72028649662')  # False
is_valid_renavam('00000000000')  # False
```
