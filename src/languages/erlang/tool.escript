#!/usr/bin/env escript
%% Erlang side of the api-validator adapter. Output: "\0JSON\0" followed by JSON.
%%
%%   escript tool.escript extract <ebin_dir>
%%       Public API read from the compiled modules (compiled with +debug_info): exports as the
%%       runtime reports them (module_info), specs, types, deprecations and clause variable
%%       names from the abstract code — the compiler's view, not a parse of the source text.
%%
%%   escript tool.escript run <ebin_dir> <calls_file>
%%       Conformance runner. Protocol: src/languages/shared/process-runner.ts. The calls file
%%       holds one term per call: {Id :: binary(), Module, Function, Args :: list()}.
-mode(compile).

main(["extract", Ebin]) ->
    true = code:add_patha(Ebin),
    Beams = filelib:wildcard(filename:join(Ebin, "*.beam")),
    Modules = [extract(B) || B <- lists:sort(Beams)],
    io:put_chars([0, "JSON", 0, json_array(Modules)]),
    halt(0);
main(["run", Ebin, CallsFile]) ->
    true = code:add_patha(Ebin),
    {ok, Calls} = file:consult(CallsFile),
    Results = [run(C) || C <- Calls],
    io:put_chars([0, "JSON", 0, json_array(Results)]),
    halt(0).

%%--------------------------------------------------------------------
%% extract
%%--------------------------------------------------------------------

extract(Beam) ->
    {ok, {Mod, [{abstract_code, Abstract}]}} = beam_lib:chunks(Beam, [abstract_code]),
    Forms = case Abstract of {raw_abstract_v1, F} -> F; _ -> [] end,
    {module, Mod} = code:ensure_loaded(Mod),
    Exports = [FA || {F, _} = FA <- Mod:module_info(exports), F =/= module_info],
    File = hd([Fl || {attribute, _, file, {Fl, _}} <- Forms] ++ [""]),
    Specs = maps:from_list(lists:flatmap(fun spec/1, Forms)),
    Deprecated = lists:flatmap(fun deprecated/1, Forms),
    Clauses = maps:from_list([{{F, A}, {line(L), Cs}} || {function, L, F, A, Cs} <- Forms]),
    Types = [{atom_to_binary(N), type_node(Def)} || {attribute, _, T, {N, Def, _}} <- Forms, T =:= type orelse T =:= opaque],
    Symbols = [symbol(Mod, File, F, A, Specs, Deprecated, Clauses) || {F, A} <- lists:sort(Exports)],
    obj([{<<"module">>, json(Mod)},
         {<<"types">>, obj([{K, json(V)} || {K, V} <- Types])},
         {<<"symbols">>, json_array(Symbols)}]).

symbol(Mod, File, F, A, Specs, Deprecated, Clauses) ->
    {Line, Names} = case maps:find({F, A}, Clauses) of
        {ok, {L, [{clause, _, Pats, _, _} | _]}} -> {L, [var_name(P) || P <- Pats]};
        _ -> {0, lists:duplicate(A, undefined)}
    end,
    {ArgTypes, Ret, RetNode} = maps:get({F, A}, Specs, {lists:duplicate(A, undefined), undefined, undefined}),
    Params = [param(I, N, T) || {I, N, T} <- lists:zip3(lists:seq(1, A), Names, ArgTypes)],
    IsDeprecated = lists:member({F, A}, Deprecated) orelse lists:member({F, '_'}, Deprecated),
    obj([{<<"name">>, json(iolist_to_binary([atom_to_binary(Mod), ".", atom_to_binary(F)]))},
         {<<"params">>, json_array(Params)}]
        ++ [{<<"returns">>, json(Ret)} || Ret =/= undefined]
        ++ [{<<"returnsNode">>, json(RetNode)} || RetNode =/= undefined]
        ++ [{<<"deprecated">>, <<"true">>} || IsDeprecated]
        ++ [{<<"location">>, obj([{<<"file">>, json(bin(File))}, {<<"line">>, json(Line)}])},
            {<<"meta">>, obj([{<<"module">>, json(Mod)}, {<<"arity">>, json(A)}])}]).

param(I, Name, Type) ->
    {N, T, Node} = case Type of
        {ann, AnnName, AnnType, AnnNode} -> {AnnName, AnnType, AnnNode};
        {Text, TypeNode} -> {Name, Text, TypeNode};
        undefined -> {Name, undefined, undefined}
    end,
    PName = case N of undefined -> iolist_to_binary(io_lib:format("arg~b", [I])); _ -> N end,
    obj([{<<"name">>, json(PName)}]
        ++ [{<<"type">>, json(T)} || T =/= undefined]
        ++ [{<<"typeNode">>, json(Node)} || Node =/= undefined]).

spec({attribute, _, spec, {{F, A}, [FunType | _]}}) -> [{{F, A}, fun_type(FunType)}];
spec({attribute, _, spec, {{_M, F, A}, [FunType | _]}}) -> [{{F, A}, fun_type(FunType)}];
spec(_) -> [].

fun_type({type, _, bounded_fun, [Fun, _Constraints]}) -> fun_type(Fun);
fun_type({type, _, 'fun', [{type, _, product, Args}, Ret]}) ->
    {[arg_type(T) || T <- Args], bin(type_text(Ret)), type_node(Ret)}.

arg_type({ann_type, _, [{var, _, Name}, T]}) -> {ann, snake(Name), bin(type_text(T)), type_node(T)};
arg_type(T) -> {bin(type_text(T)), type_node(T)}.

%% Abstract type form (erl_parse) -> the shared structured type tree (src/core/model.ts).
type_node({ann_type, _, [_Var, T]}) -> type_node(T);
type_node({paren_type, _, [T]}) -> type_node(T);
type_node({type, _, union, Ts}) -> #{kind => <<"union">>, 'of' => [type_node(T) || T <- Ts]};
type_node({type, _, tuple, any}) -> #{kind => <<"name">>, name => <<"tuple">>, call => true};
type_node({type, _, tuple, Es}) -> #{kind => <<"tuple">>, 'of' => [type_node(E) || E <- Es]};
type_node({type, _, nil, []}) -> #{kind => <<"list">>, 'of' => #{kind => <<"unknown">>}};
type_node({type, _, binary, _}) -> #{kind => <<"name">>, name => <<"binary">>, call => true};
type_node({type, _, range, _}) -> #{kind => <<"name">>, name => <<"integer">>, call => true};
type_node({type, _, 'fun', _}) -> #{kind => <<"function">>};
type_node({type, _, bounded_fun, _}) -> #{kind => <<"function">>};
type_node({type, _, map, _}) -> #{kind => <<"name">>, name => <<"map">>, call => true};
type_node({type, _, Name, Args}) when is_list(Args) -> call_node(atom_to_binary(Name), Args);
type_node({type, _, Name, _}) -> call_node(atom_to_binary(Name), []);
type_node({user_type, _, Name, Args}) -> call_node(atom_to_binary(Name), Args);
type_node({remote_type, _, [{atom, _, M}, {atom, _, N}, Args]}) ->
    call_node(iolist_to_binary([atom_to_binary(M), ":", atom_to_binary(N)]), Args);
type_node({atom, _, true}) -> #{kind => <<"lit">>, value => true};
type_node({atom, _, false}) -> #{kind => <<"lit">>, value => false};
type_node({atom, _, A}) -> #{kind => <<"name">>, name => atom_to_binary(A)};
type_node({integer, _, I}) -> #{kind => <<"lit">>, value => I};
type_node(Other) -> #{kind => <<"unknown">>, text => bin(type_text(Other))}.

call_node(Name, []) -> #{kind => <<"name">>, name => Name, call => true};
call_node(Name, Args) -> #{kind => <<"name">>, name => Name, call => true, args => [type_node(A) || A <- Args]}.

%% Print a type through erl_pp as the right-hand side of a dummy -type attribute.
type_text(T) ->
    Text = lists:flatten(erl_pp:form({attribute, erl_anno:new(0), type, {t, T, []}})),
    {match, [Body]} = re:run(Text, "::\\s*(.*)\\.\\s*$", [dotall, {capture, all_but_first, list}]),
    string:trim(re:replace(Body, "\\s+", " ", [global, {return, list}])).

deprecated({attribute, _, deprecated, L}) when is_list(L) -> [{F, A} || D <- L, {F, A} <- [dep(D)]];
deprecated({attribute, _, deprecated, D}) -> [dep(D)];
deprecated(_) -> [].
dep({F, A}) -> {F, A};
dep({F, A, _}) -> {F, A}.

var_name({var, _, '_'}) -> undefined;
var_name({var, _, Name}) ->
    case atom_to_list(Name) of "_" ++ _ -> undefined; _ -> snake(Name) end;
var_name({match, _, L, R}) ->
    case var_name(L) of undefined -> var_name(R); N -> N end;
var_name(_) -> undefined.

snake(Name) ->
    S = re:replace(atom_to_list(Name), "([a-z0-9])([A-Z])", "\\1_\\2", [global, {return, list}]),
    list_to_binary(string:lowercase(S)).

line(Anno) -> erl_anno:line(Anno).
bin(L) when is_list(L) -> unicode:characters_to_binary(L);
bin(B) -> B.

%%--------------------------------------------------------------------
%% run
%%--------------------------------------------------------------------

run({Id, M, F, Args}) ->
    code:ensure_loaded(M),
    case erlang:function_exported(M, F, length(Args)) of
        false ->
            obj([{<<"id">>, json(Id)}, {<<"ok">>, <<"false">>}, {<<"unsupported">>, <<"true">>},
                 {<<"error">>, json(iolist_to_binary(io_lib:format("~s:~s/~b is not exported", [M, F, length(Args)])))}]);
        true ->
            try apply(M, F, Args) of
                {error, R} -> absent(Id, R);         % idiomatic "no result"
                {ok, V} -> ok(Id, V);
                V -> ok(Id, V)
            catch
                Class:Reason ->
                    obj([{<<"id">>, json(Id)}, {<<"ok">>, <<"false">>},
                         {<<"error">>, json(iolist_to_binary(io_lib:format("~p:~0p", [Class, Reason])))}])
            end
    end.

%% `{error, _}` is Erlang's idiomatic "no result": it satisfies both `returns: null` and
%% `throws` in the contract (see src/core/conformance.ts).
absent(Id, R) ->
    obj([{<<"id">>, json(Id)}, {<<"ok">>, <<"false">>}, {<<"absent">>, <<"true">>},
         {<<"error">>, json(iolist_to_binary(io_lib:format("{error, ~0p}", [R])))}]).

ok(Id, V) -> obj([{<<"id">>, json(Id)}, {<<"ok">>, <<"true">>}, {<<"value">>, json(V)}]).

obj(Pairs) -> [${, lists:join($,, [[json(K), $:, V] || {K, V} <- Pairs]), $}].
json_array(Items) -> [$[, lists:join($,, Items), $]].

json(null) -> <<"null">>;
json(undefined) -> <<"null">>;
json(nil) -> <<"null">>;
json(true) -> <<"true">>;
json(false) -> <<"false">>;
json(A) when is_atom(A) -> json(atom_to_binary(A, utf8));
json(I) when is_integer(I) -> integer_to_binary(I);
json(F) when is_float(F) -> float_to_binary(F, [short]);
json(B) when is_binary(B) ->
    case unicode:characters_to_list(B, utf8) of
        L when is_list(L) -> [$", [esc(C) || C <- L], $"];
        _ -> json(binary_to_list(B))
    end;
json(T) when is_tuple(T) -> json(tuple_to_list(T));
json(M) when is_map(M) -> obj([{json_key(K), json(V)} || {K, V} <- maps:to_list(M)]);
%% Lists are always arrays: strings are binaries in these libs, and a list of integers such
%% as [61] must not turn into "=".
json(L) when is_list(L) -> json_array([json(X) || X <- L]);
json(Other) -> json(iolist_to_binary(io_lib:format("~0p", [Other]))).

json_key(K) when is_binary(K) -> K;
json_key(K) when is_atom(K) -> atom_to_binary(K, utf8);
json_key(K) -> iolist_to_binary(io_lib:format("~0p", [K])).

esc($") -> "\\\"";
esc($\\) -> "\\\\";
esc(C) when C < 16#20 -> io_lib:format("\\u~4.16.0b", [C]);
esc(C) -> unicode:characters_to_binary([C]).
