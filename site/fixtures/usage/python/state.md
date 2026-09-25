<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## getCodeByName

```python
from brutils.ibge.uf import convert_name_to_uf

convert_name_to_uf('São Paulo')            # 'SP'
convert_name_to_uf('Rio Grande do Norte')  # 'RN'
convert_name_to_uf('Distrito Federal')     # 'DF'
```

## getNameByCode

```python
from brutils.ibge.uf import convert_uf_to_name

convert_uf_to_name('SP')      # 'São Paulo'
convert_uf_to_name('  RJ  ')  # 'Rio de Janeiro'
convert_uf_to_name('DF')      # 'Distrito Federal'
```
