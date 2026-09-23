<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidBoleto } from '@brazilian-utils/brazilian-utils';

isValidBoleto('60757135008571297205909229083648919190488862573');  // true
isValidBoleto('60757135008571297205909229083648919190488862574');  // false
isValidBoleto('00000000000000000000000000000000000000000000000');  // false
```

## format

```js
import { formatBoleto } from '@brazilian-utils/brazilian-utils';

formatBoleto('10491443385511900000200000000141325230000093423');  // '10491.44338 55119.000002 00000.000141 3 25230000093423'
formatBoleto('104914');                                           // '10491.4'
formatBoleto('');                                                 // ''
```

## parse

```js
import { parseBoleto } from '@brazilian-utils/brazilian-utils';

parseBoleto('10491.44338 55119.000002 00000.000141 3 25230000093423');   // '10491443385511900000200000000141325230000093423'
parseBoleto('84610000000-5 24610029110-2 00546033900-4 69589506108-0');  // '846100000005246100291102005460339004695895061080'
parseBoleto('');                                                         // ''
```

## generate

```js
import { generateBoleto } from '@brazilian-utils/brazilian-utils';

generateBoleto();  // random valid value
```
