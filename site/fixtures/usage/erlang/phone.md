<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```erlang
brutils:is_valid_phone(<<"48976579784">>).  % true
brutils:is_valid_phone(<<"00000000000">>).  % false
brutils:is_valid_phone(<<"48976579785">>).  % true
```

## removeSymbols

```erlang
brutils:remove_symbols_phone(<<"48976-5797">>).  % <<"489765797">>
brutils:remove_symbols_phone(<<"31479-8146">>).  % <<"314798146">>
brutils:remove_symbols_phone(<<"38942-4321">>).  % <<"389424321">>
```

## generate

```erlang
brutils:generate_phone().  % random valid value
```

## removeInternationalDialingCode

```erlang
brutils_phone:remove_international_dialing_code(<<"48976579784">>).  % <<"48976579784">>
brutils_phone:remove_international_dialing_code(<<"48976579785">>).  % <<"48976579785">>
brutils_phone:remove_international_dialing_code(<<"00000000000">>).  % <<"00000000000">>
```
