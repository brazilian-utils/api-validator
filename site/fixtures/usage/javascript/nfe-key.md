<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidNfeKey } from '@brazilian-utils/brazilian-utils';

isValidNfeKey('35170458716523000119550010000000121000123458');            // true
isValidNfeKey('35170458716523000119550010000000001000123457');            // false
isValidNfeKey('3517 0458 7165 2300 0119 5500 1000 0000 1210 0012 3458');  // true
```

## format

```js
import { formatNfeKey } from '@brazilian-utils/brazilian-utils';

formatNfeKey('35170458716523000119550010000000121000123458');  // '3517 0458 7165 2300 0119 5500 1000 0000 1210 0012 3458'
formatNfeKey('12345');                                         // '1234 5'
formatNfeKey('');                                              // ''
```

## parse

```js
import { parseNfeKey } from '@brazilian-utils/brazilian-utils';

parseNfeKey('3517 0458 7165 2300 0119 5500 1000 0000 1210 0012 3458');  // '35170458716523000119550010000000121000123458'
parseNfeKey('3517 0458');                                               // '35170458'
parseNfeKey('');                                                        // ''
```

## getInfo

```js
import { getNfeKeyInfo } from '@brazilian-utils/brazilian-utils';

getNfeKeyInfo('35170458716523000119550010000000121000123458');  // { stateCode: 'SP', year: 2017, month: 4, taxId: '58716523000119', model: '55', series: 1,…
getNfeKeyInfo('35170458716523000119550010000000121000123459');  // null
getNfeKeyInfo('');                                              // null
```
