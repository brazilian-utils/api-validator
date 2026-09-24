<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/email-utils'

BrazilianUtils::EmailUtils.valid?('abc')  # => false
BrazilianUtils::EmailUtils.valid?('')     # => false
BrazilianUtils::EmailUtils.valid?('   ')  # => false
```
