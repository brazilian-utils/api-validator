<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidLegalNature } from '@brazilian-utils/brazilian-utils';

isValidLegalNature('3329');  // false
isValidLegalNature('2240');  // true
isValidLegalNature('0000');  // false
```

## format

```js
import { formatLegalNature } from '@brazilian-utils/brazilian-utils';

formatLegalNature('2062');  // '206-2'
formatLegalNature('206');   // '206'
formatLegalNature('');      // ''
```

## parse

```js
import { parseLegalNature } from '@brazilian-utils/brazilian-utils';

parseLegalNature('206-2');   // '2062'
parseLegalNature('');        // ''
parseLegalNature('206299');  // '2062'
```

## generate

```js
import { generateLegalNature } from '@brazilian-utils/brazilian-utils';

generateLegalNature();  // random valid value
```

## get

```js
import { getLegalNature } from '@brazilian-utils/brazilian-utils';

getLegalNature('2062');  // { code: '2062', description: 'Sociedade Empresária Limitada', category: { code: '2', desc…
getLegalNature('2208');  // { code: '2208', description: 'Entidade Binacional Itaipu', category: { code: '2', descrip…
getLegalNature('0000');  // null
```

## list

```js
import { getLegalNatures } from '@brazilian-utils/brazilian-utils';

getLegalNatures();  // { 1015: 'Órgão Público do Poder Executivo Federal', 1023: 'Órgão Público do Poder Executi…
```

## listByCategory

```js
import { getLegalNaturesByCategory } from '@brazilian-utils/brazilian-utils';

getLegalNaturesByCategory('5');  // [{ code: '5010', description: 'Organização Internacional', category: { code: '5', descrip…
getLegalNaturesByCategory('4');  // [{ code: '4014', description: 'Empresa Individual Imobiliária', category: { code: '4', de…
getLegalNaturesByCategory('0');  // []
```
