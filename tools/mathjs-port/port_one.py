"""
port_one.py — port a single mathjs JS function to TS or AS, using rlm_query.

Usage:
    python -X utf8 port_one.py <function_name>

Reads the manifest.json next to this script, looks up the function entry,
loads mathjs source + test + an existing MathTS file as a style reference,
calls rlm_query with a strict prompt, and writes the result to a draft file
under tools/mathjs-port/drafts/. Does NOT touch the live target file —
that's done by integrate.py after human review.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MATHJS = Path.home() / "Dropbox" / "Github" / "Mathjs"
SKILL_SCRIPTS = Path.home() / ".claude" / "skills" / "rlm" / "scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))
from rlm_query import llm_query  # noqa: E402


def load_manifest() -> dict:
    return json.loads((Path(__file__).parent / "manifest.json").read_text(encoding="utf-8"))


def find_entry(manifest: dict, name: str) -> dict:
    for entry in manifest["ports"]:
        if entry["name"] == name:
            return entry
    raise KeyError(f"No manifest entry for {name!r}")


def read_or_empty(path: Path, max_chars: int = 20000) -> str:
    if not path.exists():
        return f"(file not found: {path})"
    text = path.read_text(encoding="utf-8", errors="replace")
    return text if len(text) <= max_chars else text[:max_chars] + "\n... [truncated]"


def build_prompt(entry: dict) -> str:
    mathjs_src = read_or_empty(MATHJS / entry["mathjs_source"])
    mathjs_test = read_or_empty(MATHJS / entry["mathjs_test"])
    target_path = REPO / entry["target_path"]
    target_template = read_or_empty(target_path) if target_path.exists() else "(target file does not yet exist — create new)"

    if entry["target_lang"] == "as":
        constraints = (
            "Target: AssemblyScript (strict TS subset). Hard constraints:\n"
            "- Use raw memory pointers (usize) + length (i32) for array params, matching the existing pattern.\n"
            "- Read elements with `load<f64>(ptr + (<usize>i << 3))`.\n"
            "- NO closures over reference types, NO `any`, NO dynamic `obj[key]` access, NO `try/catch` on non-Error.\n"
            "- NO BigNumber/Fraction/Complex polymorphism — f64 only.\n"
            "- NO `String.replace`, NO regex, NO `Array.prototype` methods that take closures.\n"
            "- Return primitive types (f64, i32) or write results back via output pointers.\n"
            "- Add a JSDoc comment block matching the style in the template.\n"
        )
    else:
        constraints = (
            "Target: TypeScript with typed-function dispatch. Hard constraints:\n"
            "- Use `mathTyped('name', { signatures })` pattern matching the template.\n"
            "- Import Complex/Fraction/BigNumber from '@danielsimonjr/mathts-core' as needed.\n"
            "- Use the existing `parse`, `simplify`, etc. utilities from the active layer where available.\n"
            "- Preserve mathjs's error messages and edge-case behavior.\n"
            "- Import extensions must be `.js`.\n"
        )

    return (
        f"You are porting one mathjs function from JavaScript to {entry['target_lang'].upper()} for the MathTS project.\n\n"
        f"Function: {entry['name']} (category: {entry['category']})\n"
        f"Mode: {entry['target_mode']} into {entry['target_path']}\n"
        f"Rationale: {entry['reason']}\n\n"
        f"=== MATHJS SOURCE ({entry['mathjs_source']}) ===\n{mathjs_src}\n\n"
        f"=== MATHJS TESTS ({entry['mathjs_test']}) ===\n{mathjs_test}\n\n"
        f"=== MATHTS TARGET FILE ({entry['target_path']}, first 20K chars as style reference) ===\n{target_template}\n\n"
        f"=== CONSTRAINTS ===\n{constraints}\n"
        f"=== OUTPUT FORMAT ===\n"
        f"Output ONLY the new code to {'append to' if entry['target_mode'] == 'append' else 'put in'} the target file. "
        f"No markdown code fences, no commentary, no leading/trailing prose. Just the raw code.\n"
        f"If the function is impossible to port (constraint violations cannot be worked around), output exactly "
        f"`// PORT IMPOSSIBLE: <reason>` on a single line.\n"
    )


def main():
    if len(sys.argv) != 2:
        print("Usage: python port_one.py <function_name>")
        sys.exit(1)
    name = sys.argv[1]
    manifest = load_manifest()
    entry = find_entry(manifest, name)
    prompt = build_prompt(entry)

    print(f"[port_one] Porting {name} ({entry['target_lang'].upper()}) -> draft", flush=True)
    print(f"[port_one] Prompt size: {len(prompt):,} chars", flush=True)

    result = llm_query(prompt, max_tokens=4096, temperature=0.0)

    drafts = Path(__file__).parent / "drafts"
    drafts.mkdir(exist_ok=True)
    out = drafts / f"{name}.{entry['target_lang']}.draft"
    out.write_text(result, encoding="utf-8")
    print(f"[port_one] Wrote {out} ({len(result):,} chars)", flush=True)


if __name__ == "__main__":
    main()
