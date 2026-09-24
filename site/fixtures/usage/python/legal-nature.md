<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```python
from brutils import is_valid_legal_nature

is_valid_legal_nature('3329')  # False
is_valid_legal_nature('2240')  # True
is_valid_legal_nature('0000')  # False
```

## getDescription

```python
from brutils.legal_nature import get_description

get_description('2240')   # 'Sociedade Simples Limitada'
get_description('224-0')  # 'Sociedade Simples Limitada'
```
