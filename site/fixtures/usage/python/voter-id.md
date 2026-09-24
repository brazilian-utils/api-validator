<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `doc usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```python
from brutils import is_valid_voter_id

is_valid_voter_id('652688902801')  # True
is_valid_voter_id('652688902802')  # False
is_valid_voter_id('000000000000')  # False
```

## format

```python
from brutils import format_voter_id

format_voter_id('652688902801')  # '6526 8890 28 01'
format_voter_id('051401322801')  # '0514 0132 28 01'
format_voter_id('859962902836')  # '8599 6290 28 36'
```

## generate

```python
from brutils import generate_voter_id

generate_voter_id()  # random valid value
```
