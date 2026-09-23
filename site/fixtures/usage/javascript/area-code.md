<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## getInfo

```js
import { getAreaCodeInfo } from '@brazilian-utils/brazilian-utils';

getAreaCodeInfo('11');  // { areaCode: 11, stateCode: 'SP', stateName: 'São Paulo', regionCode: 'SE', regionName: 'S…
getAreaCodeInfo('61');  // { areaCode: 61, stateCode: 'DF', stateName: 'Distrito Federal', regionCode: 'CO', regionN…
getAreaCodeInfo(42);    // { areaCode: 42, stateCode: 'PR', stateName: 'Paraná', regionCode: 'S', regionName: 'Sul',…
```

## listByState

```js
import { getAreaCodesByState } from '@brazilian-utils/brazilian-utils';

getAreaCodesByState('SP');  // [11, 12, 13, 14, 15, 16, 17, 18, 19]
getAreaCodesByState('AC');  // [68]
getAreaCodesByState('PE');  // [81, 87]
```
