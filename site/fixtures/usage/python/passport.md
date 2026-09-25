<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```python
from brutils import is_valid_passport

is_valid_passport('AA111111')  # True
is_valid_passport('1')         # False
is_valid_passport('CL125167')  # True
```

## format

```python
from brutils import format_passport

format_passport('AB-123.456')  # 'AB123456'
format_passport('AB123456')    # 'AB123456'
```

## generate

```python
from brutils import generate_passport

generate_passport()  # random valid value
```
