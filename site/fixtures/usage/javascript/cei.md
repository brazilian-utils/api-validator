<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCei } from '@brazilian-utils/brazilian-utils';

isValidCei('11.583.00249/85');  // true
isValidCei('115830024984');     // false
isValidCei('115830024985');     // true
```

## format

```js
import { formatCei } from '@brazilian-utils/brazilian-utils';

formatCei('277297118187');     // '27.729.71181/87'
formatCei('27729');            // '27.729'
formatCei('11.583.00249/85');  // '11.583.00249/85'
```

## parse

```js
import { parseCei } from '@brazilian-utils/brazilian-utils';

parseCei('27.729.71181/87');         // '277297118187'
parseCei('');                        // ''
parseCei('27.?ABC729.71181/87abc');  // '277297118187'
```
