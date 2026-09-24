<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```python
from brutils import is_valid_legal_process

is_valid_legal_process('16669239820269264932')  # False
is_valid_legal_process('00000000000000000000')  # False
is_valid_legal_process('55079546820269134837')  # False
```

## format

```python
from brutils import format_legal_process

format_legal_process('16669239820269264931')  # '1666923-98.2026.9.26.4931'
format_legal_process('16669239820269264932')  # '1666923-98.2026.9.26.4932'
format_legal_process('00000000000000000000')  # '0000000-00.0000.0.00.0000'
```
