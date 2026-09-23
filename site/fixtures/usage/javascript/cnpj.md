## validate

```js
import { isValidCnpj } from '@brazilian-utils/brazilian-utils';

isValidCnpj('03560714000142'); // true
isValidCnpj('12OUT345000199', { version: 2 }); // true (alphanumeric)
isValidCnpj('15515147234255'); // false
```

## format

```js
import { formatCnpj } from '@brazilian-utils/brazilian-utils';

formatCnpj('24522200000174'); // '24.522.200/0001-74'
formatCnpj('245222000174', { pad: true }); // '00.245.222/0001-74'
formatCnpj('12OUT345000199', { version: 2 }); // '12.OUT.345/0001-99'
```

## remove-symbols

```js
import { parseCnpj } from '@brazilian-utils/brazilian-utils';

parseCnpj('24.522.200/0001-74'); // '24522200000174'
parseCnpj('12.OUT.345/0001-99', { version: 2 }); // '12OUT345000199'
```

## generate

```js
import { generateCnpj } from '@brazilian-utils/brazilian-utils';

generateCnpj(); // a random valid numeric CNPJ
generateCnpj(2); // a random valid alphanumeric CNPJ
```
