<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCnae } from '@brazilian-utils/brazilian-utils';

isValidCnae('6201501');    // true
isValidCnae('0000000');    // false
isValidCnae('6201-5/01');  // true
```

## format

```js
import { formatCnae } from '@brazilian-utils/brazilian-utils';

formatCnae('6201501');  // '6201-5/01'
formatCnae('62015');    // '6201-5'
formatCnae('');         // ''
```

## parse

```js
import { parseCnae } from '@brazilian-utils/brazilian-utils';

parseCnae('6201-5/01');         // '6201501'
parseCnae('');                  // ''
parseCnae('62?ABC01-5/01abc');  // '6201501'
```

## get

```js
import { getCnae } from '@brazilian-utils/brazilian-utils';

getCnae('6201501');    // { code: '6201501', description: 'DESENVOLVIMENTO DE PROGRAMAS DE COMPUTADOR SOB ENCOMENDA…
getCnae('0111-3/01');  // { code: '0111301', description: 'CULTIVO DE ARROZ' }
getCnae('0000000');    // null
```
