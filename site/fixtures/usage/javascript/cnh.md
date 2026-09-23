<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCnh } from '@brazilian-utils/brazilian-utils';

isValidCnh('73918433737');  // true
isValidCnh('73918433738');  // false
isValidCnh('00000000000');  // false
```

## format

```js
import { formatCnh } from '@brazilian-utils/brazilian-utils';

formatCnh('00000000119');  // '000000001-19'
formatCnh('0000000011');   // '000000001-1'
formatCnh('');             // ''
```

## parse

```js
import { parseCnh } from '@brazilian-utils/brazilian-utils';

parseCnh('000000001-19');      // '00000000119'
parseCnh('');                  // ''
parseCnh('000.abc000001-19');  // '00000000119'
```

## generate

```js
import { generateCnh } from '@brazilian-utils/brazilian-utils';

generateCnh();  // random valid value
```
