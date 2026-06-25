#!/usr/bin/env python3
"""Regenerate the mathts-wasm test-coverage matrix.

Parses src/index.ts for the public export surface, greps the tests/ runners
for references to each symbol, and reports per-family coverage plus the list
of untested symbols. Backs COVERAGE_AUDIT.md — re-run after adding tests to
refresh the numbers.

Run:  python -X utf8 coverage_matrix.py
Writes coverage_matrix.json next to this script.

`matrix_zeros` is treated as UNTESTED: it is referenced widely but only as an
allocation helper (makeArray), never correctness-asserted.
"""
import re, os, glob, json
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ASSEMBLY = os.path.dirname(os.path.dirname(HERE))  # tests/audit -> assembly
HELPER_ONLY = {"matrix_zeros"}

with open(os.path.join(ASSEMBLY, "src", "index.ts"), encoding="utf-8") as f:
    src = f.read()

# symbol -> source module (the `from './x'` of its export block)
sym_module = {}
for m in re.finditer(r"export\s*\{([^}]*)\}\s*from\s*'([^']+)'", src, re.DOTALL):
    body = re.sub(r"//[^\n]*", "", m.group(1))
    for tok in body.split(","):
        name = tok.strip()
        if " as " in name:
            name = name.split(" as ")[-1].strip()
        if re.fullmatch(r"[A-Za-z_]\w*", name):
            sym_module[name] = m.group(2)

# test references (exclude the differential harness itself — it drives goldens,
# not a hand-curated reference, and we count it separately if desired)
test_files = sorted(glob.glob(os.path.join(ASSEMBLY, "tests", "*.mjs"))) + \
             [os.path.join(ASSEMBLY, "tests", "run.js")]
texts = {}
for tf in test_files:
    with open(tf, encoding="utf-8", errors="replace") as f:
        texts[os.path.basename(tf)] = f.read()

# Golden-driven differential coverage: diff-*.test.mjs dispatch dynamically
# (wasm[fn] keyed off JSON), so the function names live in the golden fixtures,
# not as literal identifiers in the .mjs source. Credit those explicitly.
golden_syms = set()
for gf in glob.glob(os.path.join(ASSEMBLY, "tests", "golden", "*.json")):
    try:
        g = json.load(open(gf, encoding="utf-8"))
    except Exception:
        continue
    golden_syms.update(g.get("functions", {}).keys())

matrix = {}
for sym in sym_module:
    pat = re.compile(r"\b" + re.escape(sym) + r"\b")
    refs = [n for n, t in texts.items() if pat.search(t)]
    if sym in golden_syms:
        refs.append("golden/*.json")
    matrix[sym] = refs

fam = defaultdict(lambda: {"total": 0, "tested": [], "untested": []})
for sym, mod in sym_module.items():
    tested = bool(matrix[sym]) and sym not in HELPER_ONLY
    fam[mod]["total"] += 1
    (fam[mod]["tested"] if tested else fam[mod]["untested"]).append(sym)

order = sorted(fam, key=lambda k: (-len(fam[k]["untested"]), k))
print(f"{'MODULE':32s} {'TOTAL':>5} {'TESTED':>6} {'UNTESTED':>8}")
print("-" * 60)
tot = tt = tu = 0
for mod in order:
    d = fam[mod]; t = len(d["tested"]); u = len(d["untested"])
    tot += d["total"]; tt += t; tu += u
    print(f"{mod:32s} {d['total']:5d} {t:6d} {u:8d}")
print("-" * 60)
print(f"{'TOTAL':32s} {tot:5d} {tt:6d} {tu:8d}")

with open(os.path.join(HERE, "coverage_matrix.json"), "w", encoding="utf-8") as f:
    json.dump({
        "total": tot, "tested": tt, "untested": tu,
        "by_module": {k: {"total": fam[k]["total"],
                          "tested": sorted(fam[k]["tested"]),
                          "untested": sorted(fam[k]["untested"])} for k in order},
        "symbol_refs": matrix,
    }, f, indent=2)
print("\nwrote coverage_matrix.json")
