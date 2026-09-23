<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidPis } from '@brazilian-utils/brazilian-utils';

isValidPis('55984775363');  // true
isValidPis('55984775364');  // false
isValidPis('36365790380');  // true
```

## format

```js
import { formatPis } from '@brazilian-utils/brazilian-utils';

formatPis('55984775363');  // '559.84775.36-3'
formatPis('00000000000');  // '000.00000.00-0'
formatPis('36365790380');  // '363.65790.38-0'
```

## parse

```js
import { parsePis } from '@brazilian-utils/brazilian-utils';

parsePis('123.45678.90-1');                // '12345678901'
parsePis('');                              // ''
parsePis('123#Error*&@#45678#Char!90-1');  // '12345678901'
```

## generate

```js
import { generatePis } from '@brazilian-utils/brazilian-utils';

generatePis();  // random valid value
```
