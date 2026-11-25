/**
 * mathjs 15.3.0 omits the extra space native MathTS inserts between some LaTeX
 * operator commands and their operands (#1578). Native expression keeps the
 * space (#1014); compat applies this post-pass on the finished string.
 */

/** Unary `not` before boolean/null constants (operand has no leading space). */
const NEG_BEFORE_BOOLEAN = /(\\neg) (true|false|null)\b/g;
/** Explicit multiply/mod before boolean constants (#1578 repro rows). */
const ARITHMETIC_OP_BEFORE_BOOLEAN = /(\\(?:cdot|mod)) (true|false|null)\b/g;
/**
 * Boolean operators before units, handler output, or bare constants — not before
 * a plain symbol operand (` x\wedge y` keeps its space).
 */
const BOOL_OP_BEFORE_NON_SYMBOL = /(\\(?:wedge|veebar|vee|land)) (\\mathrm|\[|true|false|null)/g;
/** Handler literals like `C[true]` (no leading space on the operand). */
const NEG_BEFORE_HANDLER_LITERAL = /(\\neg) (?=[A-Za-z]+\[)/g;
const BOOL_OP_BEFORE_HANDLER_LITERAL = /(\\(?:wedge|veebar|vee|land)) (?=[A-Za-z]+\[)/g;
/**
 * Adjust native MathTS `toTex` output to match mathjs operator joins.
 */
export function mathjsCompatToTexString(tex: string): string {
  return tex
    .replace(NEG_BEFORE_BOOLEAN, '$1$2')
    .replace(ARITHMETIC_OP_BEFORE_BOOLEAN, '$1$2')
    .replace(BOOL_OP_BEFORE_NON_SYMBOL, '$1$2')
    .replace(NEG_BEFORE_HANDLER_LITERAL, '$1')
    .replace(BOOL_OP_BEFORE_HANDLER_LITERAL, '$1');
}

/** mathjs 15.3.0 emits a carriage return instead of `\right` on relational chains (# quirks). */
export function mathjsCompatRelationalParenthesisToTex(tex: string): string {
  return tex.replace(/\\right\)/g, '\r' + 'ight)');
}