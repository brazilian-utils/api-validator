# .NET (F#, xUnit 2) harness

`BrazilianUtils.Tests/ApiContractTests.fs` goes in the lib's test project, next to the other
test files. Add it to the `<Compile Include>` list of `BrazilianUtils.Tests.fsproj` (last, or
before an entry file if the project has one). It uses only System.Text.Json and the xunit
package the project already references (xunit.extensibility.execution is part of it).

Run it with the lib's normal test command, from any directory:

    dotnet test BrazilianUtils.Tests                                             # whole suite
    dotnet test BrazilianUtils.Tests --filter "FullyQualifiedName~ApiContractTests"
    dotnet test BrazilianUtils.Tests --filter "DisplayName~cpf.isValid"          # one function

Every test is named by its case id (`cpf.isValid#valid-sample`); a function the lib does not
implement shows up as one skipped test named by its function id. Skipped tests carry their
reason (`not implemented`, the `skip.json` reason, a network function, an unimplemented
`satisfies` target). `API_CONTRACT_NETWORK=1` runs the network functions, and
`API_CONTRACT_NO_SKIP=1` ignores `skip.json` (to see which listed cases were fixed).

To add a function: implement it in the lib, then add one line to `registry`, grouped by domain:

    "cpf.isValid", fun a -> box (Cpf.IsValid(str 0 a))

`a` holds the case's JSON args; `str i`, `dec i` and `opt i` (optional string -> `option`)
convert them. Adapt the lib's idiom in that line (tupled or curried arguments, a default for
a parameter the contract makes optional). Return the lib's value as it is: `None` counts as
null, an exception or an F# `Error` as a failure, records/tuples/lists become JSON.

Why a custom `ContractTheory` attribute: xUnit 2 cannot skip one `[<MemberData>]` row at run
time (`Skip` applies to the whole theory, and `Assert.Skip` only exists in xUnit 3), so its
discoverer, a `TheoryDiscoverer` subclass, turns the rows with a skip reason into skipped test
cases at discovery time. It also names each row by its case id (xUnit would show the escaped
argument, truncated after 50 characters) and forces theory pre-enumeration on. With xUnit 3,
replace it with `[<Theory>]` and `Assert.Skip(reason)` in the test body.
