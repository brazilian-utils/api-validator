#!/usr/bin/env escript
%% Conformance runner for Erlang libs. Protocol: src/languages/shared/process-runner.ts
%% usage: escript runner.escript <ebin_dir> <calls_file>
%% The calls file holds one term per call: {Id :: binary(), Module, Function, Args :: list()}.
%% Results are printed as JSON after the "\0JSON\0" marker.
-mode(compile).

main([Ebin, CallsFile]) ->
    true = code:add_patha(Ebin),
    {ok, Calls} = file:consult(CallsFile),
    Results = [run(C) || C <- Calls],
    io:put_chars([0, "JSON", 0, json_array(Results)]),
    halt(0).

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
