<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/cnpj-utils'

BrazilianUtils::CNPJUtils.valid?('10799163989271')  # => true
BrazilianUtils::CNPJUtils.valid?('10799163989272')  # => false
BrazilianUtils::CNPJUtils.valid?('00000000000000')  # => false
```

## format

```ruby
require 'brazilian-utils/cnpj-utils'

BrazilianUtils::CNPJUtils.format_cnpj('10799163989271')  # => '10.799.163/9892-71'
BrazilianUtils::CNPJUtils.format_cnpj('64977017647333')  # => '64.977.017/6473-33'
BrazilianUtils::CNPJUtils.format_cnpj('62932200808587')  # => '62.932.200/8085-87'
```

## generate

```ruby
require 'brazilian-utils/cnpj-utils'

BrazilianUtils::CNPJUtils.generate()  # => random valid value
```
