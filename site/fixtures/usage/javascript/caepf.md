<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCaepf } from '@brazilian-utils/brazilian-utils';

isValidCaepf('293.118.610/001-84');  // true
isValidCaepf('29311861000185');      // false
isValidCaepf('29311861000184');      // true
```

## format

```js
import { formatCaepf } from '@brazilian-utils/brazilian-utils';

formatCaepf('29311861000184');  // '293.118.610/001-84'
formatCaepf('2931');            // '293.1'
formatCaepf('');                // ''
```

## parse

```js
import { parseCaepf } from '@brazilian-utils/brazilian-utils';

parseCaepf('293.118.610/001-84');         // '29311861000184'
parseCaepf('');                           // ''
parseCaepf('293.?ABC118.610/001-84abc');  // '29311861000184'
```
