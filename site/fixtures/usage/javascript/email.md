<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidEmail } from '@brazilian-utils/brazilian-utils';

isValidEmail('abc');  // false
isValidEmail('');     // false
isValidEmail('   ');  // false
```
