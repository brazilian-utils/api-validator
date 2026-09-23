# Ruby harness (brazilian-utils-ruby, RSpec)

`spec/api_contract_spec.rb` goes in the lib at the same path, `spec/api_contract_spec.rb`, next to
the lib's `spec_helper.rb` (loaded with `require_relative`). It runs the vendored suite in
`api-contract/` (found by walking up from the spec file, so any cwd works) with the lib's normal
test command. It needs only Ruby's standard library (`json`, `bigdecimal`, `date`, `set`) and RSpec.

Run:

    bundle exec rspec spec/api_contract_spec.rb     # harness only
    bundle exec rspec                               # whole suite, harness included
    API_CONTRACT_NETWORK=1 bundle exec rspec ...    # also run `network: true` functions
    API_CONTRACT_NO_SKIP=1 bundle exec rspec ... # ignore skip.json (shows what fails today)

Each case is one `it` named by its case id; skipped cases (skip.json, network, `satisfies` target
not implemented) are RSpec pending with the reason; each contract function missing from the
registry shows up as one pending `it` ("not implemented").

Add a registry entry: implement the method in the lib, then add one line to `ApiContract::REGISTRY`
under its domain, mapping the contract function id to a lambda that takes the case's JSON args
(an Array) and returns the lib's result:

    'cpf.isValid' => ->(a) { CPFUtils.valid?(*a) },

Constants resolve inside `BrazilianUtils` (the module is included). Adapt idioms in the lambda
(keyword options, argument order, ...). Results are converted to JSON form (`ApiContract.json_form`:
symbols -> strings, BigDecimal -> Float, Date/Time -> ISO-8601, Struct/objects -> Hash) before
comparison. An id that is not in the suite makes the "registers only contract functions" example fail.
