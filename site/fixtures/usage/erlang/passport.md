<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```erlang
brutils:is_valid_passport(<<"AA111111">>).  % true
brutils:is_valid_passport(<<"1">>).         % false
brutils:is_valid_passport(<<"CL125167">>).  % true
```

## format

```erlang
brutils:format_passport(<<"AB-123.456">>).  % {ok, <<"AB123456">>}
brutils:format_passport(<<"AB123456">>).    % {ok, <<"AB123456">>}
```

## generate

```erlang
brutils:generate_passport().  % random valid value
```
