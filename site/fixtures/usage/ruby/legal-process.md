<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/legal-process-utils'

BrazilianUtils::LegalProcessUtils.valid?('16669239820269264932')  # => false
BrazilianUtils::LegalProcessUtils.valid?('00000000000000000000')  # => false
BrazilianUtils::LegalProcessUtils.valid?('55079546820269134837')  # => false
```

## format

```ruby
require 'brazilian-utils/legal-process-utils'

BrazilianUtils::LegalProcessUtils.format_legal_process('16669239820269264931')  # => '1666923-98.2026.9.26.4931'
BrazilianUtils::LegalProcessUtils.format_legal_process('16669239820269264932')  # => '1666923-98.2026.9.26.4932'
BrazilianUtils::LegalProcessUtils.format_legal_process('00000000000000000000')  # => '0000000-00.0000.0.00.0000'
```
