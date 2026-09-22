"""Extract the public API of a Python package using the stdlib `ast` (no import, no deps).

usage: python3 extract.py <repo_root> <package_dir>
Prints "\\0JSON\\0" followed by {"symbols": [...], "warnings": [...]}.

Public API = top-level functions of public modules (no leading underscore in any path part,
tests excluded) + names re-exported via `from x import y [as z]`, filtered by `__all__`
when a module defines it.
"""
import ast
import json
import os
import sys

MARK = "\0JSON\0"


def module_name(pkg_dir, path):
    rel = os.path.relpath(path, pkg_dir)[:-3].replace(os.sep, ".")
    if rel == "__init__":
        return ""
    if rel.endswith(".__init__"):
        return rel[: -len(".__init__")]
    return rel


def is_public_module(mod):
    return all(not p.startswith("_") for p in mod.split(".") if p) and not any(
        p in ("tests", "test") or p.startswith("test_") for p in mod.split(".")
    )


def unparse(node):
    return ast.unparse(node) if node is not None else None


def is_deprecated(fn):
    for d in fn.decorator_list:
        name = unparse(d.func if isinstance(d, ast.Call) else d) or ""
        if name.split(".")[-1] == "deprecated":
            return True
    doc = ast.get_docstring(fn) or ""
    if ".. deprecated" in doc or "Deprecated:" in doc:
        return True
    for node in ast.walk(fn):
        if isinstance(node, ast.Call) and (unparse(node.func) or "").endswith("warn"):
            if any("DeprecationWarning" in (unparse(a) or "") for a in node.args + [k.value for k in node.keywords]):
                return True
    return False


def params_of(fn):
    a = fn.args
    out = []
    positional = a.posonlyargs + a.args
    first_default = len(positional) - len(a.defaults)
    for i, p in enumerate(positional):
        if i == 0 and p.arg in ("self", "cls"):
            continue
        out.append({"name": p.arg, "type": unparse(p.annotation), "optional": i >= first_default})
    if a.vararg:
        out.append({"name": a.vararg.arg, "type": unparse(a.vararg.annotation), "optional": True, "rest": True})
    for p, default in zip(a.kwonlyargs, a.kw_defaults):
        out.append({"name": p.arg, "type": unparse(p.annotation), "optional": default is not None, "keyword": True})
    if a.kwarg:
        out.append({"name": a.kwarg.arg, "type": unparse(a.kwarg.annotation), "optional": True, "rest": True, "keyword": True})
    for p in out:
        if p["type"] is None:
            del p["type"]
        if not p.get("optional"):
            p.pop("optional", None)
    return out


def dunder_all(tree):
    for node in tree.body:
        targets = []
        if isinstance(node, ast.Assign):
            targets = node.targets
        elif isinstance(node, ast.AnnAssign):
            targets = [node.target]
        for t in targets:
            if isinstance(t, ast.Name) and t.id == "__all__":
                try:
                    return set(ast.literal_eval(node.value))
                except Exception:
                    return None
    return None


def resolve_from(mod, is_pkg, level, target):
    """Absolute (package-relative) module name of `from <level dots><target> import ...`."""
    if level == 0:
        return target
    parts = mod.split(".") if mod else []
    if not is_pkg:
        parts = parts[:-1]
    if level > 1:
        parts = parts[: len(parts) - (level - 1)]
    base = ".".join(parts)
    if target:
        return f"{base}.{target}" if base else target
    return base


def main():
    root, pkg_rel = sys.argv[1], sys.argv[2]
    pkg_dir = os.path.join(root, pkg_rel)
    pkg_name = os.path.basename(os.path.normpath(pkg_dir))
    warnings = []
    defs = {}  # qualified name -> symbol
    reexports = []  # (qualified alias name, target qualified name, file, line)
    star_imports = []  # (importing module prefix, source module, file, line, importer __all__)
    module_all = {}  # module -> __all__ (or None)

    for dirpath, dirnames, filenames in os.walk(pkg_dir):
        dirnames[:] = sorted(d for d in dirnames if not d.startswith((".", "__pycache__")))
        for f in sorted(filenames):
            if not f.endswith(".py"):
                continue
            path = os.path.join(dirpath, f)
            mod = module_name(pkg_dir, path)
            if not is_public_module(mod):
                continue
            try:
                with open(path, encoding="utf-8") as fh:
                    tree = ast.parse(fh.read(), filename=path)
            except SyntaxError as e:
                warnings.append(f"{path}: syntax error: {e}")
                continue
            exported = dunder_all(tree)
            module_all[mod] = exported
            prefix = f"{mod}." if mod else ""
            rel_file = os.path.relpath(path, root)
            for node in tree.body:
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if node.name.startswith("_") or (exported is not None and node.name not in exported):
                        continue
                    sym = {
                        "name": prefix + node.name,
                        "params": params_of(node),
                        "location": {"file": rel_file, "line": node.lineno},
                    }
                    if node.returns is not None:
                        sym["returns"] = unparse(node.returns)
                    if is_deprecated(node):
                        sym["deprecated"] = True
                    defs[sym["name"]] = sym
                elif isinstance(node, ast.ImportFrom):
                    src = resolve_from(mod, f == "__init__.py", node.level, node.module or "")
                    if src == pkg_name or src.startswith(pkg_name + "."):
                        src = src[len(pkg_name) + 1 :] if src != pkg_name else ""
                    elif node.level == 0:
                        continue  # third-party import
                    for alias in node.names:
                        if alias.name == "*":
                            if exported is not None or mod == "":
                                star_imports.append((prefix, src, rel_file, node.lineno, exported))
                            continue
                        public_name = alias.asname or alias.name
                        if public_name.startswith("_") or (exported is not None and public_name not in exported):
                            continue
                        if exported is None and mod != "":
                            # Submodules without __all__: imports are implementation details.
                            continue
                        target = f"{src}.{alias.name}" if src else alias.name
                        reexports.append((prefix + public_name, target, rel_file, node.lineno))

    # `from x import *`: every public function of x (its __all__ if it has one).
    for prefix, src, rel_file, line, importer_all in star_imports:
        src_all = module_all.get(src)
        for qname in list(defs):
            mod_part, _, fname = qname.rpartition(".")
            if mod_part != src or fname.startswith("_") or (src_all is not None and fname not in src_all):
                continue
            if importer_all is not None and fname not in importer_all:
                continue
            reexports.append((prefix + fname, qname, rel_file, line))

    symbols = list(defs.values())
    for name, target, rel_file, line in reexports:
        seen = set()
        while target not in defs and target in dict((a, t) for a, t, _, _ in reexports) and target not in seen:
            seen.add(target)
            target = dict((a, t) for a, t, _, _ in reexports)[target]
        if target not in defs or name in defs:
            continue
        src = defs[target]
        sym = {**src, "name": name, "aliasOf": target, "location": {"file": rel_file, "line": line}}
        symbols.append(sym)

    # Cross-check with the runtime when the package imports: names it exports that the
    # static view cannot see (defined dynamically) are reported instead of silently missed.
    try:
        sys.path.insert(0, os.path.dirname(os.path.normpath(pkg_dir)))
        import importlib

        runtime = importlib.import_module(pkg_name)
        static = {s["name"] for s in symbols}
        for name in getattr(runtime, "__all__", []):
            if callable(getattr(runtime, name, None)) and name not in static:
                warnings.append(f"{pkg_name}.{name} is exported at runtime but not visible to static analysis (dynamic definition?)")
    except Exception:  # noqa: BLE001 - dependencies not installed: static view only
        pass

    sys.stdout.write(MARK + json.dumps({"symbols": symbols, "warnings": warnings}))


main()
