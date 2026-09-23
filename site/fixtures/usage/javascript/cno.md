<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCno } from '@brazilian-utils/brazilian-utils';

isValidCno('110840168062');     // true
isValidCno('110840168063');     // false
isValidCno('11.084.01680/62');  // true
```

## format

```js
import { formatCno } from '@brazilian-utils/brazilian-utils';

formatCno('111130137368');     // '11.113.01373/68'
formatCno('11113');            // '11.113'
formatCno('11.084.01680/62');  // '11.084.01680/62'
```

## parse

```js
import { parseCno } from '@brazilian-utils/brazilian-utils';

parseCno('11.113.01373/68');         // '111130137368'
parseCno('');                        // ''
parseCno('11.?ABC113.01373/68abc');  // '111130137368'
```
