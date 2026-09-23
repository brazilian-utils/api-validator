<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/cep-utils'

BrazilianUtils::CEPUtils.valid?('91906292')  # => true
BrazilianUtils::CEPUtils.valid?('abc')       # => false
BrazilianUtils::CEPUtils.valid?('91906293')  # => true
```

## format

```ruby
require 'brazilian-utils/cep-utils'

BrazilianUtils::CEPUtils.format_cep('91906292')  # => '91906-292'
BrazilianUtils::CEPUtils.format_cep('91906293')  # => '91906-293'
BrazilianUtils::CEPUtils.format_cep('00000000')  # => '00000-000'
```

## removeSymbols

```ruby
require 'brazilian-utils/cep-utils'

BrazilianUtils::CEPUtils.remove_symbols('91906-292')  # => '91906292'
BrazilianUtils::CEPUtils.remove_symbols('21749-676')  # => '21749676'
BrazilianUtils::CEPUtils.remove_symbols('41790-070')  # => '41790070'
```

## generate

```ruby
require 'brazilian-utils/cep-utils'

BrazilianUtils::CEPUtils.generate()  # => random valid value
```
