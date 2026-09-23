"""Runs the brazilian-utils API contract suite vendored in ``api-contract/``.

The suite (JSON test vectors shared by every brazilian-utils implementation)
is maintained in https://github.com/brazilian-utils/api-validator; never edit
the copy here. This file only says which brutils function implements each
contract function (``REGISTRY``) and how results are compared.

Each case becomes one test method named after its case id, e.g.
``test_cpf.isValid#["83159562131"]``. Run it alone with:

    python -m unittest tests.test_api_contract -v

Set ``API_CONTRACT_NETWORK=1`` to also run the functions that need network,
``API_CONTRACT_NO_SKIP=1`` to ignore skip.json.
"""

import dataclasses
import datetime
import decimal
import enum
import json
import os
import re
from pathlib import Path
from unittest import TestCase

import brutils
from brutils import currency, legal_nature, phone
from brutils.ibge import uf


def call(fn):
    """Registry entry for a function taking the contract args positionally."""
    return lambda args: fn(*args)


# Contract function id -> callable taking the case's JSON ``args`` (a list).
# Add one line when brutils implements a new contract function.
REGISTRY = {
    # CEP
    "cep.format": call(brutils.format_cep),
    "cep.generate": call(brutils.generate_cep),
    "cep.isValid": call(brutils.is_valid_cep),
    "cep.removeSymbols": call(brutils.remove_symbols_cep),
    # CNH
    "cnh.isValid": call(brutils.is_valid_cnh),
    # CNPJ
    "cnpj.format": call(brutils.format_cnpj),
    "cnpj.generate": call(brutils.generate_cnpj),
    "cnpj.isValid": call(brutils.is_valid_cnpj),
    "cnpj.removeSymbols": call(brutils.remove_symbols_cnpj),
    # CPF
    "cpf.format": call(brutils.format_cpf),
    "cpf.generate": call(brutils.generate_cpf),
    "cpf.isValid": call(brutils.is_valid_cpf),
    "cpf.removeSymbols": call(brutils.remove_symbols_cpf),
    # Currency
    "currency.convertToWords": call(currency.convert_real_to_text),
    "currency.format": call(brutils.format_currency),
    # Email
    "email.isValid": call(brutils.is_valid_email),
    # Legal nature
    "legalNature.getDescription": call(legal_nature.get_description),
    "legalNature.isValid": call(brutils.is_valid_legal_nature),
    "legalNature.list": call(brutils.list_all_legal_nature),
    # Legal process
    "legalProcess.format": call(brutils.format_legal_process),
    "legalProcess.isValid": call(brutils.is_valid_legal_process),
    "legalProcess.removeSymbols": call(brutils.remove_symbols_legal_process),
    # License plate
    "licensePlate.convertToMercosul": call(
        brutils.convert_license_plate_to_mercosul
    ),
    "licensePlate.format": call(brutils.format_license_plate),
    "licensePlate.generate": call(brutils.generate_license_plate),
    "licensePlate.getFormat": call(brutils.get_format_license_plate),
    "licensePlate.isValid": call(brutils.is_valid_license_plate),
    "licensePlate.removeSymbols": call(brutils.remove_symbols_license_plate),
    # Passport
    "passport.format": call(brutils.format_passport),
    "passport.generate": call(brutils.generate_passport),
    "passport.isValid": call(brutils.is_valid_passport),
    "passport.removeSymbols": call(brutils.remove_symbols_passport),
    # Phone
    "phone.format": call(brutils.format_phone),
    "phone.generate": call(brutils.generate_phone),
    "phone.removeInternationalDialingCode": call(
        phone.remove_international_dialing_code
    ),
    "phone.removeSymbols": call(brutils.remove_symbols_phone),
    # PIS
    "pis.format": call(brutils.format_pis),
    "pis.generate": call(brutils.generate_pis),
    "pis.isValid": call(brutils.is_valid_pis),
    "pis.removeSymbols": call(brutils.remove_symbols_pis),
    # RENAVAM
    "renavam.isValid": call(brutils.is_valid_renavam),
    # State (IBGE)
    "state.getCodeByName": call(uf.convert_name_to_uf),
    "state.getNameByCode": call(uf.convert_uf_to_name),
    # Voter ID
    "voterId.format": call(brutils.format_voter_id),
    "voterId.generate": call(brutils.generate_voter_id),
    "voterId.isValid": call(brutils.is_valid_voter_id),
}


# --- Loading ------------------------------------------------------------------


def find_contract_dir():
    """``api-contract/`` of this repository, whatever the working directory."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "api-contract"
        if (candidate / "cases" / "index.json").is_file():
            return candidate
    raise FileNotFoundError("api-contract/ not found above " + __file__)


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


CONTRACT_DIR = find_contract_dir()
CASES_DIR = CONTRACT_DIR / "cases"
# API_CONTRACT_NO_SKIP=1 runs the cases skip.json lists too (to see what a fix unlocked).
SKIP = (
    {}
    if os.environ.get("API_CONTRACT_NO_SKIP") == "1"
    else load_json(CONTRACT_DIR / "skip.json")
)
DOMAINS = [
    load_json(path)
    for path in sorted(CASES_DIR.glob("*.json"))
    if path.name not in ("index.json", "equality.json")
]
NETWORK = os.environ.get("API_CONTRACT_NETWORK") == "1"


# --- Comparison (rules: api-contract/cases/index.json -> comparison) ----------


def to_json(value):
    """The JSON form of a result: dates as ISO strings, enums as values..."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, enum.Enum):
        return to_json(value.value)
    if isinstance(value, (datetime.date, datetime.time)):
        return value.isoformat()
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return to_json(dataclasses.asdict(value))
    if hasattr(value, "_asdict"):
        return to_json(value._asdict())
    if isinstance(value, dict):
        return {str(k): to_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [to_json(v) for v in value]
    if hasattr(value, "__dict__"):
        return {
            k: to_json(v)
            for k, v in vars(value).items()
            if not k.startswith("_")
        }
    return repr(value)


def flat_key(key):
    return re.sub(r"[^a-z0-9]", "", key.lower())


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def values_equal(expected, actual):
    """Compares a JSON expectation with a result already in JSON form."""
    if expected is None:
        return actual is None
    if is_number(expected) and is_number(actual):
        return abs(expected - actual) <= 1e-9 * max(1, abs(expected))
    if isinstance(expected, list):
        return (
            isinstance(actual, list)
            and len(actual) == len(expected)
            and all(map(values_equal, expected, actual))
        )
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return False
        e = {flat_key(k): v for k, v in expected.items()}
        a = {flat_key(k): v for k, v in actual.items()}
        return all(
            values_equal(e.get(k), a.get(k)) for k in e.keys() | a.keys()
        )
    return type(expected) is type(actual) and expected == actual


# --- Tests --------------------------------------------------------------------


def check_case(test, function, case):
    expect = case["expect"]
    impl = REGISTRY[function["id"]]
    target = expect.get("satisfies")
    if target is not None and target not in REGISTRY:
        test.skipTest(f"{target} is not implemented")
    call_text = f"{function['id']}({', '.join(map(repr, case['args']))})"
    for _ in range(case.get("repeat", 1)):
        if expect.get("throws"):
            try:
                result = impl(case["args"])
            except Exception:
                continue
            test.fail(f"{call_text}: expected an error, got {result!r}")
        result = to_json(impl(case["args"]))
        if "returns" in expect:
            if not values_equal(expect["returns"], result):
                test.fail(
                    f"{call_text}: expected {expect['returns']!r}, "
                    f"got {result!r}"
                )
        elif "matches" in expect:
            if not (
                isinstance(result, str) and re.search(expect["matches"], result)
            ):
                test.fail(
                    f"{call_text}: expected a string matching "
                    f"{expect['matches']!r}, got {result!r}"
                )
        elif REGISTRY[target]([result]) is not True:
            test.fail(f"{call_text} = {result!r}: {target} is not true")


def case_test(function, case):
    def test(self):
        if case["id"] in SKIP:
            self.skipTest(SKIP[case["id"]])
        if function.get("network") and not NETWORK:
            self.skipTest("network (set API_CONTRACT_NETWORK=1)")
        check_case(self, function, case)

    return test


def not_implemented_test(self):
    self.skipTest("not implemented")


def domain_test_case(domain):
    """One TestCase per domain, one ``test_<case id>`` method per case."""
    methods = {}
    for function in domain["functions"]:
        if function["id"] not in REGISTRY:
            methods["test_" + function["id"]] = not_implemented_test
            continue
        for case in function["cases"]:
            methods["test_" + case["id"]] = case_test(function, case)
    name = domain["domain"][0].upper() + domain["domain"][1:] + "ContractTest"
    return type(name, (TestCase,), methods)


globals().update({cls.__name__: cls for cls in map(domain_test_case, DOMAINS)})


class ContractHarnessTest(TestCase):
    def test_registry_ids_exist_in_suite(self):
        known = {f["id"] for d in DOMAINS for f in d["functions"]}
        self.assertEqual(sorted(REGISTRY.keys() - known), [])

    def test_equality_self_test(self):
        for pair in load_json(CASES_DIR / "equality.json"):
            with self.subTest(pair["why"]):
                self.assertEqual(
                    values_equal(pair["expected"], pair["actual"]),
                    pair["equal"],
                )
