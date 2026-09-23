<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidRenavam } from '@brazilian-utils/brazilian-utils';

isValidRenavam('72028649661');  // true
isValidRenavam('72028649662');  // false
isValidRenavam('00000000000');  // false
```

## generate

```js
import { generateRenavam } from '@brazilian-utils/brazilian-utils';

generateRenavam();  // random valid value
```
