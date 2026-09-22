module Lib.Cpf

open System

let private helper x = x

// let Commented x = x
let IsValid cpf =
    helper cpf <> ""

let Format (cpf: string) : string option =
    Some cpf

[<Obsolete("use IsValid")>]
let Validate cpf = IsValid cpf

let Generate () =
    "00000000000"

let constantValue = 42

module Nested =
    let Inner (a: int, b: int) = a + b
