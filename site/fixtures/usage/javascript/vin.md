<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidVin } from '@brazilian-utils/brazilian-utils';

isValidVin('1HGCM82633A004352');  // true
isValidVin('1HGCM82633A004353');  // false
isValidVin('1M8GDM9AXKP042788');  // true
```
