<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidPassport } from '@brazilian-utils/brazilian-utils';

isValidPassport('AA111111');  // true
isValidPassport('1');         // false
isValidPassport('CL125167');  // true
```

## format

```js
import { formatPassport } from '@brazilian-utils/brazilian-utils';

formatPassport('acd12736');    // 'ACD12736'
formatPassport('AB-123.456');  // 'AB123456'
formatPassport('AB12');        // 'AB12'
```

## parse

```js
import { parsePassport } from '@brazilian-utils/brazilian-utils';

parsePassport('Ab123456');      // 'AB123456'
parsePassport('');              // ''
parsePassport(' AB 123 456 ');  // 'AB123456'
```

## generate

```js
import { generatePassport } from '@brazilian-utils/brazilian-utils';

generatePassport();  // random valid value
```
