<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCbo } from '@brazilian-utils/brazilian-utils';

isValidCbo('212405');   // true
isValidCbo('223150');   // false
isValidCbo('2124-05');  // true
```

## parse

```js
import { parseCbo } from '@brazilian-utils/brazilian-utils';

parseCbo('2124-05');         // '212405'
parseCbo('');                // ''
parseCbo('21?ABC24-05abc');  // '212405'
```

## get

```js
import { getCbo } from '@brazilian-utils/brazilian-utils';

getCbo('212405');   // { code: '212405', description: 'Analista de desenvolvimento de sistemas' }
getCbo('0102-05');  // { code: '010205', description: 'Oficial da aeronáutica' }
getCbo('223150');   // null
```
