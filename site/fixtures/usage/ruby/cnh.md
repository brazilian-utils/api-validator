<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/cnh-utils'

BrazilianUtils::CNHUtils.valid?('73918433737')  # => true
BrazilianUtils::CNHUtils.valid?('73918433738')  # => false
BrazilianUtils::CNHUtils.valid?('00000000000')  # => false
```
