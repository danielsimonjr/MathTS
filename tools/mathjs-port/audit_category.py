"""
audit_category.py — for a given category (special, signal, statistics, etc.),
load mathjs's new function files for that category and MathTS's typed/<cat>.ts,
and ask the LLM for per-function parity verdicts.

Usage:
    python -X utf8 audit_category.py <category>

Output: tools/mathjs-port/audits/<category>.json
"""
from __future__ import annotations

import json
import sys
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MATHJS = Path.home() / "Dropbox" / "Github" / "Mathjs"
SKILL_SCRIPTS = Path.home() / ".claude" / "skills" / "rlm" / "scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))
from rlm_query import llm_query  # noqa: E402

# Map mathjs category dir -> MathTS typed/<file>.ts (one or many)
CATEGORY_MAP = {
    "special": ["functions/src/typed/special.ts"],
    "signal": ["functions/src/typed/signal.ts"],
    "statistics": ["functions/src/typed/statistics.ts", "functions/src/typed/hypothesis.ts", "functions/src/typed/distributions.ts", "functions/src/typed/dist-objects.ts"],
    "numeric": ["functions/src/typed/numeric.ts", "functions/src/typed/integration.ts", "functions/src/typed/interpolation.ts"],
    "combinatorics": ["functions/src/typed/combinatorics.ts"],
    "geometry": ["functions/src/typed/geometry.ts"],
    "matrix": ["functions/src/typed/matrix-ops.ts"],
    "graph": ["functions/src/typed/graph.ts"],
    "algebra": ["functions/src/typed/algebra.ts", "functions/src/typed/cas.ts"],
}


def load_mathjs_new_funcs(category: str) -> dict[str, str]:
    """Load all new mathjs JS files for this category. Returns {name: source}."""
    funcs_list = (REPO / "tools/mathjs-port/_new_funcs_cache.txt")
    if not funcs_list.exists():
        # Build it
        import subprocess
        commits = ["558c27590", "1265d332d", "979528225", "beebfd2d7"]
        all_files = set()
        for c in commits:
            r = subprocess.run(
                ["git", "-C", str(MATHJS), "diff", "--name-only", "--diff-filter=A", f"{c}^", c, "--", "src/function/"],
                capture_output=True, text=True
            )
            for line in r.stdout.splitlines():
                if line.startswith("src/function/") and line.endswith(".js") and "test" not in line:
                    all_files.add(line)
        funcs_list.write_text("\n".join(sorted(all_files)), encoding="utf-8")

    files = funcs_list.read_text(encoding="utf-8").splitlines()
    cat_files = [f for f in files if f.startswith(f"src/function/{category}/")]
    out: dict[str, str] = {}
    for f in cat_files:
        name = Path(f).stem
        full = MATHJS / f
        if full.exists():
            out[name] = full.read_text(encoding="utf-8", errors="replace")
    return out


def load_mathts_active(category: str) -> dict[str, str]:
    """Load MathTS active-layer typed/<cat>.ts file(s)."""
    out: dict[str, str] = {}
    for path in CATEGORY_MAP.get(category, []):
        full = REPO / path
        if full.exists():
            out[path] = full.read_text(encoding="utf-8", errors="replace")
    return out


def build_prompt(category: str, mathjs_funcs: dict, mathts_files: dict) -> str:
    # Truncate each mathjs file aggressively (we only need signature + algorithm summary)
    mj_section = ""
    for name, src in mathjs_funcs.items():
        trimmed = src[:3500] + ("\n...[truncated]" if len(src) > 3500 else "")
        mj_section += f"\n--- mathjs:{name} ---\n{trimmed}\n"

    mt_section = ""
    for path, src in mathts_files.items():
        trimmed = src[:18000] + ("\n...[truncated]" if len(src) > 18000 else "")
        mt_section += f"\n--- mathts:{path} ---\n{trimmed}\n"

    names = list(mathjs_funcs.keys())
    return (
        f"You are auditing MathTS's implementations against mathjs's for category: {category}.\n\n"
        f"For each of these mathjs functions, find the corresponding implementation in the MathTS file(s) below "
        f"and assess parity. Functions to audit: {', '.join(names)}\n\n"
        f"=== MATHJS REFERENCE SOURCES ==={mj_section}\n"
        f"=== MATHTS IMPLEMENTATIONS ==={mt_section}\n\n"
        f"=== TASK ===\n"
        f"For EACH function in the list above, output a JSON object with these fields:\n"
        f"  - name: function name\n"
        f"  - found_in_mathts: true/false (did you locate an implementation in the MathTS files above?)\n"
        f"  - signature_match: \"match\" | \"compatible\" | \"diverged\" | \"unknown\"\n"
        f"  - algorithm_match: \"match\" | \"compatible\" | \"diverged\" | \"unknown\"\n"
        f"  - notes: ONE short sentence (max 25 words) on what's different, or empty string if match\n"
        f"\n"
        f"Rules:\n"
        f"  - \"match\" = behaviorally identical\n"
        f"  - \"compatible\" = same intent, minor differences (e.g., error message format, AS pointer vs TS array signature)\n"
        f"  - \"diverged\" = different algorithm, different edge case handling, or different output shape\n"
        f"  - \"unknown\" = cannot determine from the truncated source\n"
        f"\n"
        f"Output ONLY a JSON array of these objects. No markdown fences, no commentary, no prose.\n"
    )


def main():
    if len(sys.argv) != 2:
        print("Usage: python audit_category.py <category>")
        sys.exit(1)
    category = sys.argv[1]
    mathjs_funcs = load_mathjs_new_funcs(category)
    mathts_files = load_mathts_active(category)

    print(f"[audit] {category}: {len(mathjs_funcs)} mathjs funcs, {len(mathts_files)} mathts file(s)", flush=True)
    if not mathjs_funcs:
        print(f"[audit] No mathjs functions for category {category}; skipping")
        return

    prompt = build_prompt(category, mathjs_funcs, mathts_files)
    print(f"[audit] Prompt size: {len(prompt):,} chars", flush=True)

    # Sonnet has a context budget; if prompt > 180K chars we'd need to chunk. Most categories fit.
    result = llm_query(prompt, max_tokens=6144, temperature=0.0)

    audits = Path(__file__).parent / "audits"
    audits.mkdir(exist_ok=True)
    out = audits / f"{category}.json"
    out.write_text(result, encoding="utf-8")
    print(f"[audit] Wrote {out} ({len(result):,} chars)", flush=True)


if __name__ == "__main__":
    main()
