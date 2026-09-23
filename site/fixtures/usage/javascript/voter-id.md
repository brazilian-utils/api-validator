<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidVoterId } from '@brazilian-utils/brazilian-utils';

isValidVoterId('652688902801');  // true
isValidVoterId('652688902802');  // false
isValidVoterId('000000000000');  // false
```

## format

```js
import { formatVoterId } from '@brazilian-utils/brazilian-utils';

formatVoterId('652688902801');  // '6526 8890 28 01'
formatVoterId('051401322801');  // '0514 0132 28 01'
formatVoterId('859962902836');  // '8599 6290 28 36'
```

## parse

```js
import { parseVoterId } from '@brazilian-utils/brazilian-utils';

parseVoterId('1234 5678 01 24');    // '123456780124'
parseVoterId('1234 5678 8 01 91');  // '1234567880191'
parseVoterId('');                   // ''
```

## generate

```js
import { generateVoterId } from '@brazilian-utils/brazilian-utils';

generateVoterId();  // random valid value
```
