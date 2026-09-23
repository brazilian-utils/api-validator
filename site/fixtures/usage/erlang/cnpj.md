<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```erlang
brutils:is_valid_cnpj(<<"10799163989271">>).  % true
brutils:is_valid_cnpj(<<"10799163989272">>).  % false
brutils:is_valid_cnpj(<<"00000000000000">>).  % false
```

## format

```erlang
brutils:format_cnpj(<<"10799163989271">>).  % {ok, <<"10.799.163/9892-71">>}
brutils:format_cnpj(<<"64977017647333">>).  % {ok, <<"64.977.017/6473-33">>}
brutils:format_cnpj(<<"62932200808587">>).  % {ok, <<"62.932.200/8085-87">>}
```

## generate

```erlang
brutils:generate_cnpj().  % random valid value
```
