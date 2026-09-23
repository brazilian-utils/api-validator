<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## capitalize

```js
import { capitalize } from '@brazilian-utils/brazilian-utils';

capitalize('esponja vegetal');  // 'Esponja Vegetal'
capitalize('JOAQUIM JOSÉ');     // 'Joaquim José'
capitalize('fulano de tal');    // 'Fulano de Tal'
```

## removeAccents

```js
import { removeAccents } from '@brazilian-utils/brazilian-utils';

removeAccents('São Paulo');  // 'Sao Paulo'
removeAccents('Açaí');       // 'Acai'
removeAccents('Piauí');      // 'Piaui'
```
