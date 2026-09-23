<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## convertToWords

```js
import { convertDateToWords } from '@brazilian-utils/brazilian-utils';

convertDateToWords('01/01/2024');  // 'primeiro de janeiro de dois mil e vinte e quatro'
convertDateToWords('02/01/2024');  // 'dois de janeiro de dois mil e vinte e quatro'
convertDateToWords('25/12/2024');  // 'vinte e cinco de dezembro de dois mil e vinte e quatro'
```
