## isValid

```js
import { isValidCpf } from '@brazilian-utils/brazilian-utils';

isValidCpf('11144477735'); // true
isValidCpf('111.444.777-35'); // true
isValidCpf('00000000000'); // false (reserved number)
isValidCpf('155151475'); // false
```

## format

```js
import { formatCpf } from '@brazilian-utils/brazilian-utils';

formatCpf('74650688000'); // '746.506.880-00'
formatCpf('746506880', { pad: true }); // '007.465.068-80'
```

## parse

```js
import { parseCpf } from '@brazilian-utils/brazilian-utils';

parseCpf('746.506.880-00'); // '74650688000'
```

## generate

```js
import { generateCpf } from '@brazilian-utils/brazilian-utils';

generateCpf(); // a random valid CPF, e.g. '17433964657'
```
