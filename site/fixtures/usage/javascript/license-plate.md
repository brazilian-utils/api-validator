## isValid

```js
import { isValidLicensePlate } from '@brazilian-utils/brazilian-utils';

isValidLicensePlate('ABC1234'); // true (pre-Mercosur)
isValidLicensePlate('ABC-1234'); // true (pre-Mercosur with hyphen)
isValidLicensePlate('ABC1D23'); // true (Mercosur, cars)
isValidLicensePlate('ABC12D3'); // true (Mercosur, motorcycles)
```

## format

```js
import { formatLicensePlate } from '@brazilian-utils/brazilian-utils';

formatLicensePlate('abc1234'); // 'ABC-1234'
formatLicensePlate('abc1d23'); // 'ABC1D23'
```

## parse

```js
import { parseLicensePlate } from '@brazilian-utils/brazilian-utils';

parseLicensePlate('abc-1234'); // 'ABC1234'
```

## generate

```js
import { generateLicensePlate } from '@brazilian-utils/brazilian-utils';

generateLicensePlate(); // 'ABC1D23'
generateLicensePlate('LLLNNNN'); // 'ABC1234'
generateLicensePlate('LLLNNLN'); // 'ABC12D3'
```

## getFormat

```js
import { getFormatLicensePlate } from '@brazilian-utils/brazilian-utils';

getFormatLicensePlate('ABC-1234'); // 'LLLNNNN'
getFormatLicensePlate('ABC1D23'); // 'LLLNLNN'
getFormatLicensePlate('INVALID'); // null
```

## convertToMercosul

```js
import { convertLicensePlateToMercosul } from '@brazilian-utils/brazilian-utils';

convertLicensePlateToMercosul('ABC1234');  // 'ABC1C34'
convertLicensePlateToMercosul('ABC0000');  // 'ABC0A00'
convertLicensePlateToMercosul('ABC9999');  // 'ABC9J99'
```
