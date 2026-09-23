<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```erlang
brutils:is_valid_pis(<<"55984775363">>).  % true
brutils:is_valid_pis(<<"55984775364">>).  % false
brutils:is_valid_pis(<<"36365790380">>).  % true
```

## format

```erlang
brutils:format_pis(<<"55984775363">>).  % {ok, <<"559.84775.36-3">>}
brutils:format_pis(<<"00000000000">>).  % {ok, <<"000.00000.00-0">>}
brutils:format_pis(<<"36365790380">>).  % {ok, <<"363.65790.38-0">>}
```

## generate

```erlang
brutils:generate_pis().  % random valid value
```
