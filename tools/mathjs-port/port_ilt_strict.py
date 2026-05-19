"""
Re-port inverseLaplaceTransform with explicit instructions to MIRROR mathjs's
algorithm (parse-tree substitution) rather than substitute a different approach.
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

template = (REPO / "functions/src/typed/cas.ts").read_text(encoding="utf-8")[:15000]

prompt = (
    "You are porting mathjs's inverseLaplaceTransform from JavaScript to TypeScript for MathTS.\n\n"
    "PREVIOUS ATTEMPT FAILED because the LLM substituted a different algorithm (numerical pattern-matching\n"
    "against expression strings). DO NOT do that. You MUST mirror mathjs's algorithm exactly:\n"
    "\n"
    "1. Parse the input expression using `parse` from the expression package.\n"
    "2. Walk the parse tree (ConstantNode, SymbolNode, OperatorNode, FunctionNode).\n"
    "3. Apply substitution rules (partial fractions, lookup table) at the NODE level, not the string level.\n"
    "4. Return a Node, NOT a string.\n"
    "5. Match mathjs's exact function signature, behavior, and error messages.\n"
    "\n"
    f"=== MATHJS SOURCE ({len(mathjs_src)} chars, AUTHORITATIVE) ===\n"
    f"{mathjs_src}\n\n"
    f"=== MATHJS TESTS ({len(mathjs_test)} chars, BEHAVIORAL CONTRACT) ===\n"
    f"{mathjs_test[:8000]}\n\n"
    f"=== MATHTS typed/cas.ts (style reference for typed-function dispatch) ===\n"
    f"{template}\n\n"
    "=== HARD CONSTRAINTS ===\n"
    "- Use `mathTyped('inverseLaplaceTransform', { signatures... })` for the public export.\n"
    "- Internal helpers must operate on Node objects, not stringified expressions.\n"
    "- Import `parse` from '@danielsimonjr/mathts-expression' (or matching path used in cas.ts).\n"
    "- Import Node types from the same source.\n"
    "- Preserve mathjs's exact error messages.\n"
    "- Import extensions must be `.js`.\n"
    "- NO numerical-pattern-matching shortcuts. If mathjs walks the tree, you walk the tree.\n"
    "\n"
    "=== OUTPUT FORMAT ===\n"
    "Output ONLY the new TypeScript code to APPEND to cas.ts. No markdown fences, no commentary.\n"
    "If the port is truly impossible given the constraints, output exactly\n"
    "`// PORT BLOCKED: <reason>` on a single line.\n"
)

print(f"[ilt-strict] Prompt size: {len(prompt):,} chars", flush=True)
result = llm_query(prompt, max_tokens=8192, temperature=0.0)
out = REPO / "tools/mathjs-port/drafts/inverseLaplaceTransform.ts.v2.draft"
out.write_text(result, encoding="utf-8")
print(f"[ilt-strict] Wrote {out} ({len(result):,} chars)", flush=True)
