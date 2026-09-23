<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## list

```js
import { getStates } from '@brazilian-utils/brazilian-utils';

getStates();  // [{ code: 'AC', name: 'Acre', regionCode: 'N', regionName: 'Norte', ibgeCode: 12 }, { code…
```

## getByIbgeCode

```js
import { getStateByIbgeCode } from '@brazilian-utils/brazilian-utils';

getStateByIbgeCode('35');  // { code: 'SP', name: 'São Paulo', regionCode: 'SE', regionName: 'Sudeste', ibgeCode: 35 }
getStateByIbgeCode('53');  // { code: 'DF', name: 'Distrito Federal', regionCode: 'CO', regionName: 'Centro-Oeste', ibg…
getStateByIbgeCode('00');  // null
```

## getCodeByName

```js
import { getStateCodeByName } from '@brazilian-utils/brazilian-utils';

getStateCodeByName('São Paulo');            // 'SP'
getStateCodeByName('Rio Grande do Norte');  // 'RN'
getStateCodeByName('Distrito Federal');     // 'DF'
```

## getNameByCode

```js
import { getStateNameByCode } from '@brazilian-utils/brazilian-utils';

getStateNameByCode('SP');      // 'São Paulo'
getStateNameByCode('  RJ  ');  // 'Rio de Janeiro'
getStateNameByCode('DF');      // 'Distrito Federal'
```

## getTimezone

```js
import { getTimezoneByState } from '@brazilian-utils/brazilian-utils';

getTimezoneByState('SP');  // 'America/Sao_Paulo'
getTimezoneByState('AM');  // 'America/Manaus'
getTimezoneByState('AC');  // 'America/Rio_Branco'
```
