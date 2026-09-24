<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## removeInternationalDialingCode

```python
from brutils.phone import remove_international_dialing_code

remove_international_dialing_code('48976579784')  # '48976579784'
remove_international_dialing_code('48976579785')  # '48976579785'
remove_international_dialing_code('00000000000')  # '00000000000'
```
