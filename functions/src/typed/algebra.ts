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
  type Poly,
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

// =============================================================================
// Univariate polynomial/rational CAS engine (Phase 8 Task 6)
// =============================================================================
//
// `expand`/`factor`/`together`/`apart` below were originally flat regex
// patterns (multi-variable distribution, integer-GCD factoring, numeric-only
// fractions) — real transforms for a few narrow shapes, pass-through
// otherwise. For the univariate case — a polynomial or rational function in
// exactly one variable — each of these four now routes through EXACT
// polynomial arithmetic first: `polyFromExpression`/`polyToString` (from
// `polynomial-ideal.ts`) parse/format the polynomial, and the dense
// coefficient-array helpers above (`polynomialQuotient`, `polynomialRemainder`,
// `polyder`, `degree`) drive division and root-finding. When the univariate
// path cannot handle the input (more than one variable, non-integer
// coefficients, a function call, a denominator that doesn't factor into
// distinct rational linear factors, a repeated root, ...) it throws and the
// caller falls back to the legacy implementation, so the pre-existing
// (multivariate / purely-numeric) behavior is unchanged.

/** True when `c` is within floating-point noise of an integer. */
function isNearInt(c: number): boolean {
  return Math.abs(c - Math.round(c)) < 1e-7;
}

/** Convert a single-variable `Poly` (from `polynomial-ideal.ts`) to a dense,
 *  ascending coefficient array (index = power) — this file's `number[]`
 *  polynomial convention. */
function polyToDense(p: Poly): number[] {
  let maxPow = 0;
  for (const t of p) maxPow = Math.max(maxPow, t.powers[0] ?? 0);
  const dense = new Array<number>(maxPow + 1).fill(0);
  for (const t of p) dense[t.powers[0]] += t.coeff;
  return trimPoly(dense);
}

/** Convert a dense ascending coefficient array back to a single-variable `Poly`. */
function denseToPoly(coeffs: number[]): Poly {
  return coeffs
    .map((coeff, i) => ({ coeff, powers: [i] }))
    .filter((t) => Math.abs(t.coeff) > 1e-10);
}

/** Positive divisors of `round(|n|)` (always includes 1). */
function divisorsOf(n: number): number[] {
  const m = Math.abs(Math.round(n)) || 1;
  const divs: number[] = [];
  for (let i = 1; i <= m; i++) if (m % i === 0) divs.push(i);
  return divs;
}

/** A rational number `n/d`, always stored reduced with `d > 0`. */
interface Rat {
  n: number;
  d: number;
}

function ratReduce(r: Rat): Rat {
  let { n, d } = r;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcdNum(Math.abs(n), Math.abs(d)) || 1;
  return { n: n / g, d: d / g };
}

/** Evaluate an integer-coefficient dense polynomial at a rational point, exactly (Horner). */
function ratPolyval(coeffs: number[], r: Rat): Rat {
  let acc: Rat = { n: 0, d: 1 };
  for (let i = coeffs.length - 1; i >= 0; i--) {
    acc = ratReduce({
      n: acc.n * r.n + coeffs[i] * acc.d * r.d,
      d: acc.d * r.d,
    });
  }
  return acc;
}

interface RationalRootResult {
  /** Rational roots found (with multiplicity — a repeated root appears twice). */
  roots: Rat[];
  /** What remains after dividing out every found linear factor. */
  remainder: number[];
  /** True if any root was found more than once (a repeated/multiple root). */
  repeated: boolean;
}

/**
 * Find every rational root of an integer-coefficient univariate polynomial
 * (rational-root theorem), dividing each one out of `poly` as it's found.
 *
 * @param poly - Dense ascending integer coefficients
 * @returns The roots found (in discovery order), the leftover polynomial,
 *   and whether any root repeated — `factor`/`apart` treat a repeated root
 *   as out of scope (they don't express it as a power / higher-order pole).
 */
function findRationalLinearFactors(poly: number[]): RationalRootResult {
  let cur = trimPoly(poly.map((c) => Math.round(c)));
  const roots: Rat[] = [];
  let repeated = false;
  const hasRoot = (r: Rat): boolean => roots.some((x) => x.n === r.n && x.d === r.d);

  for (;;) {
    const deg = cur.length - 1;
    if (deg < 1) break;

    if (cur[0] === 0) {
      const r: Rat = { n: 0, d: 1 };
      if (hasRoot(r)) repeated = true;
      roots.push(r);
      cur = trimPoly(cur.slice(1));
      continue;
    }

    const ps = divisorsOf(cur[0]);
    const qs = divisorsOf(cur[cur.length - 1]);

    let found: Rat | null = null;
    let quotient: number[] | null = null;
    outer: for (const q of qs) {
      for (const pAbs of ps) {
        for (const sign of [1, -1]) {
          const candidate = ratReduce({ n: sign * pAbs, d: q });
          const divisor = trimPoly([-candidate.n, candidate.d]);
          const rem = polynomialRemainder(cur, divisor);
          if (rem.length === 1 && Math.abs(rem[0]) < 1e-6) {
            found = candidate;
            quotient = polynomialQuotient(cur, divisor).map((c) => Math.round(c * 1e6) / 1e6);
            break outer;
          }
        }
      }
    }

    if (!found || !quotient) break;
    if (hasRoot(found)) repeated = true;
    roots.push(found);
    cur = trimPoly(quotient);
  }

  return { roots, remainder: cur, repeated };
}

/** Format a rational root as a linear factor: `(x - 1)`, `(2*x + 1)`, `(x)`, ... */
function formatLinearFactor(r: Rat, varName: string): string {
  const base = r.d === 1 ? varName : `${r.d}*${varName}`;
  if (r.n === 0) return `(${base})`;
  return r.n > 0 ? `(${base} - ${r.n})` : `(${base} + ${-r.n})`;
}

/** Format a single partial-fraction term `A/(x - r)` for a simple pole. */
function formatPartialTerm(a: Rat, root: Rat, varName: string): string {
  const rootExpr =
    root.d === 1
      ? root.n === 0
        ? varName
        : root.n > 0
          ? `${varName} - ${root.n}`
          : `${varName} + ${-root.n}`
      : `${varName} - ${root.n}/${root.d}`;
  const denomExpr = a.d === 1 ? `(${rootExpr})` : `(${a.d}*(${rootExpr}))`;
  if (a.n === 1) return `1/${denomExpr}`;
  if (a.n === -1) return `-1/${denomExpr}`;
  return `${a.n}/${denomExpr}`;
}

/**
 * Split an expression into its top-level additive terms (respecting
 * parenthesis depth), each retaining its leading sign.
 *
 * @example splitTopLevelSum('1/x+1/(x+1)') // ['1/x', '+1/(x+1)']
 */
function splitTopLevelSum(expr: string): string[] {
  const s = expr.replace(/\s+/g, '');
  const terms: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && (c === '+' || c === '-') && i > start) {
      const prev = s[i - 1];
      if (!/[*/^(+-]/.test(prev)) {
        terms.push(s.slice(start, i));
        start = i;
      }
    }
  }
  terms.push(s.slice(start));
  return terms.filter((t) => t !== '');
}

/**
 * Split a single additive term into its multiplicative numerator/denominator
 * factors (respecting parenthesis depth):
 * `1/(x+1)` → `{ nums: ['1'], dens: ['(x+1)'] }`.
 */
function splitProductChain(term: string): { nums: string[]; dens: string[] } {
  const nums: string[] = [];
  const dens: string[] = [];
  let depth = 0;
  let start = 0;
  let op: '*' | '/' = '*';
  for (let i = 0; i <= term.length; i++) {
    const c = term[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (depth === 0 && (c === '*' || c === '/' || i === term.length)) {
      const piece = term.slice(start, i).trim();
      if (piece !== '') (op === '*' ? nums : dens).push(piece);
      if (i < term.length) op = c as '*' | '/';
      start = i + 1;
    }
  }
  return { nums, dens };
}

/**
 * Expand an expression string by distributing multiplication over addition.
 *
 * **Univariate polynomials** (a single variable, integer/no non-integer
 * powers, no function calls) are expanded EXACTLY via `polyFromExpression` +
 * `polyToString`: `expand('(x+1)^3')` → `'1*x^3 + 3*x^2 + 3*x + 1'`.
 *
 * Everything else (multiple variables, non-polynomial pieces) falls back to
 * the original regex-based distributor below.
 *
 * @param expr - Expression string
 * @returns Expanded expression string
 *
 * @example
 * ```typescript
 * expand('(a+b)*(c+d)'); // 'a*c + a*d + b*c + b*d'
 * expand('(x+1)^3');     // '1*x^3 + 3*x^2 + 3*x + 1'
 * ```
 */
export function expand(expr: string): string {
  const univariateVars = variables(expr);
  if (univariateVars.length === 1) {
    try {
      return idealPolyToString(polyFromExpression(expr, univariateVars), univariateVars);
    } catch {
      // Not a pure single-variable polynomial (function call, non-integer
      // exponent, division by a non-constant, ...) — fall back below.
    }
  }

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
 *
 * **Univariate polynomials** (a single variable, integer coefficients,
 * degree ≥ 2) are factored over ℚ via the rational-root theorem: candidate
 * roots ±(divisors of the constant term)/(divisors of the leading
 * coefficient) are tested, each confirmed root's linear factor is divided
 * out exactly, and any irreducible remainder is left as-is:
 * `factor('x^2-1')` → `'(x - 1)*(x + 1)'`.
 *
 * Everything else (multiple variables, no rational root) falls back to the
 * original common-integer-factor extraction below.
 *
 * @param expr - Expression string
 * @returns Factored expression string
 */
export function factor(expr: string): string {
  const univariateVars = variables(expr);
  if (univariateVars.length === 1) {
    try {
      const v = univariateVars[0];
      const dense = polyToDense(polyFromExpression(expr, [v]));
      if (degree(dense) >= 2 && dense.every(isNearInt)) {
        const intDense = dense.map((c) => Math.round(c));
        const { roots, remainder } = findRationalLinearFactors(intDense);
        if (roots.length > 0) {
          const factors = roots.map((r) => formatLinearFactor(r, v));
          if (degree(remainder) >= 1) {
            factors.push(`(${idealPolyToString(denseToPoly(remainder), [v])})`);
          } else if (remainder[0] !== 1) {
            factors.unshift(String(remainder[0]));
          }
          return factors.join('*');
        }
      }
    } catch {
      // Not a pure single-variable integer polynomial, or no rational root
      // exists — fall back to the legacy GCD-based factoring below.
    }
  }

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
 * Cancel common factors in a rational expression.
 *
 * **Univariate integer-coefficient rationals** (a single variable, e.g.
 * `(x^2-1)/(x-1)`) are cancelled EXACTLY via polynomial GCD: the numerator
 * and denominator are divided by `polynomialGCD(N, D)`, and any shared
 * integer content between the resulting numerator/denominator is cancelled
 * too (e.g. `(2*x^2-2)/(2*x-2) → x + 1`). When the GCD fully divides out the
 * denominator, the result collapses to a bare polynomial (no `/`); when a
 * nontrivial denominator remains, the result stays a (lower-degree)
 * fraction: `(x^3-1)/(x^2-1) → (x^2+x+1)/(x+1)`. This matches `sympy.cancel`.
 *
 * **Falls back** to the legacy numeric-only handling below for: purely
 * numeric fractions `a/b` (including compound `(a/b)/(c/d)`), the identical
 * numerator/denominator polynomial-string short-circuit (`(p) / (p) → 1`),
 * multivariate expressions, non-integer coefficients, and expressions whose
 * numerator/denominator share no non-trivial polynomial factor (returned
 * unchanged in that case).
 *
 * @param expr - Expression string (e.g., "6/4", "(2/3)/(4/9)", "(x^2-1)/(x-1)")
 * @returns Simplified expression
 */
export function cancel(expr: string): string {
  // Trivial identical-string case: (p) / (p) -> 1 for any non-empty p
  const sameMatch = expr.match(/^\s*\(([^()]+)\)\s*\/\s*\(\s*\1\s*\)\s*$/);
  if (sameMatch && sameMatch[1].trim().length > 0) return '1';

  // Univariate symbolic rational cancellation via polynomial GCD.
  const univariateVars = variables(expr);
  if (univariateVars.length === 1) {
    try {
      const v = univariateVars[0];
      const cleaned = expr.replace(/\s+/g, '');
      const topTerms = splitTopLevelSum(cleaned);
      if (topTerms.length === 1) {
        const { nums, dens } = splitProductChain(topTerms[0]);
        if (dens.length > 0) {
          const numStr = nums.length ? nums.join('*') : '1';
          const denStr = dens.join('*');
          const N = polyToDense(polyFromExpression(numStr, [v]));
          const D = polyToDense(polyFromExpression(denStr, [v]));
          if (N.every(isNearInt) && D.every(isNearInt)) {
            const Nint = N.map((c) => Math.round(c));
            const Dint = D.map((c) => Math.round(c));
            const g = polynomialGCD(Nint, Dint);

            if (degree(g) >= 1) {
              let Nq = polynomialQuotient(Nint, g).map((c) => Math.round(c * 1e6) / 1e6);
              let Dq = polynomialQuotient(Dint, g).map((c) => Math.round(c * 1e6) / 1e6);

              // Cancel any integer content shared by both the resulting
              // numerator and denominator, e.g. (2x^2-2)/(2x-2) -> x+1.
              let contentGcd = 0;
              for (const c of [...Nq, ...Dq]) contentGcd = gcdNum(contentGcd, Math.round(c));
              if (contentGcd > 1) {
                Nq = Nq.map((c) => c / contentGcd);
                Dq = Dq.map((c) => c / contentGcd);
              }

              // Normalize sign so the denominator's leading coefficient is positive.
              if (Dq[Dq.length - 1] < 0) {
                Nq = Nq.map((c) => -c);
                Dq = Dq.map((c) => -c);
              }

              if (degree(Dq) === 0) {
                const c = Dq[0];
                if (c !== 1) Nq = Nq.map((x) => x / c);
                return idealPolyToString(denseToPoly(Nq), [v]);
              }
              return `(${idealPolyToString(denseToPoly(Nq), [v])})/(${idealPolyToString(denseToPoly(Dq), [v])})`;
            }
          }
        }
      }
    } catch {
      // Not a pure single-variable integer-coefficient rational, or the
      // numerator/denominator share no non-trivial polynomial factor —
      // fall through to the numeric-only paths below (or the unchanged
      // return at the end).
    }
  }

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
 * Combine a sum of rational terms into a single fraction over a common
 * (not necessarily lowest) denominator.
 *
 * **Univariate rationals** (a single variable, e.g. `1/x + 1/(x+1)`) are
 * combined EXACTLY: the common denominator is the product of every term's
 * denominator, and the numerator is the exact polynomial sum
 * `Σ numᵢ · Π_{j≠i} denⱼ`, simplified via `polyFromExpression`/`polyToString`:
 * `together('1/x + 1/(x+1)')` → `'(2*x + 1)/((x)*((x+1)))'`.
 *
 * Everything else (no variable, i.e. purely numeric) falls back to the
 * original numeric-fraction addition below.
 *
 * @param expr - Expression string
 * @returns Combined expression
 */
export function together(expr: string): string {
  const univariateVars = variables(expr);
  if (univariateVars.length === 1) {
    try {
      const v = univariateVars[0];
      const terms = splitTopLevelSum(expr).map(splitProductChain);
      const denParts = terms.flatMap((t) => t.dens);
      if (denParts.length > 0) {
        const denominatorStr = denParts.map((d) => `(${d})`).join('*');
        const numeratorExpr = terms
          .map((t, i) => {
            const otherDens = terms.flatMap((t2, j) => (j === i ? [] : t2.dens));
            const parts = [...t.nums, ...otherDens].map((p) => `(${p})`);
            return parts.length ? parts.join('*') : '1';
          })
          .join(' + ');
        const numeratorStr = idealPolyToString(polyFromExpression(numeratorExpr, [v]), [v]);
        return `(${numeratorStr})/(${denominatorStr})`;
      }
    } catch {
      // Not a pure single-variable rational expression — fall back to the
      // legacy numeric-only path below.
    }
  }

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
 * **Univariate rationals with a fully-factorable denominator** (distinct
 * rational roots only — repeated roots are out of scope) are decomposed via
 * the cover-up/residue method: `apart('1/(x^2-1)')` →
 * `'1/(2*(x - 1)) - 1/(2*(x + 1))'`. An improper fraction (numerator degree ≥
 * denominator degree) is first split into a polynomial quotient + proper
 * remainder via `polynomialQuotient`/`polynomialRemainder`.
 *
 * Everything else (no variable — i.e. purely numeric — multiple variables,
 * or a denominator that doesn't factor into distinct rational linear
 * factors) falls back to the original numeric-only path below.
 *
 * @param expr - Expression string
 * @returns Decomposed expression
 */
export function apart(expr: string): string {
  const univariateVars = variables(expr);
  if (univariateVars.length === 1) {
    try {
      const v = univariateVars[0];
      const topTerms = splitTopLevelSum(expr);
      if (topTerms.length === 1) {
        const { nums, dens } = splitProductChain(topTerms[0]);
        if (dens.length > 0) {
          const numStr = nums.length ? nums.join('*') : '1';
          const denStr = dens.join('*');
          const N = polyToDense(polyFromExpression(numStr, [v]));
          const D = polyToDense(polyFromExpression(denStr, [v]));
          if (degree(D) >= 1 && N.every(isNearInt) && D.every(isNearInt)) {
            let Nint = N.map((c) => Math.round(c));
            const Dint = D.map((c) => Math.round(c));

            let quotientPrefix = '';
            if (degree(Nint) >= degree(Dint)) {
              const q = polynomialQuotient(Nint, Dint);
              const r = polynomialRemainder(Nint, Dint);
              if (degree(r) === 0 && r[0] === 0) {
                return idealPolyToString(denseToPoly(q), [v]);
              }
              quotientPrefix = `${idealPolyToString(denseToPoly(q), [v])} + `;
              Nint = r.map((c) => Math.round(c));
            }

            const { roots, remainder, repeated } = findRationalLinearFactors(Dint);
            if (!repeated && degree(remainder) === 0 && roots.length === degree(Dint)) {
              const Dprime = polyder(Dint);
              const termStrs = roots.map((root) => {
                const nAtRoot = ratPolyval(Nint, root);
                const dAtRoot = ratPolyval(Dprime, root);
                if (dAtRoot.n === 0) throw new Error('apart: derivative vanished at root');
                const a = ratReduce({
                  n: nAtRoot.n * dAtRoot.d,
                  d: nAtRoot.d * dAtRoot.n,
                });
                return formatPartialTerm(a, root, v);
              });
              return (quotientPrefix + termStrs.join(' + ')).replace(/\+ -/g, '- ');
            }
          }
        }
      }
    } catch {
      // Not a pure single-variable rational expression, or the denominator
      // doesn't factor into distinct rational linear factors — fall back to
      // the legacy numeric-only path below.
    }
  }

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
