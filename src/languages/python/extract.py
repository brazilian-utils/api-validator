"""Public API of a Python package, read with griffe (https://github.com/mkdocstrings/griffe),
the API extractor behind mkdocstrings: it resolves re-exports and aliases, `__all__`,
wildcard imports and Python's public/private conventions, statically, with a dynamic
fallback. Deprecations come from the griffe-warnings-deprecated extension
(`@warnings.deprecated` / `@typing_extensions.deprecated`).

usage: python3 extract.py <repo_root> <package_dir>
Prints "\\0JSON\\0" followed by {"symbols": [...], "warnings": [...]}.
"""
import json
import os
import sys

import griffe

MARK = "\0JSON\0"
KINDS = griffe.ParameterKind


def params_of(fn):
    out = []
    for p in fn.parameters:
        if p.name in ("self", "cls"):
            continue
        param = {"name": p.name}
        if p.annotation is not None:
            param["type"] = str(p.annotation)
        if p.default is not None or p.kind in (KINDS.var_positional, KINDS.var_keyword):
            param["optional"] = True
        if p.kind in (KINDS.var_positional, KINDS.var_keyword):
            param["rest"] = True
        if p.kind in (KINDS.keyword_only, KINDS.var_keyword):
            param["keyword"] = True
        out.append(param)
    return out


def main():
    root, pkg_rel = sys.argv[1], sys.argv[2]
    pkg_dir = os.path.normpath(os.path.join(root, pkg_rel))
    pkg_name = os.path.basename(pkg_dir)
    warnings = []
    try:
        extensions = griffe.load_extensions("griffe_warnings_deprecated")
    except Exception as e:  # noqa: BLE001
        extensions = None
        warnings.append(f"griffe-warnings-deprecated unavailable, deprecations not detected: {e}")
    package = griffe.load(
        pkg_name,
        search_paths=[os.path.dirname(pkg_dir)],
        extensions=extensions,
        resolve_aliases=True,
        resolve_external=False,
    )

    symbols = []
    seen_modules = set()

    def rel(path):
        return os.path.relpath(str(path), root) if path else None

    def walk(module, prefix):
        if module.path in seen_modules:
            return
        seen_modules.add(module.path)
        for name, member in module.members.items():
            try:
                public = member.is_public
            except Exception:  # noqa: BLE001 - unresolvable alias
                continue
            if not public or name.startswith("_"):
                continue
            try:
                kind = member.kind
            except griffe.AliasResolutionError:
                continue  # re-export of something outside the package
            if kind is griffe.Kind.MODULE and not member.is_alias:
                if any(part in ("tests", "test") or part.startswith("test_") for part in member.path.split(".")):
                    continue
                walk(member, f"{prefix}{name}.")
            elif kind is griffe.Kind.FUNCTION:
                target = member.final_target if member.is_alias else member
                sym = {"name": prefix + name, "params": params_of(target)}
                if target.returns is not None:
                    sym["returns"] = str(target.returns)
                if getattr(target, "deprecated", None):
                    sym["deprecated"] = True
                if member.is_alias:
                    target_path = target.path
                    if target_path.startswith(pkg_name + "."):
                        sym["aliasOf"] = target_path[len(pkg_name) + 1 :]
                sym["location"] = {"file": rel(target.filepath), "line": target.lineno or 0}
                symbols.append(sym)

    walk(package, "")
    sys.stdout.write(MARK + json.dumps({"symbols": symbols, "warnings": warnings}))


main()
