## isValid

```js
import { isValidCep } from '@brazilian-utils/brazilian-utils';

isValidCep('92500000'); // true
```

## format

```js
import { formatCep } from '@brazilian-utils/brazilian-utils';

formatCep('92500000'); // '92500-000'
```

## parse

```js
import { parseCep } from '@brazilian-utils/brazilian-utils';

parseCep('92500-000'); // '92500000'
```

## generate

```js
import { generateCep } from '@brazilian-utils/brazilian-utils';

generateCep(); // '92500000'
```

## getAddressInfo

Network call. Tries several providers (ViaCEP, BrasilAPI) and returns the first answer.

```js
import { getAddressInfoByCep } from '@brazilian-utils/brazilian-utils';

const address = await getAddressInfoByCep('01310100');
// { cep: '01310100', state: 'SP', city: 'São Paulo', neighborhood: 'Bela Vista', street: 'Avenida Paulista' }

await getAddressInfoByCep('01310-100', { providers: ['viacep', 'brasilapi'] });
```

## getInfoByAddress

Network call, uses ViaCEP.

```js
import { getCepInfoByAddress } from '@brazilian-utils/brazilian-utils';

const ceps = await getCepInfoByAddress({
  federalUnit: 'SP',
  city: 'Sao Paulo',
  street: 'Avenida Paulista',
});
// [{ cep: '01310100', logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP', ... }]
```
