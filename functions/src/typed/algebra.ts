/**
 * Typed Algebra Functions
 *
 * Native TypeScript implementations of polynomial operations, expression
 * manipulation, and algebraic utilities. Polynomial functions work with
 * coefficient arrays where index corresponds to power (e.g., [1, 2, 3]
 * represents 1 + 2x + 3x^2). Expression manipulation functions operate
 * on string expressions.
 *
 * @packageDocumentation
 */

import {
  polyMulDispatch,
  polyDivModDispatch,
  resultantDispatch,
  discriminantDispatch,
  WASM_POLY_THRESHOLD,
} from '../wasm/poly/wasm-bridge.js';
import {
  polyFromExpression,
  buchberger,
  polyToString as idealPolyToString,
} from './polynomial-ideal.js';

// =============================================================================
// Type Aliases
// =============================================================================

type f64 = number;

// =============================================================================
// Internal Helpers
// =============================================================================

/** Reserved math identifiers that are not variables */
const MATH_KEYWORDS = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'log',
  'ln',
  'log2',
  'log10',
  'exp',
  'sqrt',
  'cbrt',
  'abs',
  'ceil',
  'floor',
  'round',
  'sign',
  'pi',
  'e',
  'i',
  'Infinity',
  'NaN',
  'true',
  'false',
  'null',
  'undefined',
]);

/**
 * Strip leading zero coefficients from the high end of a polynomial,
 * preserving at least one coefficient.
 */
function trimPoly(coeffs: number[]): number[] {
  let end = coeffs.length - 1;
  while (end > 0 && coeffs[end] === 0) end--;
  return coeffs.slice(0, end + 1);
}

/**
 * Polynomial long division: returns [quotient, remainder].
 * Both dividend and divisor are coefficient arrays (index = power).
 * Routes through the WASM kernel for large inputs.
 */
function polyDivMod(a: number[], b: number[]): [number[], number[]] {
  const at = trimPoly(a);
  const bt = trimPoly(b);

  if (bt.length === 1 && bt[0] === 0) {
    throw new Error('Division by zero polynomial');
  }

  if (at.length < bt.length) {
    return [[], [...at]];
  }

  // WASM fast path for large inputs.
  if (at.length >= WASM_POLY_THRESHOLD) {
    const fa = new Float64Array(at);
    const fb = new Float64Array(bt);
    const { quotient, remainder } = polyDivModDispatch(fa, fb);
    return [trimPoly(Array.from(quotient)), trimPoly(Array.from(remainder))];
  }

  const remainder = [...at];
  const quotientLength = at.length - bt.length + 1;
  const quotient: number[] = new Array(quotientLength).fill(0);

  for (let i = quotientLength - 1; i >= 0; i--) {
    quotient[i] = remainder[i + bt.length - 1] / bt[bt.length - 1];
    for (let j = 0; j < bt.length; j++) {
      remainder[i + j] -= quotient[i] * bt[j];
    }
  }

  return [trimPoly(quotient), trimPoly(remainder.slice(0, bt.length - 1))];
}

/** Numeric GCD (Euclidean algorithm) */
function gcdNum(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Compute determinant of a square matrix via Gaussian elimination with partial pivoting.
 */
function determinant(matrix: number[][]): f64 {
  const n = matrix.length;
  const m = matrix.map((row) => [...row]); // clone
  let det: f64 = 1;

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(m[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > maxVal) {
        maxVal = Math.abs(m[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-15) return 0;

    if (maxRow !== col) {
      [m[col], m[maxRow]] = [m[maxRow], m[col]];
      det *= -1;
    }

    det *= m[col][col];

    for (let row = col + 1; row < n; row++) {
      const factor = m[row][col] / m[col][col];
      for (let j = col; j < n; j++) {
        m[row][j] -= factor * m[col][j];
      }
    }
  }

  return det;
}

// =============================================================================
// Polynomial Operations (12)
// =============================================================================

/**
 * Evaluate a polynomial at a given point using Horner's method.
 *
 * Coefficients are ordered by ascending power: coeffs[i] is the
 * coefficient of x^i. E.g., [1, 2, 3] represents 1 + 2x + 3x^2.
 *
 * @param coeffs - Coefficient array (index = power)
 * @param x - Point at which to evaluate
 * @returns The polynomial value at x
 *
 * @example
 * ```typescript
 * polyval([1, 2, 3], 2); // 1 + 2*2 + 3*4 = 17
 * polyval([1, 0, -1], 3); // 1 + 0 - 9 = -8
 * ```
 */
export function polyval(coeffs: number[], x: f64): f64 {
  if (coeffs.length === 0) return 0;
  let result: f64 = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = result * x + coeffs[i];
  }
  return result;
}

/**
 * Add two polynomials represented as coefficient arrays.
 *
 * @param a - First polynomial coefficients
 * @param b - Second polynomial coefficients
 * @returns Sum polynomial coefficients
 *
 * @example
 * ```typescript
 * polyadd([1, 2], [3, 4, 5]); // [4, 6, 5]
 * ```
 */
export function polyadd(a: number[], b: number[]): number[] {
  const len = Math.max(a.length, b.length);
  const result: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = (a[i] ?? 0) + (b[i] ?? 0);
  }
  return trimPoly(result);
}

/**
 * Multiply two polynomials (convolution of coefficient arrays).
 *
 * @param a - First polynomial coefficients
 * @param b - Second polynomial coefficients
 * @returns Product polynomial coefficients
 *
 * @example
 * ```typescript
 * polymul([1, 1], [1, 1]); // [1, 2, 1] => (1+x)^2
 * ```
 */
export function polymul(a: number[], b: number[]): number[] {
  if (a.length === 0 || b.length === 0) return [0];
  // WASM fast path for large inputs.
  if (a.length >= WASM_POLY_THRESHOLD || b.length >= WASM_POLY_THRESHOLD) {
    const fa = new Float64Array(a);
    const fb = new Float64Array(b);
    const out = polyMulDispatch(fa, fb);
    return trimPoly(Array.from(out));
  }
  const result: number[] = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] += a[i] * b[j];
    }
  }
  return trimPoly(result);
}

/**
 * Compute the n-th derivative of a polynomial.
 *
 * @param coeffs - Polynomial coefficients (index = power)
 * @param n - Number of derivatives to take (default 1)
 * @returns Derivative polynomial coefficients
 *
 * @example
 * ```typescript
 * polyder([1, 2, 3]); // [2, 6] => derivative of 1+2x+3x^2
 * polyder([1, 2, 3, 4], 2); // [6, 24] => second derivative
 * ```
 */
export function polyder(coeffs: number[], n: number = 1): number[] {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error('Derivative order must be a non-negative integer');
  }
  let result = [...coeffs];
  for (let k = 0; k < n; k++) {
    if (result.length <= 1) return [0];
    result = result.slice(1).map((c, i) => c * (i + 1));
  }
  return result;
}

/**
 * Compute the GCD of two polynomials using the Euclidean algorithm.
 * The result is monic (leading coefficient = 1).
 *
 * @param a - First polynomial coefficients
 * @param b - Second polynomial coefficients
 * @returns GCD polynomial coefficients (monic)
 *
 * @example
 * ```typescript
 * // GCD of x^2-1 and x-1 is x-1
 * polynomialGCD([-1, 0, 1], [-1, 1]); // [-1, 1]
 * ```
 */
export function polynomialGCD(a: number[], b: number[]): number[] {
  let r0 = trimPoly([...a]);
  let r1 = trimPoly([...b]);

  while (r1.length > 1 || r1[0] !== 0) {
    const [, remainder] = polyDivMod(r0, r1);
    r0 = r1;
    r1 = remainder.length === 0 ? [0] : remainder;
  }

  // Make monic
  const leading = r0[r0.length - 1];
  if (leading !== 0 && leading !== 1) {
    return r0.map((c) => c / leading);
  }
  return r0;
}

/**
 * Compute the LCM of two polynomials: LCM(a, b) = (a * b) / GCD(a, b).
 *
 * @param a - First polynomial coefficients
 * @param b - Second polynomial coefficients
 * @returns LCM polynomial coefficients
 */
export function polynomialLCM(a: number[], b: number[]): number[] {
  const gcd = polynomialGCD(a, b);
  const [quotient] = polyDivMod(polymul(a, b), gcd);
  // Make monic
  const leading = quotient[quotient.length - 1];
  if (leading !== 0 && leading !== 1) {
    return quotient.map((c) => c / leading);
  }
  return quotient;
}

/**
 * Compute the quotient of polynomial division a / b.
 *
 * @param a - Dividend polynomial coefficients
 * @param b - Divisor polynomial coefficients
 * @returns Quotient polynomial coefficients
 *
 * @example
 * ```typescript
 * // (x^2 - 1) / (x - 1) = x + 1
 * polynomialQuotient([-1, 0, 1], [-1, 1]); // [1, 1]
 * ```
 */
export function polynomialQuotient(a: number[], b: number[]): number[] {
  const [quotient] = polyDivMod(a, b);
  return quotient.length === 0 ? [0] : quotient;
}

/**
 * Compute the remainder of polynomial division a / b.
 *
 * @param a - Dividend polynomial coefficients
 * @param b - Divisor polynomial coefficients
 * @returns Remainder polynomial coefficients
 */
export function polynomialRemainder(a: number[], b: number[]): number[] {
  const [, remainder] = polyDivMod(a, b);
  return remainder.length === 0 ? [0] : remainder;
}

/**
 * Return the degree of a polynomial.
 *
 * @param coeffs - Polynomial coefficients (index = power)
 * @returns Degree (highest power with non-zero coefficient)
 *
 * @example
 * ```typescript
 * degree([1, 2, 3]); // 2
 * degree([5]); // 0
 * degree([0]); // 0
 * ```
 */
export function degree(coeffs: number[]): number {
  const trimmed = trimPoly(coeffs);
  if (trimmed.length === 1 && trimmed[0] === 0) return 0;
  return trimmed.length - 1;
}

/**
 * Extract the coefficient list of a polynomial, trimming leading zeros.
 *
 * @param coeffs - Polynomial coefficients (index = power)
 * @returns Trimmed coefficient array
 */
export function coefficientList(coeffs: number[]): number[] {
  return trimPoly([...coeffs]);
}

/**
 * Compute the discriminant of a polynomial.
 *
 * For quadratic ax^2 + bx + c: discriminant = b^2 - 4ac
 * For cubic ax^3 + bx^2 + cx + d: discriminant = 18abcd - 4b^3d + b^2c^2 - 4ac^3 - 27a^2d^2
 *
 * @param coeffs - Polynomial coefficients (index = power)
 * @returns Discriminant value
 */
export function discriminant(coeffs: number[]): f64 {
  const t = trimPoly(coeffs);
  const deg = t.length - 1;

  if (deg < 1) {
    throw new Error('Discriminant requires polynomial of degree >= 1');
  }

  // WASM fast path for large inputs.
  if (t.length >= WASM_POLY_THRESHOLD) {
    return discriminantDispatch(new Float64Array(t));
  }

  if (deg === 1) {
    return 1; // Linear polynomials: discriminant is 1 (always one root)
  }
  if (deg === 2) {
    const [c, b, a] = [t[0], t[1], t[2]];
    return b * b - 4 * a * c;
  }
  if (deg === 3) {
    const [d, c, b, a] = [t[0], t[1], t[2], t[3]];
    return (
      18 * a * b * c * d -
      4 * b * b * b * d +
      b * b * c * c -
      4 * a * c * c * c -
      27 * a * a * d * d
    );
  }
  // For degree >= 4, compute via resultant of f and f'
  // disc(f) = (-1)^(n(n-1)/2) * (1/a_n) * resultant(f, f')
  const fp = polyder(t);
  const res = resultant(t, fp);
  const an = t[t.length - 1];
  const sign = ((deg * (deg - 1)) / 2) % 2 === 0 ? 1 : -1;
  return (sign * res) / an;
}

/**
 * Compute finite differences of a sequence.
 *
 * The k-th finite difference of arr is computed by applying the forward
 * difference operator k times. Without a second argument, computes
 * first differences.
 *
 * @param arr - Input array
 * @param n - Number of difference iterations (default 1)
 * @returns Array of finite differences
 *
 * @example
 * ```typescript
 * differences([1, 4, 9, 16]); // [3, 5, 7]
 * differences([1, 4, 9, 16], 2); // [2, 2]
 * ```
 */
export function differences(arr: number[], n: number = 1): number[] {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error('Difference order must be a non-negative integer');
  }
  let result = [...arr];
  for (let k = 0; k < n; k++) {
    if (result.length <= 1) return [];
    const next: number[] = new Array(result.length - 1);
    for (let i = 0; i < next.length; i++) {
      next[i] = result[i + 1] - result[i];
    }
    result = next;
  }
  return result;
}

// =============================================================================
// Expression Manipulation (12)
// =============================================================================

/**
 * Extract free variable names from an expression string.
 * Filters out known math function names and constants.
 *
 * @param expr - Expression string
 * @returns Sorted array of variable names
 *
 * @example
 * ```typescript
 * variables('x^2 + 2*y + sin(z)'); // ['x', 'y', 'z']
 * variables('pi * r^2'); // ['r']
 * ```
 */
export function variables(expr: string): string[] {
  const vars = new Set<string>();
  const regex = /[a-zA-Z_]\w*/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(expr)) !== null) {
    if (!MATH_KEYWORDS.has(match[0])) {
      vars.add(match[0]);
    }
  }
  return [...vars].sort();
}

/**
 * Substitute variables in an expression string with their values.
 *
 * @param expr - Expression string
 * @param vars - Map of variable name to replacement value
 * @returns Expression string with substitutions applied
 *
 * @example
 * ```typescript
 * substitute('x^2 + y', { x: '3', y: '1' }); // '3^2 + 1'
 * substitute('a*b + c', { a: '(x+1)' }); // '(x+1)*b + c'
 * ```
 */
export function substitute(expr: string, vars: Record<string, string>): string {
  let result = expr;
  // Sort by length descending to avoid partial replacements
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('\\b' + escaped + '\\b', 'g');
    result = result.replace(pattern, vars[key]);
  }
  return result;
}

/**
 * Expand an expression string by distributing multiplication over addition.
 * Basic implementation: handles simple products of sums.
 *
 * @param expr - Expression string
 * @returns Expanded expression string
 *
 * @example
 * ```typescript
 * expand('(a+b)*(c+d)'); // 'a*c + a*d + b*c + b*d'
 * ```
 */
export function expand(expr: string): string {
  let result = expr;

  // Handle (expr)^2 => (expr)*(expr)
  result = result.replace(/\(([^()]+)\)\^2/g, '($1)*($1)');

  // Split a factor into its additive terms, treating binary subtraction as a
  // signed term: "x - 2" → ["x", "-2"] (NOT ["x - 2"]). Without this the minus
  // dangled and `x*(x-2)` distributed to "x*x - 2" instead of "x*x + x*-2".
  const splitTerms = (factor: string): string[] =>
    factor
      .replace(/\s*-\s*/g, ' + -')
      .split(/\s*\+\s*/)
      .map((t) => t.trim())
      .filter((t) => t !== '');

  // Handle (a±b)*(c±d) by distributing
  const mulPattern = /\(([^()]+)\)\s*\*\s*\(([^()]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = mulPattern.exec(result)) !== null) {
    const leftTerms = splitTerms(match[1]);
    const rightTerms = splitTerms(match[2]);
    const products: string[] = [];
    for (const l of leftTerms) {
      for (const r of rightTerms) {
        products.push(l.trim() + '*' + r.trim());
      }
    }
    result =
      result.slice(0, match.index) +
      products.join(' + ') +
      result.slice(match.index + match[0].length);
    mulPattern.lastIndex = 0;
  }

  return result;
}

/**
 * Factor an expression string.
 * Basic implementation: factors out common numeric factors and GCDs from terms.
 *
 * @param expr - Expression string
 * @returns Factored expression string
 */
export function factor(expr: string): string {
  // Normalize subtraction so negative terms are handled as "+ -coeff*var"
  const normalized = expr.replace(/\s*-\s*/g, ' + -');
  const terms = normalized.split(/\s*\+\s*/).filter((t) => t.trim() !== '');
  if (terms.length < 2) return expr;

  const coeffs: number[] = [];
  const varParts: string[] = [];

  for (const term of terms) {
    const numMatch = term.match(/^(-?\d+)\s*\*?\s*(.*)$/);
    if (numMatch) {
      coeffs.push(parseInt(numMatch[1], 10));
      varParts.push(numMatch[2] || '1');
    } else {
      return expr;
    }
  }

  let g = Math.abs(coeffs[0]);
  for (let i = 1; i < coeffs.length; i++) {
    g = gcdNum(g, Math.abs(coeffs[i]));
  }

  if (g <= 1) return expr;

  const inner = coeffs
    .map((c, i) => {
      const reduced = c / g;
      if (varParts[i] === '1') return String(reduced);
      if (reduced === 1) return varParts[i];
      if (reduced === -1) return '-' + varParts[i];
      return reduced + '*' + varParts[i];
    })
    .join(' + ');

  return g + '*(' + inner + ')';
}

/**
 * Collect like terms with respect to a variable.
 *
 * @param expr - Expression string
 * @param variable - Variable to collect terms for
 * @returns Expression with collected terms
 */
export function collect(expr: string, variable: string): string {
  // Normalize subtraction so negative terms are handled as "+ -coeff*var"
  const normalized = expr.replace(/\s*-\s*/g, ' + -');
  const terms = normalized.split(/\s*\+\s*/).filter((t) => t.trim() !== '');
  const byPower = new Map<number, number>();

  for (const term of terms) {
    const trimmed = term.trim();
    const powerRe = new RegExp('(-?\\d*\\.?\\d*)\\s*\\*?\\s*' + variable + '\\^(\\d+)');
    const linearRe = new RegExp('(-?\\d*\\.?\\d*)\\s*\\*?\\s*' + variable + '(?!\\^)(?!\\w)');
    const powerMatch = trimmed.match(powerRe);
    const linearMatch = trimmed.match(linearRe);

    if (powerMatch) {
      const coeff =
        powerMatch[1] === '' || powerMatch[1] === '+'
          ? 1
          : powerMatch[1] === '-'
            ? -1
            : parseFloat(powerMatch[1]);
      const power = parseInt(powerMatch[2], 10);
      byPower.set(power, (byPower.get(power) ?? 0) + coeff);
    } else if (linearMatch) {
      const coeff =
        linearMatch[1] === '' || linearMatch[1] === '+'
          ? 1
          : linearMatch[1] === '-'
            ? -1
            : parseFloat(linearMatch[1]);
      byPower.set(1, (byPower.get(1) ?? 0) + coeff);
    } else {
      const val = parseFloat(trimmed);
      if (!isNaN(val)) {
        byPower.set(0, (byPower.get(0) ?? 0) + val);
      } else {
        return expr;
      }
    }
  }

  const powers = [...byPower.keys()].sort((a, b) => b - a);
  const parts: string[] = [];
  for (const p of powers) {
    const c = byPower.get(p)!;
    if (c === 0) continue;
    if (p === 0) {
      parts.push(String(c));
    } else if (p === 1) {
      if (c === 1) parts.push(variable);
      else if (c === -1) parts.push('-' + variable);
      else parts.push(c + '*' + variable);
    } else {
      if (c === 1) parts.push(variable + '^' + p);
      else if (c === -1) parts.push('-' + variable + '^' + p);
      else parts.push(c + '*' + variable + '^' + p);
    }
  }

  return parts.join(' + ') || '0';
}

/**
 * Cancel common factors in a numeric rational expression.
 *
 * **Scope:** Currently handles numeric integer fractions `a/b` only,
 * including `(a/b) / (c/d)` and identical numerator/denominator
 * polynomial-string short-circuit (`(p) / (p) → 1`).
 *
 * **Not yet handled:** symbolic polynomial cancellation
 * (e.g., `(x^2-1)/(x-1) → x+1`) — for that, use the lower-level
 * `polynomialGCD` API on explicit coefficient arrays. A future
 * release will add full symbolic cancel via a polynomial string parser.
 *
 * @param expr - Expression string (e.g., "6/4", "(2/3)/(4/9)")
 * @returns Simplified expression
 */
export function cancel(expr: string): string {
  // Trivial identical-string case: (p) / (p) -> 1 for any non-empty p
  const sameMatch = expr.match(/^\s*\(([^()]+)\)\s*\/\s*\(\s*\1\s*\)\s*$/);
  if (sameMatch && sameMatch[1].trim().length > 0) return '1';

  // Plain numeric fraction
  const fracMatch = expr.match(/^\s*(-?\d+)\s*\/\s*(-?\d+)\s*$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1], 10);
    const den = parseInt(fracMatch[2], 10);
    if (den === 0) throw new Error('cancel: division by zero');
    const g = gcdNum(Math.abs(num), Math.abs(den));
    const rn = num / g;
    const rd = den / g;
    if (rd === 1) return String(rn);
    if (rd < 0) return -rn + '/' + -rd;
    return rn + '/' + rd;
  }

  // Compound fraction (a/b) / (c/d) -> (a*d) / (b*c), then cancel
  const compound = expr.match(
    /^\s*\(\s*(-?\d+)\s*\/\s*(-?\d+)\s*\)\s*\/\s*\(\s*(-?\d+)\s*\/\s*(-?\d+)\s*\)\s*$/
  );
  if (compound) {
    const a = parseInt(compound[1], 10);
    const b = parseInt(compound[2], 10);
    const c = parseInt(compound[3], 10);
    const d = parseInt(compound[4], 10);
    if (b === 0 || d === 0 || c === 0) throw new Error('cancel: division by zero');
    return cancel(`${a * d}/${b * c}`);
  }

  return expr;
}

/**
 * Combine fractions to a common denominator.
 *
 * @param expr - Expression string
 * @returns Combined expression
 */
export function together(expr: string): string {
  const match = expr.match(/^\s*(-?\d+)\s*\/\s*(-?\d+)\s*\+\s*(-?\d+)\s*\/\s*(-?\d+)\s*$/);
  if (match) {
    const a = parseInt(match[1], 10);
    const b = parseInt(match[2], 10);
    const c = parseInt(match[3], 10);
    const d = parseInt(match[4], 10);
    const num = a * d + c * b;
    const den = b * d;
    const g = gcdNum(Math.abs(num), Math.abs(den));
    return num / g + '/' + den / g;
  }
  return expr;
}

/**
 * Partial fraction decomposition.
 *
 * @param expr - Expression string
 * @returns Decomposed expression
 */
export function apart(expr: string): string {
  const match = expr.match(/^\s*(-?\d+)\s*\/\s*(-?\d+)\s*$/);
  if (match) {
    const num = parseInt(match[1], 10);
    const den = parseInt(match[2], 10);
    const whole = Math.trunc(num / den);
    const remainder = num - whole * den;
    if (remainder === 0) return String(whole);
    return whole + ' + ' + remainder + '/' + den;
  }
  return expr;
}

/**
 * Expand trigonometric expressions using angle addition formulas.
 *
 * @param expr - Expression string
 * @returns Expanded expression
 */
export function trigExpand(expr: string): string {
  let result = expr;
  result = result.replace(/sin\(2\s*\*?\s*([a-zA-Z_]\w*)\)/g, '2*sin($1)*cos($1)');
  result = result.replace(/cos\(2\s*\*?\s*([a-zA-Z_]\w*)\)/g, 'cos($1)^2 - sin($1)^2');
  result = result.replace(/sin\((\w+)\s*\+\s*(\w+)\)/g, 'sin($1)*cos($2) + cos($1)*sin($2)');
  result = result.replace(/cos\((\w+)\s*\+\s*(\w+)\)/g, 'cos($1)*cos($2) - sin($1)*sin($2)');
  return result;
}

/**
 * Reduce trigonometric expressions using product-to-sum formulas.
 *
 * @param expr - Expression string
 * @returns Reduced expression
 */
export function trigReduce(expr: string): string {
  let result = expr;
  result = result.replace(/sin\((\w+)\)\s*\*\s*cos\(\1\)/g, 'sin(2*$1)/2');
  result = result.replace(/cos\((\w+)\)\s*\*\s*sin\(\1\)/g, 'sin(2*$1)/2');
  result = result.replace(/cos\((\w+)\)\^2\s*-\s*sin\(\1\)\^2/g, 'cos(2*$1)');
  result = result.replace(/sin\((\w+)\)\^2\s*\+\s*cos\(\1\)\^2/g, '1');
  result = result.replace(/cos\((\w+)\)\^2\s*\+\s*sin\(\1\)\^2/g, '1');
  return result;
}

/**
 * Convert trigonometric functions to exponential form using Euler's formula.
 *
 * @param expr - Expression string
 * @returns Expression with trig replaced by exponentials
 */
export function trigToExp(expr: string): string {
  let result = expr;
  result = result.replace(/sin\(([^)]+)\)/g, '(exp(i*$1) - exp(-i*$1))/(2*i)');
  result = result.replace(/cos\(([^)]+)\)/g, '(exp(i*$1) + exp(-i*$1))/2');
  result = result.replace(
    /tan\(([^)]+)\)/g,
    '(exp(i*$1) - exp(-i*$1))/(i*(exp(i*$1) + exp(-i*$1)))'
  );
  return result;
}

/**
 * Convert exponential expressions to trigonometric form.
 *
 * @param expr - Expression string
 * @returns Expression with exponentials replaced by trig
 */
export function expToTrig(expr: string): string {
  let result = expr;
  result = result.replace(/exp\(i\s*\*\s*([^)]+)\)/g, '(cos($1) + i*sin($1))');
  result = result.replace(/exp\(-i\s*\*\s*([^)]+)\)/g, '(cos($1) - i*sin($1))');
  return result;
}

// =============================================================================
// Other (12)
// =============================================================================

/**
 * Compute the tangent line to a function at a given point.
 *
 * @param f - Function to differentiate
 * @param x0 - Point at which to compute tangent
 * @returns Tuple [slope, intercept]
 *
 * @example
 * ```typescript
 * tangentLine(x => x**2, 3); // [6, -9] => y = 6x - 9
 * ```
 */
export function tangentLine(f: (x: number) => number, x0: f64): [f64, f64] {
  const h = 1e-8;
  const slope: f64 = (f(x0 + h) - f(x0 - h)) / (2 * h);
  const y0: f64 = f(x0);
  const intercept: f64 = y0 - slope * x0;
  return [slope, intercept];
}

/**
 * Reduce an expression to its simplest form.
 *
 * @param expr - Expression string
 * @returns Reduced expression
 */
export function reduce(expr: string): string {
  const trimmed = expr.trim();
  try {
    if (/^[\d\s+\-*/().^]+$/.test(trimmed)) {
      const jsExpr = trimmed.replace(/\^/g, '**');
      const result = Function('"use strict"; return (' + jsExpr + ')')();
      if (typeof result === 'number' && isFinite(result)) {
        return String(result);
      }
    }
  } catch {
    // Fall through
  }
  return trimmed;
}

/**
 * Combine two expressions by addition.
 *
 * @param a - First expression
 * @param b - Second expression
 * @returns Combined expression string
 */
export function combine(a: string, b: string): string {
  return a.trim() + ' + ' + b.trim();
}

/**
 * Expand complex-valued expressions using i^2 = -1.
 *
 * @param expr - Expression string
 * @returns Expanded expression
 */
export function complexExpand(expr: string): string {
  let result = expr;
  result = result.replace(/i\^2/g, '(-1)');
  result = result.replace(/i\s*\*\s*i/g, '(-1)');
  return result;
}

/**
 * Convert expression to a canonical normal form.
 *
 * @param expr - Expression string
 * @returns Normal form expression
 */
export function normalForm(expr: string): string {
  const terms = expr
    .split(/\s*\+\s*/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  terms.sort();
  return terms.join(' + ') || '0';
}

/**
 * Expand powers in an expression.
 *
 * @param expr - Expression string
 * @returns Expanded expression
 */
export function powerExpand(expr: string): string {
  let result = expr;
  result = result.replace(/\((\w+)\s*\*\s*(\w+)\)\^(\d+)/g, '$1^$3 * $2^$3');
  result = result.replace(
    /\((\w+)\^(\d+)\)\^(\d+)/g,
    (_: string, base: string, m: string, n: string) => base + '^' + parseInt(m) * parseInt(n)
  );
  return result;
}

/**
 * Full simplification -- more aggressive than basic simplify.
 *
 * @param expr - Expression string
 * @returns Fully simplified expression
 */
export function fullSimplify(expr: string): string {
  let result = expr.trim();

  // Remove multiplication by 1
  result = result.replace(/\b1\s*\*\s*/g, '');
  result = result.replace(/\s*\*\s*1\b/g, '');

  // Remove addition of 0
  result = result.replace(/\b0\s*\+\s*/g, '');
  result = result.replace(/\s*\+\s*0\b/g, '');

  // x^0 => 1
  result = result.replace(/\w+\^0\b/g, '1');

  // x^1 => x
  result = result.replace(/(\w+)\^1\b/g, '$1');

  // 0*anything => 0
  result = result.replace(/\b0\s*\*\s*[^+-]*/g, '0');

  // Try numeric reduction
  result = reduce(result);

  return result;
}

/**
 * Extract an element from an array at the specified index.
 *
 * @param arr - Input array
 * @param index - Zero-based index
 * @returns The element at the given index
 */
export function element<T>(arr: T[], index: number): T {
  if (index < 0 || index >= arr.length) {
    throw new Error('Index ' + index + ' out of bounds for array of length ' + arr.length);
  }
  return arr[index];
}

/**
 * Eliminate a variable from a system of polynomial equations (`"lhs = rhs"`
 * strings) by computing the ELIMINATION IDEAL: a lex Gröbner basis with the
 * eliminated variable ordered first, keeping the basis elements free of it.
 * Returns the surviving relations as `"<poly> = 0"` strings.
 *
 * B-5: the former implementation returned decorative strings
 * (`"(A) - (B) [x eliminated]"`) — not equations — and echoed non-equation
 * input unchanged. It now performs real elimination and throws on input it
 * cannot parse as polynomial equations.
 *
 * @param system - Array of equation strings (`"lhs = rhs"` — the `=` is required)
 * @param variable - Variable to eliminate
 * @returns The eliminated system as `"<poly> = 0"` strings
 */
export function eliminate(system: string[], variable: string): string[] {
  // Discover the variable set from the equations themselves (AST symbols).
  const symbols = new Set<string>();
  const polysSrc: string[] = [];
  for (const eq of system) {
    const parts = eq.split('=');
    if (parts.length !== 2) {
      throw new Error(`eliminate: '${eq}' is not an equation (expected exactly one '=')`);
    }
    const polySrc = `(${parts[0]}) - (${parts[1]})`;
    polysSrc.push(polySrc);
    for (const m of polySrc.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) symbols.add(m[0]);
  }
  if (!symbols.has(variable)) {
    // Nothing to eliminate — the system is already free of the variable.
    return polysSrc.map((s) => `${s} = 0`);
  }
  // Lex order with the eliminated variable FIRST (most significant), so the
  // basis elements whose leading terms avoid it form the elimination ideal.
  const vars = [variable, ...[...symbols].filter((s) => s !== variable).sort()];
  const parsed = polysSrc.map((s) => polyFromExpression(s, vars));
  const basis = buchberger(parsed);
  const survived = basis.filter((b) => b.every((t) => t.powers[0] === 0));
  if (survived.length === 0) {
    throw new Error(
      `eliminate: no relations survive eliminating '${variable}' (system may be underdetermined)`
    );
  }
  return survived.map((b) => `${idealPolyToString(b, vars)} = 0`);
}

/**
 * Compute a partial derivative of an expression string with respect
 * to a variable using basic symbolic differentiation rules.
 *
 * @param expr - Expression string
 * @param variable - Variable to differentiate with respect to
 * @returns Derivative expression string
 */
export function symbolicPartialDerivative(expr: string, variable: string): string {
  const terms = expr.split(/\s*\+\s*/);
  const derivedTerms: string[] = [];

  for (const term of terms) {
    const t = term.trim();

    if (!t.includes(variable)) {
      derivedTerms.push('0');
      continue;
    }

    // c*var^n pattern
    const powerRe = new RegExp('^(-?\\d*\\.?\\d*)\\s*\\*?\\s*' + variable + '\\^(\\d+)$');
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

    // c*var pattern (linear)
    const linearRe = new RegExp('^(-?\\d*\\.?\\d*)\\s*\\*?\\s*' + variable + '$');
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

/**
 * Expand special function expressions.
 *
 * @param expr - Expression string
 * @returns Expanded expression
 */
export function functionExpand(expr: string): string {
  let result = expr;
  result = result.replace(/exp\((\w+)\s*\+\s*(\w+)\)/g, 'exp($1)*exp($2)');
  result = result.replace(/ln\((\w+)\s*\*\s*(\w+)\)/g, 'ln($1) + ln($2)');
  result = result.replace(/ln\((\w+)\s*\/\s*(\w+)\)/g, 'ln($1) - ln($2)');
  result = result.replace(/ln\((\w+)\^(\d+)\)/g, '$2*ln($1)');
  return result;
}

/**
 * Compute the resultant of two polynomials.
 * The resultant is the determinant of the Sylvester matrix.
 *
 * @param p - First polynomial coefficients (index = power)
 * @param q - Second polynomial coefficients (index = power)
 * @returns Resultant value
 */
export function resultant(p: number[], q: number[]): f64 {
  const pt = trimPoly(p);
  const qt = trimPoly(q);
  const m = pt.length - 1;
  const n = qt.length - 1;

  if (m === 0 && n === 0) return 1;
  if (m === 0) return Math.pow(pt[0], n);
  if (n === 0) return Math.pow(qt[0], m);

  // WASM fast path for large inputs.
  if (pt.length >= WASM_POLY_THRESHOLD || qt.length >= WASM_POLY_THRESHOLD) {
    return resultantDispatch(new Float64Array(pt), new Float64Array(qt));
  }

  // Build Sylvester matrix (n+m) x (n+m)
  const size = m + n;
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= m; j++) {
      matrix[i][i + j] = pt[m - j];
    }
  }

  for (let i = 0; i < m; i++) {
    for (let j = 0; j <= n; j++) {
      matrix[n + i][i + j] = qt[n - j];
    }
  }

  return determinant(matrix);
}

// =============================================================================
// Combined Export
// =============================================================================

/**
 * All algebra functions combined.
 */
export const typedAlgebra = {
  // Polynomial Operations
  polyval,
  polyadd,
  polymul,
  polyder,
  polynomialGCD,
  polynomialLCM,
  polynomialQuotient,
  polynomialRemainder,
  degree,
  coefficientList,
  discriminant,
  differences,

  // Expression Manipulation
  expand,
  factor,
  collect,
  substitute,
  variables,
  cancel,
  together,
  apart,
  trigExpand,
  trigReduce,
  trigToExp,
  expToTrig,

  // Other
  tangentLine,
  reduce,
  combine,
  complexExpand,
  normalForm,
  powerExpand,
  fullSimplify,
  element,
  eliminate,
  symbolicPartialDerivative,
  functionExpand,
  resultant,
};
