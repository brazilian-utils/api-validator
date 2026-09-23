<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCns } from '@brazilian-utils/brazilian-utils';

isValidCns('123456789010000');     // true
isValidCns('123456789010001');     // false
isValidCns('123 4567 8901 0000');  // true
```

## format

```js
import { formatCns } from '@brazilian-utils/brazilian-utils';

formatCns('123456789010001');     // '123 4567 8901 0001'
formatCns('1234');                // '123 4'
formatCns('898 0000 0004 3208');  // '898 0000 0004 3208'
```

## parse

```js
import { parseCns } from '@brazilian-utils/brazilian-utils';

parseCns('123 4567 8901 0000');         // '123456789010000'
parseCns('');                           // ''
parseCns('123.?ABC4567 8901-0000abc');  // '123456789010000'
```
