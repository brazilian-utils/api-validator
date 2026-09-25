"""PEP 702 deprecation, as recognised by griffe-warnings-deprecated."""
from typing_extensions import deprecated


@deprecated("use cpf.is_valid")
def validate(cpf):
    return len(cpf) == 11
