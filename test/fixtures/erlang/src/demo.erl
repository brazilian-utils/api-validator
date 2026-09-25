%% @doc Fixture. is_valid(X) -> in a comment must not count.
-module(demo).
-export([is_valid/1,
         format/1,
         generate/0, generate/1, codes/0, valid/1, swapped/2]).
-deprecated([{generate, 1}]).

-type cpf() :: <<_:88>>.
-type kind() :: mobile | landline.

-spec is_valid(term()) -> boolean().
is_valid(<<_:11/binary>> = Cpf) when is_binary(Cpf) -> true;
is_valid(_) -> false.

-spec format(Cpf :: binary()) -> {ok, cpf()} | {error, invalid}.
format(Cpf) ->
    {ok, Cpf}.

-spec generate() -> cpf().
generate() -> <<"00000000000">>.

-spec generate(kind()) -> cpf().
generate(_Kind) -> <<"00000000000">>.

-spec codes() -> [integer()].
codes() -> [61, 62].

%% Pure delegation: an alias of demo:is_valid/1.
valid(Cpf) -> demo:is_valid(Cpf).

%% Arguments reordered: not an alias.
swapped(A, B) -> lists:append(B, A).

not_exported(X) -> X.
