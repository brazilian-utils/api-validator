<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/voter-id-utils'

BrazilianUtils::VoterIdUtils.valid_voter_id?('652688902801')  # => true
BrazilianUtils::VoterIdUtils.valid_voter_id?('652688902802')  # => false
BrazilianUtils::VoterIdUtils.valid_voter_id?('000000000000')  # => false
```

## format

```ruby
require 'brazilian-utils/voter-id-utils'

BrazilianUtils::VoterIdUtils.format('652688902801')  # => '6526 8890 28 01'
BrazilianUtils::VoterIdUtils.format('051401322801')  # => '0514 0132 28 01'
BrazilianUtils::VoterIdUtils.format('859962902836')  # => '8599 6290 28 36'
```

## generate

```ruby
require 'brazilian-utils/voter-id-utils'

BrazilianUtils::VoterIdUtils.generate()  # => random valid value
```
