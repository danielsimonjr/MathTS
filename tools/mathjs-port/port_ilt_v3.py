"""
Re-port inverseLaplaceTransform — v3. Corrected understanding: mathjs's algorithm
IS numerical pattern-matching against sample points; that is THE algorithm, not
a workaround. Higher max_tokens to avoid truncation.
"""
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MATHJS = Path.home() / "Dropbox" / "Github" / "Mathjs"
SKILL_SCRIPTS = Path.home() / ".claude" / "skills" / "rlm" / "scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))
from rlm_query import llm_query  # noqa: E402

mathjs_src = (MATHJS / "src/function/algebra/inverseLaplaceTransform.js").read_text(encoding="utf-8")
mathjs_test = (MATHJS / "test/unit-tests/function/algebra/inverseLaplaceTransform.test.js").read_text(encoding="utf-8")

# Use cas.ts as the style reference for typed-function dispatch + node-level evaluation patterns
template_full = (REPO / "functions/src/typed/cas.ts").read_text(encoding="utf-8")
# Sample beginning + middle + end so the LLM sees the dispatch pattern + helper styles
template = template_full[:8000] + "\n...[middle elided]...\n" + template_full[-6000:]

prompt = (
    "Port mathjs's inverseLaplaceTransform from JS to TS for MathTS.\n\n"
    "ALGORITHM (this is what mathjs actually does — DO NOT substitute a different one):\n"
    "Numerical pattern-matching. The function evaluates the input node at sample s-values "
    "(s=2,3,5,7) and compares numerically to known Laplace transform pairs (1/s, 1/s^2, "
    "c/(s-a), c/(s^2 + b^2), c/(s^2 - a^2), c/s^n, etc.). When a pattern matches within tolerance, "
    "it emits the corresponding t-domain formula as a string. For sums/differences at the top "
    "level, it recurses on each operand.\n\n"
    "This is correct: symbolic ILT is generally undecidable, so mathjs uses pattern-matching "
    "against a table of known transforms.\n\n"
    "PORT REQUIREMENTS:\n"
    "1. Public export `inverseLaplaceTransform` via `mathTyped('inverseLaplaceTransform', { ... })`.\n"
    "2. Accept `(expr: string | Node, sVar?: string, tVar?: string)`. Default s='s', t='t'.\n"
    "3. Use node-level evaluation: parse the input via `parse()` from the expression package, "
    "then `node.evaluate({ [sVar]: sample })` in your `_evalAt` helper (NOT a re-parse per call).\n"
    "4. Return a STRING in t-domain.\n"
    "5. Preserve mathjs's error messages.\n"
    "6. Import extensions must be `.js`.\n"
    "7. Use existing helper imports from cas.ts where possible (parse, evaluate, gcdNum, etc.).\n"
    "8. Output the COMPLETE function set — do not truncate. If you run low on space, prioritize "
    "completeness over comments.\n\n"
    f"=== MATHJS SOURCE ({len(mathjs_src)} chars) ===\n{mathjs_src}\n\n"
    f"=== MATHJS TESTS (first 6000 chars) ===\n{mathjs_test[:6000]}\n\n"
    f"=== MATHTS typed/cas.ts (style reference) ===\n{template}\n\n"
    "=== OUTPUT FORMAT ===\n"
    "Output ONLY the TypeScript code to APPEND to cas.ts. No markdown fences, no commentary.\n"
)

print(f"[ilt-v3] Prompt size: {len(prompt):,} chars", flush=True)
result = llm_query(prompt, max_tokens=12288, temperature=0.0)
out = REPO / "tools/mathjs-port/drafts/inverseLaplaceTransform.ts.v3.draft"
out.write_text(result, encoding="utf-8")
print(f"[ilt-v3] Wrote {out} ({len(result):,} chars)", flush=True)
