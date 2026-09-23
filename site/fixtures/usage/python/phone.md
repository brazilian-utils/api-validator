<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## removeSymbols

```python
from brutils import remove_symbols_phone

remove_symbols_phone('48976-5797')  # '489765797'
remove_symbols_phone('31479-8146')  # '314798146'
remove_symbols_phone('38942-4321')  # '389424321'
```

## removeInternationalDialingCode

```python
from brutils.phone import remove_international_dialing_code

remove_international_dialing_code('48976579784')  # '48976579784'
remove_international_dialing_code('48976579785')  # '48976579785'
remove_international_dialing_code('00000000000')  # '00000000000'
```
