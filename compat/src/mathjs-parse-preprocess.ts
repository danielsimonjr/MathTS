/**
 * mathjs 15.3.0 parse quirks that differ from the native expression lexer (#1786).
 */

/** Bare `2e` only — not `2e3` (scientific) or `3e.5` (invalid exponent; must parse-fail). */
const NUMBER_THEN_E = /(\d)([eE])(?![+-]?\d)(?!\.)/g;

/**
 * Rewrite `2e` → `2*e` without touching scientific `2e3` / `2e-4` / `2e+1`.
 */
export function preprocessMathjsCompatParseInput(expr: string): string {
  if (!NUMBER_THEN_E.test(expr)) return expr;
  NUMBER_THEN_E.lastIndex = 0;
  return expr.replace(NUMBER_THEN_E, '$1*$2');
}
