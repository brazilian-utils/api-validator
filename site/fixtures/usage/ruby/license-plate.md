<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```ruby
require 'brazilian-utils/license-plate-utils'

BrazilianUtils::LicensePlateUtils.valid?('WDG1S21')  # => true
BrazilianUtils::LicensePlateUtils.valid?('abc')      # => false
BrazilianUtils::LicensePlateUtils.valid?('WDG1S22')  # => true
```

## format

```ruby
require 'brazilian-utils/license-plate-utils'

BrazilianUtils::LicensePlateUtils.format('wdg1s21')  # => 'WDG1S21'
BrazilianUtils::LicensePlateUtils.format('gjg8u81')  # => 'GJG8U81'
BrazilianUtils::LicensePlateUtils.format('kds4w15')  # => 'KDS4W15'
```

## removeSymbols

```ruby
require 'brazilian-utils/license-plate-utils'

BrazilianUtils::LicensePlateUtils.remove_symbols('WDG1S21')  # => 'WDG1S21'
BrazilianUtils::LicensePlateUtils.remove_symbols('WDG1S22')  # => 'WDG1S22'
BrazilianUtils::LicensePlateUtils.remove_symbols('wdg1s21')  # => 'wdg1s21'
```

## generate

```ruby
require 'brazilian-utils/license-plate-utils'

BrazilianUtils::LicensePlateUtils.generate()  # => random valid value
```

## convertToMercosul

```ruby
require 'brazilian-utils/license-plate-utils'

BrazilianUtils::LicensePlateUtils.convert_to_mercosul('ABC1234')  # => 'ABC1C34'
BrazilianUtils::LicensePlateUtils.convert_to_mercosul('ABC0000')  # => 'ABC0A00'
BrazilianUtils::LicensePlateUtils.convert_to_mercosul('ABC9999')  # => 'ABC9J99'
```

## getFormat

```ruby
require 'brazilian-utils/license-plate-utils'

BrazilianUtils::LicensePlateUtils.get_format('WDG1S21')  # => 'LLLNLNN'
BrazilianUtils::LicensePlateUtils.get_format('WDG1S22')  # => 'LLLNLNN'
BrazilianUtils::LicensePlateUtils.get_format('wdg1s21')  # => 'LLLNLNN'
```
