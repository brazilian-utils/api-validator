<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```erlang
brutils:is_valid_cnh(<<"73918433737">>).  % true
brutils:is_valid_cnh(<<"73918433738">>).  % false
brutils:is_valid_cnh(<<"00000000000">>).  % false
```
