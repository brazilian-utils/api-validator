import warnings
from typing import Optional


def is_valid(cpf: str) -> bool:
    return len(cpf) == 11


def format_cpf(cpf: str, *, pad: bool = False) -> Optional[str]:
    return cpf


def validate(cpf):
    warnings.warn("use is_valid", DeprecationWarning)
    return is_valid(cpf)


def _helper(x):
    return x


def generate(count: int = 1, *more: str) -> list[str]:
    return []
