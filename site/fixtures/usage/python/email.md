<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```python
from brutils import is_valid_email

is_valid_email('abc')  # False
is_valid_email('')     # False
is_valid_email('   ')  # False
```
