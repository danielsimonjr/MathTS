#!/usr/bin/env python3
"""Scan for .ts files in mathjs that are missing from mathts.

DEPRECATED (2026-07-09): the `.ts -> .ts` sync model is dead — upstream mathjs did a
TS-split (commit e62bcd749, 2026-04-10) that removed all `.ts` files, so there is nothing
for this to scan. Kept for reference only. New upstream work is a manual JS->TS port via
`tools/mathjs-port/`. Paths below are env-overridable if a local mathjs checkout exists.
"""

import os
from pathlib import Path

MATHJS = Path(os.environ.get("MATHJS_DIR", Path.home() / "Github" / "Mathjs"))
MATHTS = Path(os.environ.get("MATHTS_DIR", Path.home() / "Github" / "Mathts"))


def norm(p):
    return str(p).replace("\\", "/")


def collect_ts(root):
    out = set()
    for f in root.rglob("*.ts"):
        s = norm(f)
        if "node_modules" in s or "conflicted" in f.name:
            continue
        out.add(norm(f.relative_to(root)))
    return out


# 1. Function categories: mathjs src/function/ -> mathts functions/src/
mathjs_fn = collect_ts(MATHJS / "src" / "function")
mathts_fn = collect_ts(MATHTS / "functions" / "src")

# Exclude the typed/ dir (mathts-only active code) from comparison
mathts_fn_categories = {f for f in mathts_fn if not f.startswith("typed/")}

fn_missing = sorted(mathjs_fn - mathts_fn_categories)

# 2. Support dirs
support_dirs = ["utils", "core", "plain", "type", "expression", "error", "wasm"]
support_missing = []
for d in support_dirs:
    mathjs_d = MATHJS / "src" / d
    mathts_d = MATHTS / "functions" / "src" / d
    if not mathjs_d.exists():
        continue
    js_files = collect_ts(mathjs_d)
    ts_files = collect_ts(mathts_d) if mathts_d.exists() else set()
    for f in sorted(js_files - ts_files):
        support_missing.append(f"{d}/{f}")

# 3. Standalone files at src/ root
standalone_missing = []
for f in sorted((MATHJS / "src").glob("*.ts")):
    if "conflicted" in f.name:
        continue
    name = f.name
    target = MATHTS / "functions" / "src" / name
    if not target.exists():
        standalone_missing.append(name)

# 4. types/ directory
types_missing = []
types_dir = MATHJS / "types"
types_target = MATHTS / "functions" / "types"
if types_dir.exists():
    for f in sorted(types_dir.rglob("*")):
        if f.is_file() and "node_modules" not in str(f):
            rel = norm(f.relative_to(types_dir))
            if not (types_target / rel).exists():
                types_missing.append(rel)

# 5. Parallel files (for reference - separate package)
parallel_files = []
par_dir = MATHJS / "src" / "parallel"
if par_dir.exists():
    parallel_files = sorted(collect_ts(par_dir))

# Print results
print(f"mathjs/src/function/ .ts files: {len(mathjs_fn)}")
print(f"mathts/functions/src/ .ts files: {len(mathts_fn_categories)} (excl typed/)")
print()

print(f"=== MISSING FUNCTION FILES: {len(fn_missing)} ===")
for f in fn_missing:
    size = (MATHJS / "src" / "function" / f).stat().st_size
    print(f"  {f}  ({size:,} bytes)")

print(f"\n=== MISSING SUPPORT DIR FILES: {len(support_missing)} ===")
for f in support_missing:
    size = (MATHJS / "src" / f).stat().st_size
    print(f"  {f}  ({size:,} bytes)")

print(f"\n=== MISSING STANDALONE FILES: {len(standalone_missing)} ===")
for f in standalone_missing:
    size = (MATHJS / "src" / f).stat().st_size
    print(f"  {f}  ({size:,} bytes)")

print(f"\n=== MISSING TYPES/ FILES: {len(types_missing)} ===")
for f in types_missing:
    size = (MATHJS / "types" / f).stat().st_size
    print(f"  {f}  ({size:,} bytes)")

print(
    f"\n=== PARALLEL FILES (not synced - separate package): {len(parallel_files)} ==="
)
for f in parallel_files:
    print(f"  parallel/{f}")

# Summary
total_missing = (
    len(fn_missing)
    + len(support_missing)
    + len(standalone_missing)
    + len(types_missing)
)
print(f"\n=== SUMMARY ===")
print(f"Total missing: {total_missing}")
print(f"  Function categories: {len(fn_missing)}")
print(f"  Support directories: {len(support_missing)}")
print(f"  Standalone root files: {len(standalone_missing)}")
print(f"  Types definitions: {len(types_missing)}")
print(f"  Parallel (separate): {len(parallel_files)}")
