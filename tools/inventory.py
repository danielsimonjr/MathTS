#!/usr/bin/env python3
"""
RLM-based codebase inventory for MathTS.
Loads all source into memory, extracts structured data programmatically.
Usage: python -X utf8 tools/inventory.py <section>
Sections: core-types, typed-functions, synced-factories, matrix-backends,
          wasm-ops, expression, compat, parallel, cross-deps
"""

import re
import sys
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
MATHJS = Path.home() / "Dropbox" / "Github" / "Mathjs"


def extract_exports(content):
    """Extract exported names from a TS file."""
    exports = []
    for m in re.finditer(
        r"export\s+(?:const|function|class|type|interface|enum)\s+(\w+)", content
    ):
        exports.append(m.group(1))
    for m in re.finditer(r"export\s+\{\s*([^}]+)\}", content):
        for name in m.group(1).split(","):
            name = name.strip().split(" as ")[-1].strip()
            if name:
                exports.append(name)
    return exports


def extract_class_methods(content, class_name):
    """Extract public methods from a class."""
    methods = []
    # Find class body
    match = re.search(rf"class\s+{class_name}\s*[^{{]*\{{", content)
    if not match:
        return methods
    start = match.end()
    depth = 1
    i = start
    while i < len(content) and depth > 0:
        if content[i] == "{":
            depth += 1
        elif content[i] == "}":
            depth -= 1
        i += 1
    class_body = content[start:i]

    for m in re.finditer(
        r"(?:public\s+)?(\w+)\s*\(([^)]*)\)\s*:\s*([^\n{]+)", class_body
    ):
        name = m.group(1)
        if name in ("constructor", "if", "for", "while", "switch"):
            continue
        methods.append(
            {"name": name, "params": m.group(2).strip(), "returns": m.group(3).strip()}
        )
    return methods


def inventory_core_types():
    """Inventory Complex, Fraction, BigNumber types and their methods."""
    result = {}
    types_dir = ROOT / "core" / "src" / "types"

    for type_file in ["complex.ts", "fraction.ts", "bignumber.ts"]:
        path = types_dir / type_file
        if not path.exists():
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        class_name = type_file.replace(".ts", "").title()
        if class_name == "Bignumber":
            class_name = "BigNumber"

        methods = extract_class_methods(content, class_name)
        lines = len(content.split("\n"))

        # Also check for static methods
        statics = []
        for m in re.finditer(rf"static\s+(\w+)\s*\(", content):
            statics.append(m.group(1))

        result[class_name] = {
            "file": str(path.relative_to(ROOT)),
            "lines": lines,
            "instance_methods": [m["name"] for m in methods],
            "static_methods": statics,
            "method_count": len(methods),
        }

    return result


def inventory_typed_functions():
    """Inventory active typed functions in functions/src/typed/."""
    result = {}
    typed_dir = ROOT / "functions" / "src" / "typed"
    if not typed_dir.exists():
        return result

    for f in sorted(typed_dir.glob("*.ts")):
        if f.name == "index.ts":
            continue
        content = f.read_text(encoding="utf-8", errors="replace")
        lines = len(content.split("\n"))
        exports = extract_exports(content)

        # Extract typed function signatures
        typed_fns = []
        for m in re.finditer(r'mathTyped\s*\(\s*[\'"](\w+)[\'"]', content):
            typed_fns.append(m.group(1))

        # Also catch createXxx patterns
        for m in re.finditer(r"export\s+const\s+(\w+)\s*=", content):
            name = m.group(1)
            if name not in typed_fns:
                typed_fns.append(name)

        result[f.stem] = {
            "file": str(f.relative_to(ROOT)),
            "lines": lines,
            "exports": exports,
            "typed_functions": typed_fns,
            "export_count": len(exports),
        }

    return result


def inventory_synced_factories():
    """Inventory synced mathjs factory functions by category."""
    result = {}
    funcs_dir = ROOT / "functions" / "src"
    categories = [
        "algebra",
        "arithmetic",
        "bitwise",
        "combinatorics",
        "complex",
        "geometry",
        "logical",
        "matrix",
        "numeric",
        "probability",
        "relational",
        "set",
        "signal",
        "special",
        "statistics",
        "string",
        "trigonometry",
        "unit",
        "utils",
    ]

    for cat in categories:
        cat_dir = funcs_dir / cat
        if not cat_dir.exists():
            continue

        files = []
        total_lines = 0
        factories = []
        for f in sorted(cat_dir.rglob("*.ts")):
            content = f.read_text(encoding="utf-8", errors="replace")
            lines = len(content.split("\n"))
            total_lines += lines
            rel = str(f.relative_to(cat_dir))

            # Extract factory names
            for m in re.finditer(r"export\s+const\s+(create\w+)\s*=", content):
                factories.append(m.group(1))

            files.append({"file": rel, "lines": lines})

        result[cat] = {
            "file_count": len(files),
            "total_lines": total_lines,
            "factories": factories,
            "factory_count": len(factories),
        }

    return result


def inventory_matrix_backends():
    """Inventory matrix backends and their operation coverage."""
    result = {}
    backends_dir = ROOT / "matrix" / "src" / "backends"
    ops_dir = ROOT / "matrix" / "src" / "operations"

    # Backends
    if backends_dir.exists():
        for f in sorted(backends_dir.glob("*.ts")):
            content = f.read_text(encoding="utf-8", errors="replace")
            lines = len(content.split("\n"))
            methods = []
            for m in re.finditer(r"(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]", content):
                name = m.group(1)
                if name not in (
                    "constructor",
                    "if",
                    "for",
                    "while",
                    "switch",
                    "return",
                    "new",
                    "throw",
                ):
                    methods.append(name)
            result[f.stem] = {
                "file": str(f.relative_to(ROOT)),
                "lines": lines,
                "methods": list(set(methods)),
            }

    # Operations
    if ops_dir.exists():
        ops = {}
        for f in sorted(ops_dir.rglob("*.ts")):
            content = f.read_text(encoding="utf-8", errors="replace")
            lines = len(content.split("\n"))
            exports = extract_exports(content)
            ops[f.stem] = {
                "file": str(f.relative_to(ROOT)),
                "lines": lines,
                "exports": exports,
            }
        result["_operations"] = ops

    # Decompositions
    decomp_dir = ROOT / "matrix" / "src" / "decomposition"
    if decomp_dir.exists():
        decomps = {}
        for f in sorted(decomp_dir.glob("*.ts")):
            content = f.read_text(encoding="utf-8", errors="replace")
            lines = len(content.split("\n"))
            exports = extract_exports(content)
            decomps[f.stem] = {
                "file": str(f.relative_to(ROOT)),
                "lines": lines,
                "exports": exports,
            }
        result["_decompositions"] = decomps

    return result


def inventory_wasm_ops():
    """Inventory AssemblyScript WASM operations."""
    result = {}
    asm_dir = ROOT / "assembly" / "src"
    if not asm_dir.exists():
        return result

    for f in sorted(asm_dir.rglob("*.ts")):
        content = f.read_text(encoding="utf-8", errors="replace")
        lines = len(content.split("\n"))
        exports = extract_exports(content)
        rel = str(f.relative_to(asm_dir))
        result[rel] = {
            "lines": lines,
            "exports": exports,
            "export_count": len(exports),
        }

    return result


def inventory_expression():
    """Inventory expression package."""
    result = {"nodes": [], "parser": {}, "transforms": []}
    expr_dir = ROOT / "expression" / "src"
    if not expr_dir.exists():
        return result

    # Nodes
    node_dir = expr_dir / "node"
    if node_dir.exists():
        for f in sorted(node_dir.glob("*.ts")):
            content = f.read_text(encoding="utf-8", errors="replace")
            exports = extract_exports(content)
            result["nodes"].append(
                {
                    "file": f.name,
                    "lines": len(content.split("\n")),
                    "exports": exports,
                }
            )

    # Parser
    for name in ["parse.ts", "Parser.ts"]:
        p = expr_dir / name
        if p.exists():
            content = p.read_text(encoding="utf-8", errors="replace")
            result["parser"][name] = {
                "lines": len(content.split("\n")),
                "exports": extract_exports(content),
            }

    # Transforms
    transform_dir = expr_dir / "transform"
    if transform_dir.exists():
        for f in sorted(transform_dir.glob("*.transform.ts")):
            result["transforms"].append(f.stem.replace(".transform", ""))

    return result


def inventory_compat():
    """Inventory compat package - what's wired vs stub."""
    result = {}
    compat_dir = ROOT / "compat" / "src"
    if not compat_dir.exists():
        return result

    for f in sorted(compat_dir.glob("*.ts")):
        content = f.read_text(encoding="utf-8", errors="replace")
        lines = len(content.split("\n"))
        exports = extract_exports(content)
        # Check for TODO/stub markers
        stubs = len(
            re.findall(
                r"TODO|STUB|throw new Error|not implemented", content, re.IGNORECASE
            )
        )
        result[f.stem] = {
            "file": str(f.relative_to(ROOT)),
            "lines": lines,
            "exports": exports,
            "stub_markers": stubs,
        }

    return result


def inventory_parallel():
    """Inventory parallel package."""
    result = {}
    par_dir = ROOT / "parallel" / "src"
    if not par_dir.exists():
        return result

    for f in sorted(par_dir.rglob("*.ts")):
        content = f.read_text(encoding="utf-8", errors="replace")
        lines = len(content.split("\n"))
        exports = extract_exports(content)
        rel = str(f.relative_to(par_dir))
        result[rel] = {
            "lines": lines,
            "exports": exports,
        }

    return result


def inventory_cross_deps():
    """Analyze cross-package import dependencies."""
    result = {}
    packages = {
        "core": ROOT / "core" / "src",
        "matrix": ROOT / "matrix" / "src",
        "functions_typed": ROOT / "functions" / "src" / "typed",
        "parallel": ROOT / "parallel" / "src",
        "compat": ROOT / "compat" / "src",
        "workbook": ROOT / "workbook" / "src",
        "expression": ROOT / "expression" / "src",
    }

    for pkg_name, pkg_dir in packages.items():
        if not pkg_dir.exists():
            continue
        imports = {}
        for f in pkg_dir.rglob("*.ts"):
            content = f.read_text(encoding="utf-8", errors="replace")
            for m in re.finditer(r"from\s+['\"](@mathts/\w+)['\"]", content):
                dep = m.group(1)
                imports[dep] = imports.get(dep, 0) + 1
        if imports:
            result[pkg_name] = imports

    return result


SECTIONS = {
    "core-types": inventory_core_types,
    "typed-functions": inventory_typed_functions,
    "synced-factories": inventory_synced_factories,
    "matrix-backends": inventory_matrix_backends,
    "wasm-ops": inventory_wasm_ops,
    "expression": inventory_expression,
    "compat": inventory_compat,
    "parallel": inventory_parallel,
    "cross-deps": inventory_cross_deps,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in SECTIONS:
        print(f"Usage: python inventory.py <section>")
        print(f"Sections: {', '.join(SECTIONS.keys())}")
        sys.exit(1)

    section = sys.argv[1]
    data = SECTIONS[section]()
    print(json.dumps(data, indent=2, default=str))
