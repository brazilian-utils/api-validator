<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/cpf-utils'

BrazilianUtils::CPFUtils.valid?('83159562131')  # => true
BrazilianUtils::CPFUtils.valid?('83159562132')  # => false
BrazilianUtils::CPFUtils.valid?('00000000000')  # => false
```

## format

```ruby
require 'brazilian-utils/cpf-utils'

BrazilianUtils::CPFUtils.format_cpf('83159562131')  # => '831.595.621-31'
BrazilianUtils::CPFUtils.format_cpf('02746891972')  # => '027.468.919-72'
BrazilianUtils::CPFUtils.format_cpf('52708175602')  # => '527.081.756-02'
```

## removeSymbols

```ruby
require 'brazilian-utils/cpf-utils'

BrazilianUtils::CPFUtils.remove_symbols('831.595.621-31')  # => '83159562131'
BrazilianUtils::CPFUtils.remove_symbols('027.468.919-72')  # => '02746891972'
BrazilianUtils::CPFUtils.remove_symbols('527.081.756-02')  # => '52708175602'
```

## generate

```ruby
require 'brazilian-utils/cpf-utils'

BrazilianUtils::CPFUtils.generate()  # => random valid value
```
