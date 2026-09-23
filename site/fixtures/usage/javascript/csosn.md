<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCsosn } from '@brazilian-utils/brazilian-utils';

isValidCsosn('101');  // true
isValidCsosn('999');  // false
isValidCsosn('102');  // true
```
