<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidPixKey } from '@brazilian-utils/brazilian-utils';

isValidPixKey('123.456.789-09');      // true
isValidPixKey('11257245286');         // false
isValidPixKey('00.038.166/0001-05');  // true
```

## getInfo

```js
import { getPixKeyInfo } from '@brazilian-utils/brazilian-utils';

getPixKeyInfo('123.456.789-09');                         // { type: 'cpf', value: '12345678909' }
getPixKeyInfo('00.038.166/0001-05');                     // { type: 'cnpj', value: '00038166000105' }
getPixKeyInfo('fulano_da_silva.recebedor@example.com');  // { type: 'email', value: 'fulano_da_silva.recebedor@example.com' }
```
