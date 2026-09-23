<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCreditCard } from '@brazilian-utils/brazilian-utils';

isValidCreditCard('4111111111111111');  // true
isValidCreditCard('4111111111111112');  // false
isValidCreditCard('5555555555554444');  // true
```
