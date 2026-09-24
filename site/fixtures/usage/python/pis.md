<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```python
from brutils import is_valid_pis

is_valid_pis('55984775363')  # True
is_valid_pis('55984775364')  # False
is_valid_pis('36365790380')  # True
```

## format

```python
from brutils import format_pis

format_pis('55984775363')  # '559.84775.36-3'
format_pis('00000000000')  # '000.00000.00-0'
format_pis('36365790380')  # '363.65790.38-0'
```

## generate

```python
from brutils import generate_pis

generate_pis()  # random valid value
```
