<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```js
import { isValidPixPayload } from '@brazilian-utils/brazilian-utils';

isValidPixPayload('00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D');                                  // true
isValidPixPayload('00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3E');                                  // false
isValidPixPayload('00020126580014br.gov.bcb.pix0136bee05743-4291-4f3c-9259-595df1307ba1520400005303986540510.005802BR5914Alexandre Lima6019Presidente Prudente62180514Um-Id-Qualquer6304D475');  // true
```

## getInfo

```js
import { getPixPayloadInfo } from '@brazilian-utils/brazilian-utils';

getPixPayloadInfo('00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D');                                  // { key: '123e4567-e12b-12d1-a456-426655440000', merchantName: 'Fulano de Tal', merchantCit…
getPixPayloadInfo('00020126580014br.gov.bcb.pix0136bee05743-4291-4f3c-9259-595df1307ba1520400005303986540510.005802BR5914Alexandre Lima6019Presidente Prudente62180514Um-Id-Qualquer6304D475');  // { key: 'bee05743-4291-4f3c-9259-595df1307ba1', merchantName: 'Alexandre Lima', merchantCi…
getPixPayloadInfo('00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3E');                                  // null
```
