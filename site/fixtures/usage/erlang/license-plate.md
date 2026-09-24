<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `docs usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```erlang
brutils:is_valid_license_plate(<<"WDG1S21">>).  % true
brutils:is_valid_license_plate(<<"abc">>).      % false
brutils:is_valid_license_plate(<<"WDG1S22">>).  % true
```

## format

```erlang
brutils:format_license_plate(<<"wdg1s21">>).  % {ok, <<"WDG1S21">>}
brutils:format_license_plate(<<"gjg8u81">>).  % {ok, <<"GJG8U81">>}
brutils:format_license_plate(<<"kds4w15">>).  % {ok, <<"KDS4W15">>}
```

## generate

```erlang
brutils:generate_license_plate().  % random valid value
```

## convertToMercosul

```erlang
brutils:convert_license_plate_to_mercosul(<<"ABC1234">>).  % {ok, <<"ABC1C34">>}
brutils:convert_license_plate_to_mercosul(<<"ABC0000">>).  % {ok, <<"ABC0A00">>}
brutils:convert_license_plate_to_mercosul(<<"ABC9999">>).  % {ok, <<"ABC9J99">>}
```
