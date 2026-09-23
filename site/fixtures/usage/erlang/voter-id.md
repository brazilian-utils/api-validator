<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```erlang
brutils:is_valid_voter_id(<<"652688902801">>).  % true
brutils:is_valid_voter_id(<<"652688902802">>).  % false
brutils:is_valid_voter_id(<<"000000000000">>).  % false
```

## format

```erlang
brutils:format_voter_id(<<"652688902801">>).  % {ok, <<"6526 8890 28 01">>}
brutils:format_voter_id(<<"051401322801">>).  % {ok, <<"0514 0132 28 01">>}
brutils:format_voter_id(<<"859962902836">>).  % {ok, <<"8599 6290 28 36">>}
```

## generate

```erlang
brutils:generate_voter_id().  % random valid value
```
