/**
 * Symbolic derivative of a sum of additive terms (split on `' + '`).
 *
 * Shared by {@link symbolicPartialDerivative} and the CAS derivative kernel.
 * Does not apply the “no variable in whole expression → `'0'`” shortcut; callers
 * handle that when needed.
 *
 * Power/linear {@link RegExp}s are built per term, and only after that term
 * contains {@code variable}. Hoisting them (as `_casDerivativeOne` used to)
 * throws `SyntaxError` for a regex-metacharacter variable even when no term
 * contains it — `symbolicPartialDerivative('1 + 2', '*')` must stay `'0 + 0'`.
 * {@code variable} is still interpolated raw, matching both callers.
 *
 * @param expr - Expression treated as a sum of terms
 * @param variable - Differentiation variable (interpolated raw into RegExp)
 * @returns Derivative string with terms joined by `' + '`
 */
export function derivativeOfAdditiveTerms(expr: string, variable: string): string {
  const terms = expr.split(/\s*\+\s*/);
  const derivedTerms: string[] = [];

  for (const term of terms) {
    const t = term.trim();

    if (t.indexOf(variable) === -1) {
      derivedTerms.push('0');
      continue;
    }

    const powerRe = new RegExp('^(-?\\d*\\.?\\d*)\\s*\\*?\\s*' + variable + '\\^(\\d+)$');
    const linearRe = new RegExp('^(-?\\d*\\.?\\d*)\\s*\\*?\\s*' + variable + '$');
    const powerMatch = t.match(powerRe);
    if (powerMatch) {
      const coeff =
        powerMatch[1] === '' || powerMatch[1] === undefined ? 1 : parseFloat(powerMatch[1]);
      const n = parseInt(powerMatch[2], 10);
      if (n === 0) {
        derivedTerms.push('0');
      } else if (n === 1) {
        derivedTerms.push(String(coeff));
      } else {
        derivedTerms.push(coeff * n + '*' + variable + '^' + (n - 1));
      }
      continue;
    }

    const linearMatch = t.match(linearRe);
    if (linearMatch) {
      const coeff = linearMatch[1] === '' ? 1 : parseFloat(linearMatch[1]);
      derivedTerms.push(String(coeff));
      continue;
    }

    if (t === variable) {
      derivedTerms.push('1');
      continue;
    }

    if (t === 'sin(' + variable + ')') {
      derivedTerms.push('cos(' + variable + ')');
      continue;
    }

    if (t === 'cos(' + variable + ')') {
      derivedTerms.push('-sin(' + variable + ')');
      continue;
    }

    if (t === 'exp(' + variable + ')') {
      derivedTerms.push('exp(' + variable + ')');
      continue;
    }

    if (t === 'ln(' + variable + ')') {
      derivedTerms.push('1/' + variable);
      continue;
    }

    derivedTerms.push('d/d' + variable + '(' + t + ')');
  }

  return derivedTerms.join(' + ');
}
