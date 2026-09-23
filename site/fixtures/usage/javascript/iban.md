<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidIban } from '@brazilian-utils/brazilian-utils';

isValidIban('BR1500000000000010932840814P2');         // true
isValidIban('BR1500000000000010932840814P3');         // false
isValidIban('BR15 0000 0000 0000 1093 2840 814P 2');  // true
```

## format

```js
import { formatIban } from '@brazilian-utils/brazilian-utils';

formatIban('BR1500000000000010932840814P2');  // 'BR15 0000 0000 0000 1093 2840 814P 2'
formatIban('BR150');                          // 'BR15 0'
formatIban('');                               // ''
```

## parse

```js
import { parseIban } from '@brazilian-utils/brazilian-utils';

parseIban('BR15 0000 0000 0000 1093 2840 814P 2');  // 'BR1500000000000010932840814P2'
parseIban('');                                      // ''
parseIban('br15-0000.0000/0000 1093 2840 814p-2');  // 'BR1500000000000010932840814P2'
```

## getInfo

```js
import { getIbanInfo } from '@brazilian-utils/brazilian-utils';

getIbanInfo('BR1500000000000010932840814P2');  // { countryCode: 'BR', checkDigits: '15', bankIspb: '00000000', branch: '00001', account: '…
getIbanInfo('BR3860701190000010000012345C1');  // { countryCode: 'BR', checkDigits: '38', bankIspb: '60701190', branch: '00001', account: '…
getIbanInfo('BR1500000000000010932840814P3');  // null
```
