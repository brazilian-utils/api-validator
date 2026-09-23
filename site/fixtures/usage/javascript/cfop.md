<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCfop } from '@brazilian-utils/brazilian-utils';

isValidCfop('5102');   // true
isValidCfop('0000');   // false
isValidCfop('5.102');  // true
```

## parse

```js
import { parseCfop } from '@brazilian-utils/brazilian-utils';

parseCfop('5.102');         // '5102'
parseCfop('');              // ''
parseCfop('5?ABC.102abc');  // '5102'
```

## get

```js
import { getCfop } from '@brazilian-utils/brazilian-utils';

getCfop('5102');   // { code: '5102', description: 'Venda de mercadoria adquirida ou recebida de terceiros, ou …
getCfop('1100');   // null
getCfop('5.102');  // { code: '5102', description: 'Venda de mercadoria adquirida ou recebida de terceiros, ou …
```
