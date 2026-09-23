<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidNcm } from '@brazilian-utils/brazilian-utils';

isValidNcm('22030000');    // true
isValidNcm('12345678');    // false
isValidNcm('2203.00.00');  // true
```

## format

```js
import { formatNcm } from '@brazilian-utils/brazilian-utils';

formatNcm('84713012');  // '8471.30.12'
formatNcm('84713');     // '8471.3'
formatNcm('');          // ''
```

## parse

```js
import { parseNcm } from '@brazilian-utils/brazilian-utils';

parseNcm('8471.30.12');         // '84713012'
parseNcm('');                   // ''
parseNcm('84?ABC71.30.12abc');  // '84713012'
```
