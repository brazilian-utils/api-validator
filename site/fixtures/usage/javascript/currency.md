<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## format

```js
import { formatCurrency } from '@brazilian-utils/brazilian-utils';

formatCurrency(1000.01);  // '1.000,01'
formatCurrency(0.01);     // '0,01'
formatCurrency(1);        // '1,00'
```

## parse

```js
import { parseCurrency } from '@brazilian-utils/brazilian-utils';

parseCurrency('R$ 1.234,56');   // 1234.56
parseCurrency('R$ 0,50');       // 0.5
parseCurrency('1.000.000,50');  // 1000000.5
```

## convertToWords

```js
import { convertCurrencyToWords } from '@brazilian-utils/brazilian-utils';

convertCurrencyToWords(0);     // 'zero reais'
convertCurrencyToWords(0.01);  // 'um centavo'
convertCurrencyToWords(1);     // 'um real'
```
