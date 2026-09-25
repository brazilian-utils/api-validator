module Lib.Tests.CpfTests

open Xunit

[<Fact>]
let ``empty is invalid`` () = Assert.False(Lib.Cpf.IsValid "")
