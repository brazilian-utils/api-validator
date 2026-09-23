<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidPhone } from '@brazilian-utils/brazilian-utils';

isValidPhone('48976579784');  // true
isValidPhone('00000000000');  // false
isValidPhone('48976579785');  // true
```

## format

```js
import { formatPhone } from '@brazilian-utils/brazilian-utils';

formatPhone('988887777');   // '98888-7777'
formatPhone('98888777');    // '98888-777'
formatPhone('1130000000');  // '11300-0000'
```

## parse

```js
import { parsePhone } from '@brazilian-utils/brazilian-utils';

parsePhone('(11) 98888-7777');  // '11988887777'
parsePhone('98888-7777');       // '988887777'
parsePhone('551130000000');     // '1130000000'
```

## generate

```js
import { generatePhone } from '@brazilian-utils/brazilian-utils';

generatePhone();  // random valid value
```

## isValidLandline

```js
import { isValidLandlinePhone } from '@brazilian-utils/brazilian-utils';

isValidLandlinePhone('(11) 3000-0000');  // true
isValidLandlinePhone('11987654321');     // false
isValidLandlinePhone('1130000000');      // true
```

## isValidMobile

```js
import { isValidMobilePhone } from '@brazilian-utils/brazilian-utils';

isValidMobilePhone('(11) 98765-4321');    // true
isValidMobilePhone('1130000000');         // false
isValidMobilePhone('+55 11 98765-4321');  // true
```

## isValidService

```js
import { isValidServicePhone } from '@brazilian-utils/brazilian-utils';

isValidServicePhone('08001234567');    // true
isValidServicePhone('11987654321');    // false
isValidServicePhone('0800 123 4567');  // true
```
