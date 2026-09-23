<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```erlang
brutils:is_valid_cpf(<<"83159562131">>).  % true
brutils:is_valid_cpf(<<"83159562132">>).  % false
brutils:is_valid_cpf(<<"00000000000">>).  % false
```

## format

```erlang
brutils:format_cpf(<<"83159562131">>).  % {ok, <<"831.595.621-31">>}
brutils:format_cpf(<<"02746891972">>).  % {ok, <<"027.468.919-72">>}
brutils:format_cpf(<<"52708175602">>).  % {ok, <<"527.081.756-02">>}
```

## generate

```erlang
brutils:generate_cpf().  % random valid value
```
