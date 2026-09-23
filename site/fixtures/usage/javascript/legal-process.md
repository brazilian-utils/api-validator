<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidProcessoJuridico } from '@brazilian-utils/brazilian-utils';

isValidProcessoJuridico('16669239820269264932');  // false
isValidProcessoJuridico('00000000000000000000');  // false
isValidProcessoJuridico('55079546820269134837');  // false
```

## format

```js
import { formatProcessoJuridico } from '@brazilian-utils/brazilian-utils';

formatProcessoJuridico('16669239820269264931');  // '1666923-98.2026.9.26.4931'
formatProcessoJuridico('16669239820269264932');  // '1666923-98.2026.9.26.4932'
formatProcessoJuridico('00000000000000000000');  // '0000000-00.0000.0.00.0000'
```

## parse

```js
import { parseProcessoJuridico } from '@brazilian-utils/brazilian-utils';

parseProcessoJuridico('0002080-25.2012.5.15.0049');    // '00020802520125150049'
parseProcessoJuridico('');                             // ''
parseProcessoJuridico('0002080@$25201%!@2515.%0049');  // '00020802520125150049'
```

## generate

```js
import { generateProcessoJuridico } from '@brazilian-utils/brazilian-utils';

generateProcessoJuridico();  // random valid value
```
