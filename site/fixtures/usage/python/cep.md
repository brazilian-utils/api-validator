## isValid

```python
from brutils import is_valid_cep

is_valid_cep("01310200")  # True
is_valid_cep("12345")  # False
is_valid_cep("abcdefgh")  # False
```

## format

```python
from brutils import format_cep

format_cep("01310200")  # '01310-200'
format_cep("12345")  # None (invalid input)
```

## removeSymbols

```python
from brutils import remove_symbols_cep

remove_symbols_cep("01310-200")  # '01310200'
remove_symbols_cep("123-45.678.9")  # '123456789'
```

## generate

```python
from brutils import generate_cep

generate_cep()  # '77520503'
```

## getAddressInfo

Network call, uses the ViaCEP API. Returns `None` when the CEP is not found unless `raise_exceptions=True`.

```python
from brutils import get_address_from_cep

get_address_from_cep("01310200")
# {'cep': '01310-200', 'logradouro': 'Avenida Paulista', 'bairro': 'Bela Vista',
#  'localidade': 'São Paulo', 'uf': 'SP', 'ibge': '3550308', 'ddd': '11', ...}
```

## getInfoByAddress

Network call, uses the ViaCEP API.

```python
from brutils import get_cep_information_from_address

get_cep_information_from_address("SP", "São Paulo", "Avenida Paulista")
# [{'cep': '01310-200', 'logradouro': 'Avenida Paulista', 'bairro': 'Bela Vista', 'uf': 'SP', ...}, ...]
```
