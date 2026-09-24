<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/pis-utils'

BrazilianUtils::PISUtils.valid?('55984775363')  # => true
BrazilianUtils::PISUtils.valid?('55984775364')  # => false
BrazilianUtils::PISUtils.valid?('36365790380')  # => true
```

## format

```ruby
require 'brazilian-utils/pis-utils'

BrazilianUtils::PISUtils.format('55984775363')  # => '559.84775.36-3'
BrazilianUtils::PISUtils.format('00000000000')  # => '000.00000.00-0'
BrazilianUtils::PISUtils.format('36365790380')  # => '363.65790.38-0'
```

## generate

```ruby
require 'brazilian-utils/pis-utils'

BrazilianUtils::PISUtils.generate()  # => random valid value
```
