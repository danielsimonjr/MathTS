/**
 * mathjs 15.3.0 parse quirks that differ from the native expression lexer (#1786).
 */

/** Bare `2e` only — not `2e3`, `3e-.5`, or dot-operator `2E.*`. */
const NUMBER_THEN_E = /(\d)([eE])(?![+-]?\d)(?!\.)(?![+-])/g;

/** Implicit multiply before mathjs dot operators (`2E.*3` → `2*E.*3`). */
const NUMBER_THEN_E_DOT_OP = /(\d)([eE])(?=\.\*|\.\^|\.\/)/g;

/** Scientific notation must not be followed by a fractional mantissa (`3e.5`). */
const INVALID_EXPONENT_DOT = /\d[eE][+-]?\.\d/;

function assertValidMathjsExponentSyntax(expr: string): void {
  if (INVALID_EXPONENT_DOT.test(expr)) {
    throw new SyntaxError('Digit expected, got "."');
  }
}

/** `(3).toString()` / `.toFixed()` — expression sandbox blocks primitive methods. */
const PAREN_NUMBER_TOSTRING = /\((\d+(?:\.\d+)?)\)\.toString\(\)/g;
const PAREN_NUMBER_TOFIXED = /\((\d+(?:\.\d+)?)\)\.toFixed\(\)/g;

/**
 * Rewrite `2e` → `2*e` without touching scientific `2e3` / `2e-4` / `2e+1` or invalid `3e-.5`.
 */
export function preprocessMathjsCompatParseInput(expr: string): string {
  assertValidMathjsExponentSyntax(expr);
  let out = expr.replace(PAREN_NUMBER_TOSTRING, (_, num) => `"${num}"`);
  out = out.replace(
    PAREN_NUMBER_TOFIXED,
    (_, num) => `format(${num}, {notation: "fixed", precision: 0})`
  );
  out = out.replace(NUMBER_THEN_E_DOT_OP, '$1*$2');
  if (!NUMBER_THEN_E.test(out)) return out;
  NUMBER_THEN_E.lastIndex = 0;
  return out.replace(NUMBER_THEN_E, '$1*$2');
}
