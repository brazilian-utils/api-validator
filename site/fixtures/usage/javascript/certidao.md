<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidCertidao } from '@brazilian-utils/brazilian-utils';

isValidCertidao('10453901552013100012021000012321');          // true
isValidCertidao('10453901552013100012021000012322');          // false
isValidCertidao('104539 01 55 2013 1 00012 021 0000123 21');  // true
```

## format

```js
import { formatCertidao } from '@brazilian-utils/brazilian-utils';

formatCertidao('10453901552013100012021000012321');  // '104539 01 55 2013 1 00012 021 0000123 21'
formatCertidao('10453901');                          // '104539 01'
formatCertidao('');                                  // ''
```

## parse

```js
import { parseCertidao } from '@brazilian-utils/brazilian-utils';

parseCertidao('104539 01 55 2013 1 00012 021 0000123 21');     // '10453901552013100012021000012321'
parseCertidao('');                                             // ''
parseCertidao('104539.01.55.2013.1.00012.021.0000123-21abc');  // '10453901552013100012021000012321'
```

## getInfo

```js
import { getCertidaoInfo } from '@brazilian-utils/brazilian-utils';

getCertidaoInfo('104539 01 55 2013 1 00012 021 0000123 21');  // { registryCns: '104539', acervo: '01', service: '55', year: 2013, type: 'birth', typeCode…
getCertidaoInfo('094300 01 55 2010 1 00020 112 0000120-87');  // { registryCns: '094300', acervo: '01', service: '55', year: 2010, type: 'birth', typeCode…
getCertidaoInfo('10453901552013100012021000012322');          // null
```
