## isValid

```python
from brutils import is_valid_cpf

is_valid_cpf("82178537464")  # True
is_valid_cpf("00011122233")  # False
```

## format

```python
from brutils import format_cpf

format_cpf("82178537464")  # '821.785.374-64'
format_cpf("55550207753")  # '555.502.077-53'
```

## generate

```python
from brutils import generate_cpf

generate_cpf()  # a random valid CPF, e.g. '17433964657'
```
