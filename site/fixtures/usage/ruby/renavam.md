<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/renavam-utils'

BrazilianUtils::RENAVAMUtils.valid?('72028649661')  # => true
BrazilianUtils::RENAVAMUtils.valid?('72028649662')  # => false
BrazilianUtils::RENAVAMUtils.valid?('00000000000')  # => false
```
