<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## list

```js
import { getMunicipalities } from '@brazilian-utils/brazilian-utils';

getMunicipalities('DF');  // [{ code: '5300108', name: 'Brasília', stateCode: 'DF' }]
getMunicipalities('ZZ');  // []
```

## getByCode

```js
import { getMunicipalityByCode } from '@brazilian-utils/brazilian-utils';

getMunicipalityByCode('3550308');  // { code: '3550308', name: 'São Paulo', stateCode: 'SP' }
getMunicipalityByCode('5101837');  // { code: '5101837', name: 'Boa Esperança do Norte', stateCode: 'MT' }
getMunicipalityByCode('0000000');  // null
```
