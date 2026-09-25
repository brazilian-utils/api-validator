"""Conformance runner for Python libs. Protocol: src/languages/shared/process-runner.ts

usage: python3 runner.py <repo_root> <package_dir>   (calls JSON on stdin)
"""
import dataclasses
import datetime
import decimal
import enum
import importlib
import inspect
import json
import os
import sys

MARK = "\0JSON\0"


def to_json(v):
    if v is None or isinstance(v, (bool, str)):
        return v
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return v
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, enum.Enum):
        return to_json(v.value)
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    if dataclasses.is_dataclass(v) and not isinstance(v, type):
        return to_json(dataclasses.asdict(v))
    if hasattr(v, "_asdict"):
        return to_json(v._asdict())
    if hasattr(v, "model_dump"):
        return to_json(v.model_dump())
    if isinstance(v, dict):
        return {str(k): to_json(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, set, frozenset)):
        return [to_json(x) for x in v]
    if hasattr(v, "__dict__"):
        return {k: to_json(x) for k, x in vars(v).items() if not k.startswith("_")}
    return repr(v)


def resolve(pkg, symbol):
    parts = symbol.split(".")
    importlib.import_module(pkg)  # surface the real error (e.g. a missing dependency)
    # Longest importable module prefix, then attribute access for the rest.
    for i in range(len(parts) - 1, -1, -1):
        mod_name = ".".join([pkg] + parts[:i])
        try:
            obj = importlib.import_module(mod_name)
        except ModuleNotFoundError as e:
            if e.name != mod_name:
                raise
            continue
        for p in parts[i:]:
            obj = getattr(obj, p)
        return obj
    raise LookupError(f"cannot resolve {symbol}")


def main():
    root, pkg_rel = sys.argv[1], sys.argv[2]
    pkg_path = os.path.join(root, pkg_rel)
    sys.path.insert(0, os.path.dirname(os.path.normpath(pkg_path)))
    pkg = os.path.basename(os.path.normpath(pkg_path))
    calls = json.load(sys.stdin)["calls"]
    results = []
    for call in calls:
        try:
            fn = resolve(pkg, call["symbol"])
        except Exception as e:  # noqa: BLE001
            results.append({"id": call["id"], "ok": False, "error": f"cannot load {call['symbol']}: {type(e).__name__}: {e}", "unsupported": True})
            continue
        # A call the signature cannot take (wrong arity) is "unsupported", like the typed
        # runners report it, not a failure of the function: bind first, call afterwards.
        try:
            sig = inspect.signature(fn)
        except (TypeError, ValueError):  # builtins without a signature: just call
            sig = None
        if sig is not None:
            try:
                sig.bind(*call["args"])
            except TypeError as e:
                results.append({"id": call["id"], "ok": False, "error": f"cannot call {call['symbol']} with {len(call['args'])} argument(s): {e}", "unsupported": True})
                continue
        try:
            results.append({"id": call["id"], "ok": True, "value": to_json(fn(*call["args"]))})
        except Exception as e:  # noqa: BLE001
            results.append({"id": call["id"], "ok": False, "error": f"{type(e).__name__}: {e}"})
    sys.stdout.write(MARK + json.dumps(results))


main()
