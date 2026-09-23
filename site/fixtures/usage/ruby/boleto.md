<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/boleto-utils'

BrazilianUtils::BoletoUtils.valid?('60757135008571297205909229083648919190488862573')  # => true
BrazilianUtils::BoletoUtils.valid?('60757135008571297205909229083648919190488862574')  # => false
BrazilianUtils::BoletoUtils.valid?('00000000000000000000000000000000000000000000000')  # => false
```
