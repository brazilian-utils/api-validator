<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## getByCode

```js
import { getBankByCode } from '@brazilian-utils/brazilian-utils';

getBankByCode('001');  // { code: '001', ispb: '00000000', name: 'Banco do Brasil S.A.' }
getBankByCode('341');  // { code: '341', ispb: '60701190', name: 'ITAÚ UNIBANCO S.A.' }
getBankByCode('999');  // null
```

## getByIspb

```js
import { getBankByIspb } from '@brazilian-utils/brazilian-utils';

getBankByIspb('00000000');  // { code: '001', ispb: '00000000', name: 'Banco do Brasil S.A.' }
getBankByIspb('60701190');  // { code: '341', ispb: '60701190', name: 'ITAÚ UNIBANCO S.A.' }
getBankByIspb('99999999');  // null
```
