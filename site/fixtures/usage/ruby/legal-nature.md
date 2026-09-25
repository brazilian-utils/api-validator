<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/legal-nature-utils'

BrazilianUtils::LegalNatureUtils.valid?('3329')  # => false
BrazilianUtils::LegalNatureUtils.valid?('2240')  # => true
BrazilianUtils::LegalNatureUtils.valid?('0000')  # => false
```

## getDescription

```ruby
require 'brazilian-utils/legal-nature-utils'

BrazilianUtils::LegalNatureUtils.get_description('2240')   # => 'Sociedade Simples Limitada'
BrazilianUtils::LegalNatureUtils.get_description('224-0')  # => 'Sociedade Simples Limitada'
```
