## isValid

```python
from brutils import is_valid_license_plate

is_valid_license_plate("ABC1234")  # True (pre-Mercosur)
is_valid_license_plate("ABC4E67")  # True (Mercosur)
is_valid_license_plate("def5678", type="old_format")  # True
is_valid_license_plate("ABC4E67", type="mercosul")  # True
is_valid_license_plate("GHI-4567")  # False
```

## format

```python
from brutils import format_license_plate

format_license_plate("abc1234")  # 'ABC-1234' (pre-Mercosur, gets a dash)
format_license_plate("abc1d23")  # 'ABC1D23' (Mercosur)
format_license_plate("ABCD123")  # None (invalid input)
```

## generate

```python
from brutils import generate_license_plate

generate_license_plate()  # 'ABC1D23' (Mercosur by default)
generate_license_plate(format="LLLNNNN")  # 'ABC1234'
generate_license_plate(format="invalid")  # None
```

## getFormat

```python
from brutils import get_format_license_plate

get_format_license_plate("ABC1234")  # 'LLLNNNN'
get_format_license_plate("abc1d23")  # 'LLLNLNN'
get_format_license_plate("ABCD123")  # None
```

## convertToMercosul

```python
from brutils import convert_license_plate_to_mercosul

convert_license_plate_to_mercosul("ABC1234")  # 'ABC1C34'
convert_license_plate_to_mercosul("ABC1D23")  # None (already Mercosur)
```
