<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```erlang
brutils:is_valid_cep(<<"91906292">>).  % true
brutils:is_valid_cep(<<"abc">>).       % false
brutils:is_valid_cep(<<"91906293">>).  % true
```

## format

```erlang
brutils:format_cep(<<"91906292">>).  % {ok, <<"91906-292">>}
brutils:format_cep(<<"91906293">>).  % {ok, <<"91906-293">>}
brutils:format_cep(<<"00000000">>).  % {ok, <<"00000-000">>}
```

## removeSymbols

```erlang
brutils:remove_symbols_cep(<<"91906-292">>).  % <<"91906292">>
brutils:remove_symbols_cep(<<"21749-676">>).  % <<"21749676">>
brutils:remove_symbols_cep(<<"41790-070">>).  % <<"41790070">>
```

## generate

```erlang
brutils:generate_cep().  % random valid value
```
