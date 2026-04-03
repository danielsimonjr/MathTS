#!/usr/bin/env python3
"""
Build codebase-inventory.json for MathTS.
Mirrors the format of mathjs/tools/codebase-inventory.json.
Usage: python -X utf8 tools/build-mathts-inventory.py
"""

import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent

EXCLUDE_DIRS = {
    "node_modules",
    "dist",
    ".git",
    "build",
    ".turbo",
    ".ruff_cache",
    "coverage",
    ".changeset",
    ".claude",
    ".husky",
    ".github",
}

PACKAGES = [
    "core",
    "matrix",
    "functions",
    "parallel",
    "expression",
    "workbook",
    "compat",
    "assembly",
    "packages/typed-function",
    "packages/workerpool",
]


def should_include(path):
    parts = path.parts
    return not any(p in EXCLUDE_DIRS for p in parts)


def classify_file(rel_path):
    """Classify a file into a category."""
    s = str(rel_path).replace("\\", "/")

    if "/tests/" in s or "/test/" in s or s.startswith("tests/"):
        return "test"
    if s.endswith(".d.ts"):
        return "declaration"
    if s.endswith(".ts") and "/src/" in s:
        return "source"
    if s.endswith(".ts") and "assembly/" in s:
        return "wasm_as"
    if s.endswith(".ts"):
        return "source"
    if s.endswith(".js"):
        return "javascript"
    if s.endswith(".json"):
        return "config"
    if s.endswith(".md"):
        return "docs"
    return "other"


def count_lines(path):
    try:
        return len(path.read_text(encoding="utf-8", errors="replace").split("\n"))
    except Exception:
        return 0


def extract_exports(content):
    exports = []
    for m in re.finditer(
        r"export\s+(?:const|function|class|type|interface|enum)\s+(\w+)", content
    ):
        exports.append(m.group(1))
    for m in re.finditer(r"export\s+\{([^}]+)\}", content):
        for name in m.group(1).split(","):
            name = name.strip().split(" as ")[-1].strip()
            if name:
                exports.append(name)
    return exports


def extract_factory_info(content):
    """Extract factory from mathjs factory(name, deps, impl) pattern."""
    factories = []
    name_match = re.search(r"const\s+name\s*=\s*['\"](\w+)['\"]", content)
    deps_match = re.search(
        r"const\s+dependencies\s*(?::\s*\w+(?:\[\])?)?\s*=\s*\[([^\]]*)\]", content
    )
    creator_match = re.search(
        r"export\s+const\s+(create\w+)\s*=\s*(?:/\*.*?\*/\s*)?factory\s*\(", content
    )
    if name_match and creator_match:
        fn_name = name_match.group(1)
        creator = creator_match.group(1)
        deps = []
        if deps_match:
            deps = [
                d.strip().strip("'\"")
                for d in deps_match.group(1).split(",")
                if d.strip()
            ]
        factories.append({"creator": creator, "name": fn_name, "dependencies": deps})
    return factories


def extract_class_methods(content, class_name):
    methods = []
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
        r"(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*(\w+)\s*\(([^)]*)\)\s*(?::\s*([^\n{]+))?",
        class_body,
    ):
        name = m.group(1)
        if name in (
            "constructor",
            "if",
            "for",
            "while",
            "switch",
            "return",
            "new",
            "throw",
        ):
            continue
        methods.append(name)
    return list(set(methods))


def build_metadata():
    pkg_path = ROOT / "package.json"
    pkg = json.loads(pkg_path.read_text()) if pkg_path.exists() else {}
    return {
        "generated": datetime.now().isoformat(),
        "project": pkg.get("name", "mathts"),
        "version": pkg.get("version", "0.0.0"),
        "description": pkg.get("description", ""),
        "generator": "tools/build-mathts-inventory.py",
    }


def build_summary():
    """Count all files by type."""
    counts = defaultdict(int)
    extensions = defaultdict(int)
    total_lines = 0

    for f in ROOT.rglob("*"):
        if not f.is_file() or not should_include(f.relative_to(ROOT)):
            continue
        rel = f.relative_to(ROOT)
        cat = classify_file(rel)
        counts[cat] += 1
        extensions[f.suffix] += 1
        if f.suffix in (".ts", ".js"):
            total_lines += count_lines(f)

    return {
        "total_files": sum(counts.values()),
        "source": counts.get("source", 0),
        "source_ts": counts.get("source", 0),
        "wasm_as": counts.get("wasm_as", 0),
        "tests": counts.get("test", 0),
        "docs": counts.get("docs", 0),
        "declarations": counts.get("declaration", 0),
        "config": counts.get("config", 0),
        "other": counts.get("other", 0) + counts.get("javascript", 0),
        "total_lines": total_lines,
        "extensions": dict(sorted(extensions.items(), key=lambda x: -x[1])),
    }


def build_packages():
    """Inventory each workspace package."""
    result = {}
    for pkg_path in PACKAGES:
        pkg_dir = ROOT / pkg_path
        if not pkg_dir.exists():
            continue

        src_dir = pkg_dir / "src"
        test_dir = None
        for td in ["tests", "test"]:
            if (pkg_dir / td).exists():
                test_dir = pkg_dir / td
                break

        # Source files
        src_files = []
        src_lines = 0
        src_exports = []
        if src_dir.exists():
            for f in sorted(src_dir.rglob("*.ts")):
                if "node_modules" in str(f):
                    continue
                content = f.read_text(encoding="utf-8", errors="replace")
                lines = count_lines(f)
                src_lines += lines
                exports = extract_exports(content)
                src_exports.extend(exports)
                src_files.append(str(f.relative_to(src_dir)).replace("\\", "/"))

        # Test files
        test_files = 0
        test_lines = 0
        if test_dir:
            for f in test_dir.rglob("*.test.ts"):
                test_files += 1
                test_lines += count_lines(f)

        # Package.json info
        pj_path = pkg_dir / "package.json"
        pkg_info = {}
        if pj_path.exists():
            pj = json.loads(pj_path.read_text())
            pkg_info = {
                "name": pj.get("name"),
                "version": pj.get("version"),
                "dependencies": list(pj.get("dependencies", {}).keys()),
                "scripts": list(pj.get("scripts", {}).keys()),
            }

        result[pkg_path] = {
            "package": pkg_info,
            "source_files": len(src_files),
            "source_lines": src_lines,
            "test_files": test_files,
            "test_lines": test_lines,
            "total_exports": len(src_exports),
        }

    return result


def build_core_types():
    """Inventory Complex, Fraction, BigNumber."""
    result = {}
    for type_name, filename in [
        ("Complex", "complex.ts"),
        ("Fraction", "fraction.ts"),
        ("BigNumber", "bignumber.ts"),
    ]:
        path = ROOT / "core" / "src" / "types" / filename
        if not path.exists():
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        methods = extract_class_methods(content, type_name)
        statics = re.findall(rf"static\s+(\w+)\s*\(", content)
        result[type_name] = {
            "file": str(path.relative_to(ROOT)).replace("\\", "/"),
            "lines": count_lines(path),
            "instance_methods": sorted(methods),
            "static_methods": sorted(set(statics)),
            "method_count": len(methods),
        }
    return result


def build_typed_functions():
    """Inventory active typed functions."""
    result = {}
    typed_dir = ROOT / "functions" / "src" / "typed"
    if not typed_dir.exists():
        return result

    for f in sorted(typed_dir.glob("*.ts")):
        if f.name == "index.ts":
            continue
        content = f.read_text(encoding="utf-8", errors="replace")
        exports = extract_exports(content)
        result[f.stem] = {
            "file": str(f.relative_to(ROOT)).replace("\\", "/"),
            "lines": count_lines(f),
            "exports": exports,
            "export_count": len(exports),
        }
    return result


def build_synced_factories():
    """Inventory synced mathjs factory functions."""
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

    all_factories = []
    for cat in categories:
        cat_dir = funcs_dir / cat
        if not cat_dir.exists():
            continue
        files = list(cat_dir.rglob("*.ts"))
        factories = []
        total_lines = 0
        for f in files:
            content = f.read_text(encoding="utf-8", errors="replace")
            total_lines += count_lines(f)
            facs = extract_factory_info(content)
            factories.extend(facs)

        all_factories.extend(factories)
        result[cat] = {
            "file_count": len(files),
            "total_lines": total_lines,
            "factory_count": len(factories),
            "factories": [
                {
                    "name": fa["name"],
                    "creator": fa["creator"],
                    "deps": fa["dependencies"],
                }
                for fa in factories
            ],
        }

    return result


def build_matrix_backends():
    """Inventory matrix backends."""
    result = {}
    backends_dir = ROOT / "matrix" / "src" / "backends"
    if not backends_dir.exists():
        return result

    for f in sorted(backends_dir.glob("*.ts")):
        content = f.read_text(encoding="utf-8", errors="replace")
        methods = extract_class_methods(content, f.stem)
        result[f.stem] = {
            "lines": count_lines(f),
            "methods": sorted(methods),
            "method_count": len(methods),
        }
    return result


def build_wasm():
    """Inventory AssemblyScript WASM ops."""
    result = {}
    asm_dir = ROOT / "assembly" / "src"
    if not asm_dir.exists():
        return result

    for f in sorted(asm_dir.rglob("*.ts")):
        content = f.read_text(encoding="utf-8", errors="replace")
        exports = extract_exports(content)
        rel = str(f.relative_to(asm_dir)).replace("\\", "/")
        result[rel] = {
            "lines": count_lines(f),
            "exports": exports,
            "export_count": len(exports),
        }
    return result


def build_dependency_graph(synced_factories):
    """Build factory dependency graph."""
    factory_map = {}
    for cat, info in synced_factories.items():
        for f in info.get("factories", []):
            factory_map[f["name"]] = {
                "creator": f["creator"],
                "category": cat,
                "deps": f.get("deps", []),
            }

    leaf_factories = []
    factory_deps = {}
    external_deps = set()

    for name, info in factory_map.items():
        fdeps = [d for d in info["deps"] if d in factory_map]
        non_factory = [d for d in info["deps"] if d not in factory_map]
        factory_deps[name] = fdeps
        external_deps.update(non_factory)
        if not fdeps:
            leaf_factories.append(name)

    return {
        "total_factories": len(factory_map),
        "leaf_count": len(leaf_factories),
        "leaf_factories": sorted(leaf_factories),
        "external_deps": sorted(external_deps),
    }


def build_cross_package_deps():
    """Analyze @mathts/* imports across packages."""
    result = {}
    for pkg in PACKAGES:
        src_dir = ROOT / pkg / "src"
        if not src_dir.exists():
            continue
        imports = defaultdict(int)
        for f in src_dir.rglob("*.ts"):
            if "node_modules" in str(f):
                continue
            content = f.read_text(encoding="utf-8", errors="replace")
            for m in re.finditer(r"from\s+['\"](@mathts/\w+)['\"]", content):
                imports[m.group(1)] += 1
        if imports:
            result[pkg] = dict(imports)
    return result


def main():
    print("Building MathTS codebase inventory...", file=sys.stderr)

    inventory = {
        "metadata": build_metadata(),
        "summary": build_summary(),
        "packages": build_packages(),
        "core_types": build_core_types(),
        "typed_functions": build_typed_functions(),
        "synced_factories": build_synced_factories(),
        "matrix_backends": build_matrix_backends(),
        "wasm_operations": build_wasm(),
        "cross_package_deps": build_cross_package_deps(),
    }

    # Add dependency graph (depends on synced_factories)
    inventory["dependency_graph"] = build_dependency_graph(
        inventory["synced_factories"]
    )

    out_path = ROOT / "tools" / "codebase-inventory.json"
    out_path.write_text(json.dumps(inventory, indent=2, default=str), encoding="utf-8")
    size = out_path.stat().st_size
    print(f"Written {size:,} bytes to {out_path}", file=sys.stderr)
    print(json.dumps(inventory["summary"], indent=2))


if __name__ == "__main__":
    main()
