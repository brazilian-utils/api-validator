## validate

```python
from brutils import is_valid_cnpj

is_valid_cnpj("03560714000142")  # True
is_valid_cnpj("9359QAG9000184")  # True (alphanumeric)
is_valid_cnpj("00111222000133")  # False
```

## format

```python
from brutils import format_cnpj

format_cnpj("03560714000142")  # '03.560.714/0001-42'
format_cnpj("98765432100100")  # None (invalid input)
```

## remove-symbols

```python
from brutils import remove_symbols_cnpj

remove_symbols_cnpj("00.111.222/0001-00")  # '00111222000100'
```

## generate

```python
from brutils import generate_cnpj

generate_cnpj()  # '34665388000161'
generate_cnpj(1234)  # '01745284123455' (branch 1234)
generate_cnpj(alphanumeric=True)  # '9359QAG9000184'
generate_cnpj(branch="AB12", alphanumeric=True)  # 'BR2026UTAB1290'
```
