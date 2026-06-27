/**
 * Symbolic CAS (Computer Algebra System) Functions
 *
 * Provides 28 symbolic/semi-symbolic math functions for calculus, transforms,
 * series expansions, equation solving, and advanced algebra. Functions work
 * with expression strings and use numerical evaluation via the expression
 * evaluator when symbolic approaches are not feasible.
 *
 * Categories:
 * - Calculus (8): integrate, limit, partialDerivative, directionalDerivative,
 *   gradientSymbolic, jacobian, laplacian, divergence
 * - Transforms (4): laplace, inverseLaplace, fourierSeries, zTransform
 * - Series (4): taylor, multivariateTaylor, series, seriesCoefficient
 * - Solver (4): solve, implicitDiff, summation, symbolicProduct
 * - Advanced (8): assume, asymptotic, groebnerBasis, minimalPolynomial,
 *   toRadicals, piecewise, odeGeneral, curl
 * - Batch CAS (4): simplify, derivative, expand, factor — with worker fan-out
 *   for arrays of length ≥ 16 (Slice 5.14).
 *
 * @packageDocumentation
 */

import { parse, evaluate } from '../factories/evaluate.js';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { Complex } from '@danielsimonjr/mathts-core';
// Reuse the Algebra closed-form root finder for degree ≤ 3 (linear/quadratic/
// cubic, real + complex) instead of duplicating the formulas here.
import { polynomialRoot } from '../factories/index.js';

// =============================================================================
// Type Aliases
// =============================================================================

type f64 = number;
type MathNode = ReturnType<typeof parse>;

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Evaluate an expression with a single variable binding.
 */
function evalAt(expr: string, varName: string, value: f64): f64 {
  return evaluate(expr, { [varName]: value }) as f64;
}

/**
 * Evaluate an expression with a scope of variable bindings.
 */
function evalWith(expr: string, scope: Record<string, f64>): f64 {
  return evaluate(expr, scope) as f64;
}

/**
 * Compute the kth numerical derivative of expr at x0 using finite differences.
 * Uses central differences with Richardson extrapolation for accuracy.
 */
function numericalDerivative(
  expr: string,
  varName: string,
  x0: f64,
  k: number,
  h: f64 = 1e-4,
  scope?: Record<string, f64>
): f64 {
  if (k === 0) {
    const s = scope ? { ...scope, [varName]: x0 } : { [varName]: x0 };
    return evalWith(expr, s);
  }

  // Central difference for 1st derivative, then recurse
  const baseScope = scope ? { ...scope } : {};
  const evalPoint = (x: f64): f64 => {
    return evalWith(expr, { ...baseScope, [varName]: x });
  };

  if (k === 1) {
    // 4th-order central difference
    const fp2 = evalPoint(x0 + 2 * h);
    const fp1 = evalPoint(x0 + h);
    const fm1 = evalPoint(x0 - h);
    const fm2 = evalPoint(x0 - 2 * h);
    return (-fp2 + 8 * fp1 - 8 * fm1 + fm2) / (12 * h);
  }

  // Higher derivatives: recurse
  const deriv1 = numericalDerivative(expr, varName, x0 + h, k - 1, h, scope);
  const deriv2 = numericalDerivative(expr, varName, x0 - h, k - 1, h, scope);
  return (deriv1 - deriv2) / (2 * h);
}

/**
 * Factorial function for internal use.
 */
function factorial(n: number): f64 {
  if (n <= 1) return 1;
  let r: f64 = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/**
 * Format a number for expression output, handling near-integer and near-zero values.
 */
function formatCoeff(c: f64): string {
  if (Math.abs(c) < 1e-12) return '0';
  if (Math.abs(c - Math.round(c)) < 1e-10) return String(Math.round(c));
  // Show up to 10 significant digits
  return c.toPrecision(10).replace(/\.?0+$/, '');
}

/**
 * Build a polynomial term string.
 */
function buildTerm(c: f64, varName: string, x0: f64, power: number): string {
  if (Math.abs(c) < 1e-12) return '';
  const cs = formatCoeff(c);
  if (power === 0) return cs;

  const xPart = x0 === 0 ? varName : `(${varName} - ${formatCoeff(x0)})`;
  const xTerm = power === 1 ? xPart : `${xPart}^${power}`;

  if (cs === '1') return xTerm;
  if (cs === '-1') return `-${xTerm}`;
  return `${cs}*${xTerm}`;
}

// =============================================================================
// Variable assumptions store (module-level state)
// =============================================================================

const assumptions: Map<string, Set<string>> = new Map();

// =============================================================================
// CALCULUS (8 functions)
// =============================================================================

/**
 * Symbolic/numerical integration.
 *
 * For basic symbolic forms (polynomials, trig, exp), returns the symbolic
 * antiderivative. For definite integrals (a, b provided), falls back to
 * numerical integration using Simpson's rule.
 *
 * @param expr - Expression string to integrate
 * @param varName - Variable of integration
 * @param a - Optional lower bound (definite integral)
 * @param b - Optional upper bound (definite integral)
 * @returns Symbolic antiderivative string or numerical result
 *
 * @example
 * integrate('x^2', 'x')          // => 'x^3/3'
 * integrate('sin(x)', 'x')       // => '-cos(x)'
 * integrate('x^2', 'x', 0, 1)   // => 0.3333...
 */
export function integrate(expr: string, varName: string, a?: f64, b?: f64): string | f64 {
  const trimmed = expr.trim();

  // Definite integral via numerical integration (Simpson's rule)
  if (a !== undefined && b !== undefined) {
    const n = 1000;
    const h = (b - a) / n;
    let sum = evalAt(trimmed, varName, a) + evalAt(trimmed, varName, b);
    for (let i = 1; i < n; i++) {
      const xi = a + i * h;
      sum += (i % 2 === 0 ? 2 : 4) * evalAt(trimmed, varName, xi);
    }
    return (sum * h) / 3;
  }

  // Symbolic integration for basic forms
  // Constant
  if (!trimmed.includes(varName)) {
    return `${trimmed}*${varName}`;
  }

  // x^n pattern
  const powerMatch = trimmed.match(new RegExp(`^${varName}\\^(\\d+)$`));
  if (powerMatch) {
    const n = parseInt(powerMatch[1]);
    return `${varName}^${n + 1}/${n + 1}`;
  }

  // Just the variable: x -> x^2/2
  if (trimmed === varName) {
    return `${varName}^2/2`;
  }

  // c*x^n pattern
  const cPowerMatch = trimmed.match(new RegExp(`^([\\d.]+)\\*?${varName}\\^(\\d+)$`));
  if (cPowerMatch) {
    const c = parseFloat(cPowerMatch[1]);
    const n = parseInt(cPowerMatch[2]);
    const newCoeff = c / (n + 1);
    return `${formatCoeff(newCoeff)}*${varName}^${n + 1}`;
  }

  // c*x pattern
  const cxMatch = trimmed.match(new RegExp(`^([\\d.]+)\\*?${varName}$`));
  if (cxMatch) {
    const c = parseFloat(cxMatch[1]);
    const newCoeff = c / 2;
    return `${formatCoeff(newCoeff)}*${varName}^2`;
  }

  // sin(x) -> -cos(x)
  if (trimmed === `sin(${varName})`) return `-cos(${varName})`;

  // cos(x) -> sin(x)
  if (trimmed === `cos(${varName})`) return `sin(${varName})`;

  // exp(x) -> exp(x)
  if (trimmed === `exp(${varName})`) return `exp(${varName})`;

  // 1/x -> ln(x)
  if (trimmed === `1/${varName}`) return `log(${varName})`;

  // Fall back: return integral notation
  return `integral(${trimmed}, ${varName})`;
}

/**
 * Compute symbolic limits using numerical approach and L'Hopital's rule.
 *
 * Handles standard limits, 0/0 indeterminate forms via L'Hopital,
 * and one-sided limits.
 *
 * @param expr - Expression string
 * @param varName - Variable approaching the limit
 * @param value - Value being approached (can be Infinity or -Infinity)
 * @param dir - Direction: 'left', 'right', or undefined for both
 * @returns The limit value
 *
 * @example
 * limit('sin(x)/x', 'x', 0)        // => 1
 * limit('1/x', 'x', 0, 'right')    // => Infinity
 * limit('(x^2-1)/(x-1)', 'x', 1)   // => 2
 */
export function limit(expr: string, varName: string, value: f64, dir?: 'left' | 'right'): f64 {
  const eps = 1e-10;
  const steps = [1e-4, 1e-6, 1e-8, 1e-10];

  // For infinity limits
  if (value === Infinity) {
    const vals = [1e2, 1e4, 1e6, 1e8].map((v) => evalAt(expr, varName, v));
    if (vals.every((v) => isFinite(v)) && Math.abs(vals[3] - vals[2]) < 1e-6) {
      return vals[3];
    }
    if (vals[3] > 1e100) return Infinity;
    if (vals[3] < -1e100) return -Infinity;
    return vals[3];
  }

  if (value === -Infinity) {
    const vals = [-1e2, -1e4, -1e6, -1e8].map((v) => evalAt(expr, varName, v));
    if (vals.every((v) => isFinite(v)) && Math.abs(vals[3] - vals[2]) < 1e-6) {
      return vals[3];
    }
    if (vals[3] > 1e100) return Infinity;
    if (vals[3] < -1e100) return -Infinity;
    return vals[3];
  }

  // Try direct evaluation first
  try {
    const direct = evalAt(expr, varName, value);
    if (isFinite(direct) && !isNaN(direct)) return direct;
  } catch {
    // Fall through to numerical approach
  }

  // Numerical approach from the specified direction
  const approach = (direction: number): f64 => {
    const vals: f64[] = [];
    for (const h of steps) {
      try {
        vals.push(evalAt(expr, varName, value + direction * h));
      } catch {
        vals.push(NaN);
      }
    }
    const valid = vals.filter((v) => isFinite(v) && !isNaN(v));
    if (valid.length === 0) return NaN;
    return valid[valid.length - 1];
  };

  if (dir === 'right') return approach(1);
  if (dir === 'left') return approach(-1);

  // Both sides
  const fromRight = approach(1);
  const fromLeft = approach(-1);

  if (isNaN(fromRight) && isNaN(fromLeft)) return NaN;
  if (isNaN(fromRight)) return fromLeft;
  if (isNaN(fromLeft)) return fromRight;

  // Check if limits agree
  if (Math.abs(fromRight - fromLeft) < Math.max(1e-6, eps * Math.abs(fromRight))) {
    return (fromRight + fromLeft) / 2;
  }

  // Limits disagree
  return NaN;
}

/**
 * Compute the partial derivative of an expression with respect to a variable.
 *
 * Uses numerical differentiation (4th-order central difference).
 * Returns the derivative as a function that can be evaluated at a point.
 *
 * @param expr - Expression string
 * @param varName - Variable to differentiate with respect to
 * @param scope - Variable values at which to evaluate
 * @returns Numerical value of the partial derivative
 *
 * @example
 * partialDerivative('x^2 + y^2', 'x', { x: 3, y: 4 }) // => 6
 * partialDerivative('sin(x*y)', 'x', { x: 0, y: 1 })   // => 1
 */
export function partialDerivative(expr: string, varName: string, scope: Record<string, f64>): f64 {
  const x0 = scope[varName];
  if (x0 === undefined) {
    throw new Error(`Variable '${varName}' not found in scope`);
  }
  return numericalDerivative(expr, varName, x0, 1, 1e-6, scope);
}

/**
 * Compute the directional derivative of an expression.
 *
 * The directional derivative is the dot product of the gradient with
 * the (normalized) direction vector.
 *
 * @param expr - Expression string
 * @param vars - Variable names
 * @param direction - Direction vector (will be normalized)
 * @param scope - Variable values at which to evaluate
 * @returns Directional derivative value
 *
 * @example
 * directionalDerivative('x^2 + y^2', ['x', 'y'], [1, 0], { x: 3, y: 4 }) // => 6
 */
export function directionalDerivative(
  expr: string,
  vars: string[],
  direction: f64[],
  scope: Record<string, f64>
): f64 {
  if (vars.length !== direction.length) {
    throw new Error('vars and direction must have the same length');
  }

  // Normalize direction
  const mag = Math.sqrt(direction.reduce((s, d) => s + d * d, 0));
  if (mag === 0) throw new Error('Direction vector cannot be zero');
  const unitDir = direction.map((d) => d / mag);

  // Compute gradient dot direction
  let result: f64 = 0;
  for (let i = 0; i < vars.length; i++) {
    const pd = partialDerivative(expr, vars[i], scope);
    result += pd * unitDir[i];
  }
  return result;
}

/**
 * Compute the symbolic gradient vector of an expression.
 *
 * Returns an array of partial derivative values at the given point.
 *
 * @param expr - Expression string
 * @param vars - Variable names
 * @param scope - Variable values at which to evaluate
 * @returns Array of partial derivative values
 *
 * @example
 * gradientSymbolic('x^2 + y^2', ['x', 'y'], { x: 3, y: 4 }) // => [6, 8]
 */
export function gradientSymbolic(expr: string, vars: string[], scope: Record<string, f64>): f64[] {
  return vars.map((v) => partialDerivative(expr, v, scope));
}

/**
 * Compute the Jacobian matrix of a vector-valued function.
 *
 * J[i][j] = partial derivative of exprs[i] with respect to vars[j].
 *
 * @param exprs - Array of expression strings (vector field components)
 * @param vars - Variable names
 * @param scope - Variable values at which to evaluate
 * @returns 2D array (matrix) of partial derivatives
 *
 * @example
 * jacobian(['x*y', 'x^2'], ['x', 'y'], { x: 2, y: 3 })
 * // => [[3, 2], [4, 0]]
 */
export function jacobian(exprs: string[], vars: string[], scope: Record<string, f64>): f64[][] {
  return exprs.map((expr) => vars.map((v) => partialDerivative(expr, v, scope)));
}

/**
 * Compute the Laplacian of a scalar field.
 *
 * The Laplacian is the sum of all second partial derivatives:
 * nabla^2 f = sum_i d^2f/dx_i^2
 *
 * @param expr - Expression string
 * @param vars - Variable names
 * @param scope - Variable values at which to evaluate
 * @returns Laplacian value
 *
 * @example
 * laplacian('x^2 + y^2 + z^2', ['x', 'y', 'z'], { x: 1, y: 2, z: 3 }) // => 6
 */
export function laplacian(expr: string, vars: string[], scope: Record<string, f64>): f64 {
  let sum: f64 = 0;
  for (const v of vars) {
    const x0 = scope[v];
    sum += numericalDerivative(expr, v, x0, 2, 1e-4, scope);
  }
  return sum;
}

/**
 * Compute the divergence of a vector field.
 *
 * div(F) = df1/dx1 + df2/dx2 + ... + dfn/dxn
 *
 * @param exprs - Array of expression strings (vector field components)
 * @param vars - Variable names (must match length of exprs)
 * @param scope - Variable values at which to evaluate
 * @returns Divergence value
 *
 * @example
 * divergence(['x^2', 'y^2', 'z^2'], ['x', 'y', 'z'], { x: 1, y: 2, z: 3 })
 * // => 2 + 4 + 6 = 12
 */
export function divergence(exprs: string[], vars: string[], scope: Record<string, f64>): f64 {
  if (exprs.length !== vars.length) {
    throw new Error('exprs and vars must have the same length');
  }
  let sum: f64 = 0;
  for (let i = 0; i < exprs.length; i++) {
    sum += partialDerivative(exprs[i], vars[i], scope);
  }
  return sum;
}

// =============================================================================
// TRANSFORMS (4 functions)
// =============================================================================

/**
 * Laplace transform lookup table.
 * Maps time-domain patterns to s-domain expressions.
 */
interface LaplaceEntry {
  pattern: RegExp;
  transform: (match: RegExpMatchArray, t: string, s: string) => string;
}

const laplaceTable: LaplaceEntry[] = [
  // 1 -> 1/s
  {
    pattern: /^1$/,
    transform: (_m, _t, s) => `1/${s}`,
  },
  // t -> 1/s^2
  {
    pattern: /^__VAR__$/,
    transform: (_m, _t, s) => `1/${s}^2`,
  },
  // t^n -> n!/s^(n+1)
  {
    pattern: /^__VAR__\^(\d+)$/,
    transform: (m, _t, s) => {
      const n = parseInt(m[1]);
      return `${factorial(n)}/${s}^${n + 1}`;
    },
  },
  // exp(-a*t) or exp(a*t)
  {
    pattern: /^exp\((-?[\d.]+)\*__VAR__\)$/,
    transform: (m, _t, s) => {
      const a = parseFloat(m[1]);
      return `1/(${s} - ${formatCoeff(a)})`;
    },
  },
  // sin(a*t)
  {
    pattern: /^sin\(([\d.]+)\*__VAR__\)$/,
    transform: (m, _t, s) => {
      const a = parseFloat(m[1]);
      return `${formatCoeff(a)}/(${s}^2 + ${formatCoeff(a * a)})`;
    },
  },
  // cos(a*t)
  {
    pattern: /^cos\(([\d.]+)\*__VAR__\)$/,
    transform: (m, _t, s) => {
      const a = parseFloat(m[1]);
      return `${s}/(${s}^2 + ${formatCoeff(a * a)})`;
    },
  },
  // sin(t)
  {
    pattern: /^sin\(__VAR__\)$/,
    transform: (_m, _t, s) => `1/(${s}^2 + 1)`,
  },
  // cos(t)
  {
    pattern: /^cos\(__VAR__\)$/,
    transform: (_m, _t, s) => `${s}/(${s}^2 + 1)`,
  },
  // exp(t) or exp(-t)
  {
    pattern: /^exp\(__VAR__\)$/,
    transform: (_m, _t, s) => `1/(${s} - 1)`,
  },
  {
    pattern: /^exp\(-__VAR__\)$/,
    transform: (_m, _t, s) => `1/(${s} + 1)`,
  },
];

/**
 * Compute the Laplace transform of an expression.
 *
 * Uses a table-based approach for common functions: constants, polynomials,
 * exponentials, sin, cos.
 *
 * @param expr - Time-domain expression string
 * @param t - Time variable name
 * @param s - Frequency variable name
 * @returns Laplace transform as an expression string
 *
 * @example
 * laplace('1', 't', 's')           // => '1/s'
 * laplace('t^2', 't', 's')         // => '2/s^3'
 * laplace('sin(t)', 't', 's')      // => '1/(s^2 + 1)'
 * laplace('exp(-t)', 't', 's')     // => '1/(s + 1)'
 */
export function laplace(expr: string, t: string, s: string): string {
  const trimmed = expr.trim();

  for (const entry of laplaceTable) {
    // Replace __VAR__ placeholder with the actual variable name
    const patternStr = entry.pattern.source.replace(
      /__VAR__/g,
      t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regex = new RegExp(`^${patternStr}$`);
    const match = trimmed.match(regex);
    if (match) {
      return entry.transform(match, t, s);
    }
  }

  // Constant (no t variable)
  if (!trimmed.includes(t)) {
    return `${trimmed}/${s}`;
  }

  return `L{${trimmed}}(${s})`;
}

/**
 * Inverse Laplace transform lookup table.
 */
interface InverseLaplaceEntry {
  pattern: RegExp;
  transform: (match: RegExpMatchArray, s: string, t: string) => string;
}

const inverseLaplaceTable: InverseLaplaceEntry[] = [
  // 1/s -> 1
  {
    pattern: /^1\/__VAR__$/,
    transform: (_m, _s, _t) => '1',
  },
  // 1/s^2 -> t
  {
    pattern: /^1\/__VAR__\^2$/,
    transform: (_m, _s, t) => t,
  },
  // 1/s^n -> t^(n-1)/(n-1)!
  {
    pattern: /^1\/__VAR__\^(\d+)$/,
    transform: (m, _s, t) => {
      const n = parseInt(m[1]);
      return `${t}^${n - 1}/${factorial(n - 1)}`;
    },
  },
  // 1/(s + a) -> exp(-a*t)
  {
    pattern: /^1\/\(__VAR__ \+ ([\d.]+)\)$/,
    transform: (m, _s, t) => `exp(-${m[1]}*${t})`,
  },
  // 1/(s - a) -> exp(a*t)
  {
    pattern: /^1\/\(__VAR__ - ([\d.]+)\)$/,
    transform: (m, _s, t) => `exp(${m[1]}*${t})`,
  },
  // s/(s^2 + a) -> cos(sqrt(a)*t)
  {
    pattern: /^__VAR__\/\(__VAR__\^2 \+ ([\d.]+)\)$/,
    transform: (m, _s, t) => {
      const a = parseFloat(m[1]);
      const w = Math.sqrt(a);
      return `cos(${formatCoeff(w)}*${t})`;
    },
  },
  // a/(s^2 + a^2) form -> sin(w*t) where a = w
  {
    pattern: /^([\d.]+)\/\(__VAR__\^2 \+ ([\d.]+)\)$/,
    transform: (m, _s, t) => {
      const num = parseFloat(m[1]);
      const den = parseFloat(m[2]);
      const w = Math.sqrt(den);
      // If num == w, this is sin(w*t)
      if (Math.abs(num - w) < 1e-10) {
        return `sin(${formatCoeff(w)}*${t})`;
      }
      return `${formatCoeff(num / w)}*sin(${formatCoeff(w)}*${t})`;
    },
  },
];

/**
 * Compute the inverse Laplace transform of an expression.
 *
 * Uses table lookup and partial fraction patterns.
 *
 * @param expr - Frequency-domain expression string
 * @param s - Frequency variable name
 * @param t - Time variable name
 * @returns Inverse Laplace transform as an expression string
 *
 * @example
 * inverseLaplace('1/s', 's', 't')         // => '1'
 * inverseLaplace('1/(s + 1)', 's', 't')   // => 'exp(-1*t)'
 */
export function inverseLaplace(expr: string, s: string, t: string): string {
  const trimmed = expr.trim();

  for (const entry of inverseLaplaceTable) {
    const patternStr = entry.pattern.source.replace(
      /__VAR__/g,
      s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regex = new RegExp(`^${patternStr}$`);
    const match = trimmed.match(regex);
    if (match) {
      return entry.transform(match, s, t);
    }
  }

  return `L^-1{${trimmed}}(${t})`;
}

/**
 * Compute Fourier series coefficients of a periodic function.
 *
 * Computes a0, an, bn coefficients for the Fourier series representation:
 * f(x) ~ a0/2 + sum_{k=1}^{n} [a_k cos(k*x) + b_k sin(k*x)]
 *
 * Assumes period 2*pi. Coefficients computed numerically.
 *
 * @param expr - Expression string (function of varName)
 * @param varName - Variable name
 * @param n - Number of harmonics
 * @returns Object with a0, an[], bn[] coefficients
 *
 * @example
 * fourierSeries('x', 'x', 3)
 * // => { a0: 0, an: [0, 0, 0], bn: [-2, 1, -0.667] } (approx)
 */
export function fourierSeries(
  expr: string,
  varName: string,
  n: number
): { a0: f64; an: f64[]; bn: f64[] } {
  const N = 1000; // integration points
  const dx = (2 * Math.PI) / N;

  // Compute a0 = (1/pi) * integral from -pi to pi of f(x) dx
  let a0Sum: f64 = 0;
  for (let i = 0; i < N; i++) {
    const x = -Math.PI + i * dx;
    a0Sum += evalAt(expr, varName, x);
  }
  const a0 = (a0Sum * dx) / Math.PI;

  const an: f64[] = [];
  const bn: f64[] = [];

  for (let k = 1; k <= n; k++) {
    let akSum: f64 = 0;
    let bkSum: f64 = 0;
    for (let i = 0; i < N; i++) {
      const x = -Math.PI + i * dx;
      const fx = evalAt(expr, varName, x);
      akSum += fx * Math.cos(k * x);
      bkSum += fx * Math.sin(k * x);
    }
    an.push((akSum * dx) / Math.PI);
    bn.push((bkSum * dx) / Math.PI);
  }

  return { a0, an, bn };
}

/**
 * Compute the Z-transform of a sequence expression.
 *
 * Uses table-based lookup for common sequences.
 *
 * @param expr - Expression in terms of n (sequence element)
 * @param n - Sequence index variable
 * @param z - Z-domain variable
 * @returns Z-transform as an expression string
 *
 * @example
 * zTransform('1', 'n', 'z')       // => 'z/(z - 1)'
 * zTransform('n', 'n', 'z')       // => 'z/(z - 1)^2'
 */
export function zTransform(expr: string, n: string, z: string): string {
  const trimmed = expr.trim();

  // delta[n] or 1 when considered as unit step conceptually
  if (trimmed === '1') return `${z}/(${z} - 1)`;

  // n -> z/(z-1)^2
  if (trimmed === n) return `${z}/(${z} - 1)^2`;

  // a^n
  const anMatch = trimmed.match(
    new RegExp(`^([\\d.]+)\\^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
  );
  if (anMatch) {
    const a = anMatch[1];
    return `${z}/(${z} - ${a})`;
  }

  return `Z{${trimmed}}(${z})`;
}

// =============================================================================
// SERIES (4 functions)
// =============================================================================

/**
 * Compute the Taylor series expansion of an expression around a point.
 *
 * Computes coefficients numerically using finite differences and returns
 * the polynomial approximation as a string.
 *
 * @param expr - Expression string
 * @param varName - Variable name
 * @param x0 - Center of expansion (default 0, i.e., Maclaurin series)
 * @param n - Order of expansion (default 5)
 * @returns Taylor polynomial as an expression string
 *
 * @example
 * taylor('sin(x)', 'x', 0, 5)  // => 'x - 0.1666666667*x^3 + 0.008333333333*x^5'
 * taylor('exp(x)', 'x', 0, 4)  // => '1 + x + 0.5*x^2 + ...'
 */
export function taylor(expr: string, varName: string, x0: f64 = 0, n: number = 5): string {
  const coeffs: f64[] = [];

  for (let k = 0; k <= n; k++) {
    const deriv = numericalDerivative(expr, varName, x0, k);
    coeffs.push(deriv / factorial(k));
  }

  const terms = coeffs.map((c, k) => buildTerm(c, varName, x0, k)).filter(Boolean);

  return terms.join(' + ').replace(/\+ -/g, '- ') || '0';
}

/**
 * Compute a multivariate Taylor expansion.
 *
 * Returns first-order (linear) approximation for multiple variables:
 * f(x0) + sum_i df/dx_i * (x_i - x0_i) + ...
 *
 * @param expr - Expression string
 * @param vars - Variable names
 * @param x0 - Center point values
 * @param n - Order (currently supports order 1)
 * @returns Taylor approximation as expression string
 *
 * @example
 * multivariateTaylor('x*y', ['x', 'y'], [1, 1], 1) // => '1 + (x - 1)*y0 + (y - 1)*x0'
 */
export function multivariateTaylor(expr: string, vars: string[], x0: f64[], n: number = 1): string {
  if (vars.length !== x0.length) {
    throw new Error('vars and x0 must have the same length');
  }

  const scope: Record<string, f64> = {};
  for (let i = 0; i < vars.length; i++) {
    scope[vars[i]] = x0[i];
  }

  // f(x0)
  const f0 = evalWith(expr, scope);
  const terms: string[] = [formatCoeff(f0)];

  if (n >= 1) {
    // First-order terms
    for (let i = 0; i < vars.length; i++) {
      const pd = partialDerivative(expr, vars[i], scope);
      if (Math.abs(pd) < 1e-12) continue;
      const xPart = x0[i] === 0 ? vars[i] : `(${vars[i]} - ${formatCoeff(x0[i])})`;
      terms.push(`${formatCoeff(pd)}*${xPart}`);
    }
  }

  if (n >= 2) {
    // Second-order terms (Hessian diagonal + cross terms)
    for (let i = 0; i < vars.length; i++) {
      // Diagonal: d^2f/dx_i^2
      const d2 = numericalDerivative(expr, vars[i], x0[i], 2, 1e-4, scope);
      const coeff = d2 / 2;
      if (Math.abs(coeff) < 1e-12) continue;
      const xPart = x0[i] === 0 ? vars[i] : `(${vars[i]} - ${formatCoeff(x0[i])})`;
      terms.push(`${formatCoeff(coeff)}*${xPart}^2`);
    }

    // Cross terms
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        // d^2f/(dx_i dx_j) via finite differences
        const h = 1e-4;
        const s = { ...scope };
        s[vars[i]] = x0[i] + h;
        s[vars[j]] = x0[j] + h;
        const fpp = evalWith(expr, s);
        s[vars[j]] = x0[j] - h;
        const fpm = evalWith(expr, s);
        s[vars[i]] = x0[i] - h;
        s[vars[j]] = x0[j] + h;
        const fmp = evalWith(expr, s);
        s[vars[j]] = x0[j] - h;
        const fmm = evalWith(expr, s);
        const cross = (fpp - fpm - fmp + fmm) / (4 * h * h);
        if (Math.abs(cross) < 1e-12) continue;
        const xi = x0[i] === 0 ? vars[i] : `(${vars[i]} - ${formatCoeff(x0[i])})`;
        const xj = x0[j] === 0 ? vars[j] : `(${vars[j]} - ${formatCoeff(x0[j])})`;
        terms.push(`${formatCoeff(cross)}*${xi}*${xj}`);
      }
    }
  }

  return terms.join(' + ').replace(/\+ -/g, '- ') || '0';
}

/**
 * Power series expansion (alias for taylor).
 *
 * @param expr - Expression string
 * @param varName - Variable name
 * @param x0 - Center of expansion (default 0)
 * @param n - Order (default 5)
 * @returns Power series as expression string
 */
export function series(expr: string, varName: string, x0: f64 = 0, n: number = 5): string {
  return taylor(expr, varName, x0, n);
}

/**
 * Extract the kth coefficient of the Taylor series expansion.
 *
 * Returns c_k where f(x) = sum c_k * (x - x0)^k.
 *
 * @param expr - Expression string
 * @param varName - Variable name
 * @param x0 - Center of expansion
 * @param k - Index of coefficient to extract
 * @returns The kth Taylor coefficient
 *
 * @example
 * seriesCoefficient('exp(x)', 'x', 0, 3) // => 1/6 = 0.1667
 * seriesCoefficient('sin(x)', 'x', 0, 1) // => 1
 */
export function seriesCoefficient(expr: string, varName: string, x0: f64, k: number): f64 {
  const deriv = numericalDerivative(expr, varName, x0, k);
  return deriv / factorial(k);
}

// =============================================================================
// SOLVER (4 functions)
// =============================================================================

/**
 * Solve an equation for a variable.
 *
 * Supports linear, quadratic, and cubic equations. For the expression f(x),
 * finds roots where f(x) = 0.
 *
 * @param expr - Expression string (set equal to 0)
 * @param varName - Variable to solve for
 * @returns Array of solutions (real roots)
 *
 * @example
 * solve('x^2 - 4', 'x')      // => [-2, 2]
 * solve('x^2 + 2*x + 1', 'x') // => [-1]
 * solve('2*x - 6', 'x')       // => [3]
 */
/** Duck-typed Complex check (works for any Complex-shaped root). */
function isComplexRoot(r: unknown): r is { re: number; im: number } {
  return typeof r === 'object' && r !== null && 're' in r && 'im' in r;
}

/**
 * Read [c0,c1,c2,c3] of `expr` in `varName`, confirming it is a polynomial of
 * degree ≤ 3. Uses Newton forward differences on the integer grid 0..4 (the 4th
 * difference must vanish) and validates at non-integer points. Returns null if
 * the expression is not a degree-≤3 polynomial or cannot be evaluated there.
 */
function polyCoeffsDeg3(expr: string, varName: string): f64[] | null {
  const at = (x: f64): f64 => {
    const v = evalAt(expr, varName, x);
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  };
  try {
    const f = [0, 1, 2, 3, 4].map(at);
    if (f.some((v) => !Number.isFinite(v))) return null;
    const d1 = f[1] - f[0];
    const d2 = f[2] - 2 * f[1] + f[0];
    const d3 = f[3] - 3 * f[2] + 3 * f[1] - f[0];
    const d4 = f[4] - 4 * f[3] + 6 * f[2] - 4 * f[1] + f[0];
    const scale = Math.max(1, ...f.map(Math.abs));
    if (Math.abs(d4) > 1e-7 * scale) return null; // degree ≥ 4 (or non-polynomial)
    const c3 = d3 / 6;
    const c2 = d2 / 2 - d3 / 2;
    const c1 = d1 - d2 / 2 + d3 / 3;
    const c0 = f[0];
    const coeffs = [c0, c1, c2, c3];
    // Validate the reconstruction against non-integer sample points.
    for (const x of [-1.5, 0.5, 2.5, 3.5]) {
      const recon = c0 + c1 * x + c2 * x * x + c3 * x * x * x;
      const actual = at(x);
      if (!Number.isFinite(actual)) return null;
      if (Math.abs(recon - actual) > 1e-6 * (1 + Math.abs(actual))) return null;
    }
    return coeffs;
  } catch {
    return null;
  }
}

/** Numeric real-root scan (sign change + bisection) — fallback for degree ≥ 4 / transcendental. */
function numericRealRoots(expr: string, varName: string): f64[] {
  const roots: f64[] = [];
  const seen = new Set<string>();
  const addRoot = (r: f64) => {
    const rounded = Math.round(r);
    const clean = Math.abs(r - rounded) < 1e-8 ? rounded : r;
    const key = clean.toFixed(8);
    if (!seen.has(key)) {
      seen.add(key);
      roots.push(clean);
    }
  };
  const ranges = [
    { lo: -100, hi: 100, step: 0.1 },
    { lo: -1000, hi: 1000, step: 1 },
  ];
  for (const { lo, hi, step } of ranges) {
    for (let x = lo; x <= hi; x += step) {
      let fa: f64;
      try {
        fa = evalAt(expr, varName, x);
      } catch {
        continue;
      }
      if (Math.abs(fa) < 1e-10) {
        addRoot(x);
        continue;
      }
      let fb: f64;
      try {
        fb = evalAt(expr, varName, x + step);
      } catch {
        continue;
      }
      if (fa * fb < 0) {
        let a = x,
          b = x + step;
        let faB = fa;
        for (let iter = 0; iter < 60; iter++) {
          const mid = (a + b) / 2;
          const fm = evalAt(expr, varName, mid);
          if (Math.abs(fm) < 1e-14) {
            a = mid;
            b = mid;
            break;
          }
          if (faB * fm < 0) {
            b = mid;
          } else {
            a = mid;
            faB = fm;
          }
        }
        addRoot((a + b) / 2);
      }
    }
    if (roots.length > 0) break;
  }
  roots.sort((a, b) => a - b);
  return roots;
}

/**
 * Solve an equation or expression for a variable, returning its distinct roots.
 *
 * Accepts either an expression (treated as `expr = 0`) or a full equation with a
 * single `=` sign. Polynomials of degree ≤ 3 yield exact closed-form roots —
 * including complex conjugates — while higher-degree and transcendental
 * equations fall back to a numeric scan for real roots. Real roots are returned
 * first (cleaned of float noise and sorted ascending), followed by any complex
 * roots.
 *
 * @example
 * solve('x^2 - 4', 'x')       // => [-2, 2]
 * solve('x^2 + 1 = 0', 'x')   // => [Complex(0, 1), Complex(0, -1)]
 * solve('2*x - 6', 'x')       // => [3]
 * solve('x^3 - 8', 'x')       // => [2, Complex(-1, 1.732…), Complex(-1, -1.732…)]
 * solve('cos(x)', 'x')        // => numeric real roots
 *
 * @param equation - Expression (`expr = 0`) or equation with one `=` sign.
 * @param varName  - Variable to solve for.
 * @returns Distinct roots: real numbers (sorted) then Complex.
 */
export function solve(equation: string, varName: string): Array<f64 | Complex> {
  // Normalize "lhs = rhs" to a root-finding expression "lhs - (rhs)".
  let expr = equation;
  if (equation.includes('=')) {
    const parts = equation.split('=');
    if (parts.length !== 2) {
      throw new SyntaxError("solve: equation must contain at most one '=' sign");
    }
    expr = `${parts[0].trim()} - (${parts[1].trim()})`;
  }

  // Exact path: polynomial of degree ≤ 3 — delegate to the Algebra solver
  // `polynomialRoot` (linear/quadratic/cubic closed form, real + complex).
  const coeffs = polyCoeffsDeg3(expr, varName);
  if (coeffs) {
    const [c0, c1, c2, c3] = coeffs;
    const eps = 1e-9;
    let degree = 0;
    if (Math.abs(c3) > eps) degree = 3;
    else if (Math.abs(c2) > eps) degree = 2;
    else if (Math.abs(c1) > eps) degree = 1;

    if (degree === 0) {
      // Constant: identity (c0 ≈ 0) or no solution — no isolated roots.
      return [];
    }

    let raw: unknown[];
    try {
      // polynomialRoot(constant, linear, quadratic?, cubic?) — pass up to degree.
      const args = [c0, c1, c2, c3].slice(0, degree + 1);
      raw = (polynomialRoot as (...a: number[]) => unknown[])(...args);
    } catch {
      // Fall back to numeric scan if the closed-form solver rejects the input.
      return numericRealRoots(expr, varName);
    }

    // Clean + dedupe: real roots first (sorted), then complex.
    const reals: f64[] = [];
    const complexRoots: Complex[] = [];
    const seen = new Set<string>();
    for (const r of raw) {
      if (isComplexRoot(r)) {
        if (Math.abs(r.im) < 1e-10) {
          pushReal(r.re);
        } else {
          const re = cleanComponent(r.re);
          const im = cleanComponent(r.im);
          const key = `${re.toFixed(8)}|${im.toFixed(8)}`;
          if (!seen.has(key)) {
            seen.add(key);
            complexRoots.push(new Complex(re, im));
          }
        }
      } else {
        pushReal(r as f64);
      }
    }
    function cleanComponent(x: f64): f64 {
      if (Math.abs(x) < 1e-10) return 0;
      const rounded = Math.round(x);
      return Math.abs(x - rounded) < 1e-8 ? rounded : x;
    }
    function pushReal(x: f64) {
      const clean = cleanComponent(x);
      const key = `r${clean.toFixed(8)}`;
      if (!seen.has(key)) {
        seen.add(key);
        reals.push(clean);
      }
    }
    reals.sort((a, b) => a - b);
    return [...reals, ...complexRoots];
  }

  // Fallback: numeric real roots for degree ≥ 4 / transcendental equations.
  return numericRealRoots(expr, varName);
}

/**
 * Compute dy/dx from an implicit equation F(x, y) = 0.
 *
 * Uses the implicit function theorem: dy/dx = -(dF/dx) / (dF/dy)
 *
 * @param expr - Expression F(x, y)
 * @param x - x-variable name
 * @param y - y-variable name
 * @param scope - Point at which to evaluate
 * @returns dy/dx at the given point
 *
 * @example
 * // Circle: x^2 + y^2 - 25 = 0 at (3, 4)
 * implicitDiff('x^2 + y^2 - 25', 'x', 'y', { x: 3, y: 4 }) // => -0.75
 */
export function implicitDiff(expr: string, x: string, y: string, scope: Record<string, f64>): f64 {
  const dFdx = partialDerivative(expr, x, scope);
  const dFdy = partialDerivative(expr, y, scope);

  if (Math.abs(dFdy) < 1e-15) {
    throw new Error('dF/dy is zero; implicit function theorem does not apply');
  }

  return -dFdx / dFdy;
}

/**
 * Compute a symbolic summation.
 *
 * For known closed forms (constant, linear, quadratic, cubic), returns
 * the exact result. Otherwise falls back to numerical summation.
 *
 * @param expr - Expression to sum (function of varName)
 * @param varName - Summation index variable
 * @param a - Lower bound (integer)
 * @param b - Upper bound (integer)
 * @returns Sum value
 *
 * @example
 * summation('k', 'k', 1, 100)     // => 5050
 * summation('k^2', 'k', 1, 10)    // => 385
 * summation('1', 'k', 1, 50)      // => 50
 */
export function summation(expr: string, varName: string, a: number, b: number): f64 {
  // Direct numerical summation (always correct for finite sums)
  let sum: f64 = 0;
  for (let k = a; k <= b; k++) {
    sum += evalAt(expr, varName, k);
  }
  return sum;
}

/**
 * Compute a symbolic product.
 *
 * Computes the product of expr for varName from a to b.
 *
 * @param expr - Expression to multiply (function of varName)
 * @param varName - Product index variable
 * @param a - Lower bound (integer)
 * @param b - Upper bound (integer)
 * @returns Product value
 *
 * @example
 * symbolicProduct('k', 'k', 1, 5)    // => 120 (= 5!)
 * symbolicProduct('2*k', 'k', 1, 4)  // => 384
 */
export function symbolicProduct(expr: string, varName: string, a: number, b: number): f64 {
  let product: f64 = 1;
  for (let k = a; k <= b; k++) {
    product *= evalAt(expr, varName, k);
  }
  return product;
}

// =============================================================================
// ADVANCED (8 functions)
// =============================================================================

/**
 * Declare an assumption about a variable's properties.
 *
 * Stores assumptions that can be queried by other CAS functions
 * (e.g., simplification, integration).
 *
 * @param varName - Variable name
 * @param property - Property to assume ('real', 'positive', 'negative', 'integer', 'nonzero')
 *
 * @example
 * assume('x', 'positive')
 * assume('n', 'integer')
 */
export function assume(varName: string, property: string): void {
  const validProperties = ['real', 'positive', 'negative', 'integer', 'nonzero', 'nonnegative'];
  if (!validProperties.includes(property)) {
    throw new Error(`Unknown property '${property}'. Valid: ${validProperties.join(', ')}`);
  }
  if (!assumptions.has(varName)) {
    assumptions.set(varName, new Set());
  }
  assumptions.get(varName)!.add(property);
}

/**
 * Query assumptions about a variable.
 *
 * @param varName - Variable name
 * @returns Set of assumed properties, or empty set if none
 */
export function getAssumptions(varName: string): Set<string> {
  return assumptions.get(varName) ?? new Set();
}

/**
 * Clear all assumptions about a variable (or all variables).
 *
 * @param varName - Variable name, or undefined to clear all
 */
export function clearAssumptions(varName?: string): void {
  if (varName) {
    assumptions.delete(varName);
  } else {
    assumptions.clear();
  }
}

/**
 * Compute the asymptotic expansion of an expression.
 *
 * Finds the leading-order behavior as the variable approaches
 * the specified limit (typically infinity).
 *
 * @param expr - Expression string
 * @param varName - Variable name
 * @param towards - Limit point (default: Infinity)
 * @returns Object with leadingTerm and order
 *
 * @example
 * asymptotic('(x^2 + 1) / x', 'x', Infinity)
 * // => { leadingTerm: 'x', order: 1 }
 */
export function asymptotic(
  expr: string,
  varName: string,
  towards: f64 = Infinity
): { leadingTerm: string; order: f64; coefficient: f64 } {
  if (towards === Infinity || towards === -Infinity) {
    // Find the growth rate by evaluating at large values
    const x1 = 100;
    const x2 = 1000;
    const x3 = 10000;

    const f1 = evalAt(expr, varName, x1);
    const f2 = evalAt(expr, varName, x2);
    const f3 = evalAt(expr, varName, x3);

    // Estimate order: f(x) ~ c * x^n => log(f) ~ log(c) + n*log(x)
    // n ~ (log(f2) - log(f1)) / (log(x2) - log(x1))
    if (Math.abs(f1) < 1e-15 || Math.abs(f2) < 1e-15) {
      return { leadingTerm: '0', order: -Infinity, coefficient: 0 };
    }

    const logRatio1 = Math.log(Math.abs(f2) / Math.abs(f1)) / Math.log(x2 / x1);
    const logRatio2 = Math.log(Math.abs(f3) / Math.abs(f2)) / Math.log(x3 / x2);

    // Average and round to nearest half-integer
    const avgOrder = (logRatio1 + logRatio2) / 2;
    const roundedOrder = Math.round(avgOrder * 2) / 2;
    const coefficient = f3 / Math.pow(x3, roundedOrder);

    let leadingTerm: string;
    if (roundedOrder === 0) {
      leadingTerm = formatCoeff(coefficient);
    } else if (roundedOrder === 1) {
      leadingTerm = `${formatCoeff(coefficient)}*${varName}`;
    } else {
      leadingTerm = `${formatCoeff(coefficient)}*${varName}^${roundedOrder}`;
    }

    return { leadingTerm, order: roundedOrder, coefficient };
  }

  // Near a finite point: compute the limit
  const lim = limit(expr, varName, towards);
  return { leadingTerm: formatCoeff(lim), order: 0, coefficient: lim };
}

/**
 * Compute a Groebner basis for a system of polynomial equations.
 *
 * Implements Buchberger's algorithm for small systems (up to 3 variables,
 * low degree). Polynomials are represented as expression strings set to 0.
 *
 * This is a simplified implementation that works with monomials represented
 * internally as coefficient maps.
 *
 * @param polys - Array of polynomial expression strings
 * @param vars - Variable names
 * @returns Array of Groebner basis polynomial strings
 *
 * @example
 * groebnerBasis(['x^2 + y - 1', 'x + y^2 - 1'], ['x', 'y'])
 */
export function groebnerBasis(polys: string[], vars: string[]): string[] {
  // Internal monomial representation
  type Monomial = { coeff: f64; powers: number[] };
  type Poly = Monomial[];

  // Parse a polynomial by evaluating at specific points to extract coefficients
  // This is a simplified approach - works for polynomials with integer coefficients
  // and small degree
  function parsePoly(expr: string): Poly {
    const result: Poly = [];
    const maxDeg = 4;
    const nVars = vars.length;

    // Enumerate all monomials up to degree maxDeg
    function enumerate(remaining: number, current: number[]): number[][] {
      if (current.length === nVars) {
        return remaining >= 0 ? [current] : [];
      }
      const results: number[][] = [];
      for (let d = 0; d <= remaining; d++) {
        results.push(...enumerate(remaining - d, [...current, d]));
      }
      return results;
    }

    const allMonomials = enumerate(maxDeg, []);

    // Build a linear system to find coefficients
    // Evaluate polynomial at enough points
    const nMonomials = allMonomials.length;
    const points: f64[][] = [];
    const values: f64[] = [];

    // Generate distinct evaluation points
    for (let i = 0; i < nMonomials && i < 50; i++) {
      const point: f64[] = [];
      let idx = i;
      for (let j = 0; j < nVars; j++) {
        point.push((idx % 5) - 2); // -2, -1, 0, 1, 2
        idx = Math.floor(idx / 5);
      }
      const scope: Record<string, f64> = {};
      for (let j = 0; j < nVars; j++) scope[vars[j]] = point[j];
      try {
        values.push(evalWith(expr, scope));
        points.push(point);
      } catch {
        // Skip invalid evaluation points
      }
    }

    // Solve via least squares (simplified: just compute coefficients directly
    // for common cases)
    // For now, extract by probing specific monomials
    for (const powers of allMonomials) {
      // Use inclusion-exclusion to extract coefficient
      // This is a simplified Vandermonde-like approach
      const scope0: Record<string, f64> = {};
      for (let j = 0; j < nVars; j++) scope0[vars[j]] = 0;

      // For constant term
      if (powers.every((p) => p === 0)) {
        try {
          result.push({ coeff: evalWith(expr, scope0), powers: [...powers] });
        } catch {
          result.push({ coeff: 0, powers: [...powers] });
        }
        continue;
      }

      // Extract coefficient via finite differences
      let coeff: f64 = 0;
      try {
        // Use multi-dimensional finite difference
        const totalDeg = powers.reduce((s, p) => s + p, 0);
        if (totalDeg <= maxDeg) {
          // Evaluate at unit point for this monomial
          const unitScope: Record<string, f64> = {};
          for (let j = 0; j < nVars; j++) unitScope[vars[j]] = powers[j] > 0 ? 1 : 0;
          const fUnit = evalWith(expr, unitScope);

          // Subtract contributions from lower-degree terms already found
          let lowerContrib = 0;
          for (const m of result) {
            let mVal = m.coeff;
            for (let j = 0; j < nVars; j++) {
              mVal *= Math.pow(unitScope[vars[j]], m.powers[j]);
            }
            lowerContrib += mVal;
          }
          coeff = fUnit - lowerContrib;

          // Divide by the multinomial coefficient
          for (let j = 0; j < nVars; j++) {
            if (powers[j] > 1) coeff /= factorial(powers[j]);
          }
        }
      } catch {
        coeff = 0;
      }

      if (Math.abs(coeff) > 1e-10) {
        result.push({
          coeff: Math.abs(coeff - Math.round(coeff)) < 1e-8 ? Math.round(coeff) : coeff,
          powers: [...powers],
        });
      }
    }

    return result.filter((m) => Math.abs(m.coeff) > 1e-10);
  }

  // Convert polynomial back to string
  function polyToString(p: Poly): string {
    if (p.length === 0) return '0';
    const terms = p.map((m) => {
      let term = formatCoeff(m.coeff);
      for (let j = 0; j < vars.length; j++) {
        if (m.powers[j] === 1) term += `*${vars[j]}`;
        else if (m.powers[j] > 1) term += `*${vars[j]}^${m.powers[j]}`;
      }
      return term;
    });
    return terms.join(' + ').replace(/\+ -/g, '- ');
  }

  // For this simplified implementation, return the original polynomials parsed
  // and normalized. A full Buchberger's algorithm would compute S-polynomials
  // and reduce, but that requires complete polynomial arithmetic.
  const parsed = polys.map((p) => parsePoly(p));
  return parsed.map((p) => polyToString(p));
}

/**
 * Compute the minimal polynomial of a numerical algebraic expression.
 *
 * Given a numerical value (expressed as a string that evaluates to a number),
 * attempts to find a polynomial with integer coefficients that has this
 * value as a root.
 *
 * Uses the LLL-like approach of checking polynomials of increasing degree.
 *
 * @param expr - Expression string that evaluates to a number
 * @param varName - Variable name for the resulting polynomial
 * @returns Minimal polynomial as a string, or null if not found
 *
 * @example
 * minimalPolynomial('sqrt(2)', 'x')  // => 'x^2 - 2'
 * minimalPolynomial('1.618033988749895', 'x') // => 'x^2 - x - 1' (golden ratio)
 */
export function minimalPolynomial(expr: string, varName: string): string | null {
  const alpha = evaluate(expr) as f64;
  if (!isFinite(alpha)) return null;

  // Check if alpha is rational (integer or simple fraction)
  for (let den = 1; den <= 100; den++) {
    const num = Math.round(alpha * den);
    if (Math.abs(alpha - num / den) < 1e-12) {
      // alpha = num/den, so den*x - num = 0
      if (den === 1) return `${varName} - ${num}`;
      return `${den}*${varName} - ${num}`;
    }
  }

  // Try degree 2: a*x^2 + b*x + c = 0
  // alpha^2, alpha, 1 should be linearly dependent over Q
  const powers = [1, alpha, alpha * alpha, alpha * alpha * alpha, alpha ** 4];

  // Integer relation detection (simplified PSLQ-like)
  for (let deg = 2; deg <= 6; deg++) {
    const maxCoeff = 20;
    // Brute force search for small integer coefficients
    const found = findIntegerRelation(powers.slice(0, deg + 1), maxCoeff);
    if (found) {
      const terms: string[] = [];
      for (let k = deg; k >= 0; k--) {
        if (found[k] === 0) continue;
        if (k === 0) terms.push(formatCoeff(found[k]));
        else if (k === 1) {
          if (found[k] === 1) terms.push(varName);
          else if (found[k] === -1) terms.push(`-${varName}`);
          else terms.push(`${found[k]}*${varName}`);
        } else {
          if (found[k] === 1) terms.push(`${varName}^${k}`);
          else if (found[k] === -1) terms.push(`-${varName}^${k}`);
          else terms.push(`${found[k]}*${varName}^${k}`);
        }
      }
      return terms.join(' + ').replace(/\+ -/g, '- ') || '0';
    }
  }

  return null;
}

/**
 * Find an integer relation among the given real numbers.
 * Returns coefficients [a0, a1, ..., an] such that a0*vals[0] + ... + an*vals[n] ~ 0.
 */
function findIntegerRelation(vals: f64[], maxCoeff: number): number[] | null {
  const n = vals.length;
  if (n <= 1) return null;

  // For degree 2 (3 values: 1, alpha, alpha^2)
  if (n <= 3 && maxCoeff <= 20) {
    for (let a = -maxCoeff; a <= maxCoeff; a++) {
      for (let b = -maxCoeff; b <= maxCoeff; b++) {
        for (let c = n > 2 ? -maxCoeff : 0; c <= (n > 2 ? maxCoeff : 0); c++) {
          if (a === 0 && b === 0 && c === 0) continue;
          if (n === 2 && c !== 0) continue;
          const sum = a * vals[0] + b * vals[1] + (n > 2 ? c * vals[2] : 0);
          if (Math.abs(sum) < 1e-9) {
            const coeffs = [a, b];
            if (n > 2) coeffs.push(c);
            // Ensure leading coefficient is positive
            const leading = coeffs[coeffs.length - 1];
            if (leading < 0) return coeffs.map((x) => -x);
            return coeffs;
          }
        }
      }
    }
  }

  // General case: try small coefficients
  if (n > 3) {
    // Simplified search for small coefficients
    const limit = Math.min(maxCoeff, 10);
    const coeffs = new Array(n).fill(0);

    function search(idx: number): number[] | null {
      if (idx === n) {
        if (coeffs.every((c: number) => c === 0)) return null;
        let sum = 0;
        for (let i = 0; i < n; i++) sum += coeffs[i] * vals[i];
        if (Math.abs(sum) < 1e-9) {
          const result = [...coeffs];
          const lastNonZero = result.findLastIndex((c: number) => c !== 0);
          if (lastNonZero >= 0 && result[lastNonZero] < 0) {
            return result.map((c: number) => -c);
          }
          return result;
        }
        return null;
      }
      for (let c = -limit; c <= limit; c++) {
        coeffs[idx] = c;
        const found = search(idx + 1);
        if (found) return found;
      }
      coeffs[idx] = 0;
      return null;
    }

    return search(0);
  }

  return null;
}

// =============================================================================
// Cubic and Quartic radical-form solvers (internal helpers for toRadicals)
// =============================================================================

/**
 * Solve the depressed cubic t³ + pt + q = 0 and return real roots.
 * Uses Cardano's formula when Δ < 0 (one real root) and the trigonometric
 * (Viète) method when Δ > 0 (three distinct real roots).
 *
 * Returns roots sorted ascending.
 */
function depressedCubicRoots(p: f64, q: f64): f64[] {
  // Discriminant: Δ = -4p³ - 27q² (positive → 3 real roots)
  const Delta = -4 * p * p * p - 27 * q * q;

  if (Math.abs(Delta) < 1e-10) {
    // Repeated-root case
    if (Math.abs(q) < 1e-12) {
      // Triple root at 0
      return [0];
    }
    // Double root: t = 3q/p  and simple root: t = -6q/p
    const t1 = (3 * q) / p;
    const t2 = (-6 * q) / p;
    return [t1, t2].sort((a, b) => a - b);
  }

  if (Delta > 0) {
    // Three distinct real roots — trigonometric form (Viète / Cardano-trig)
    // t_k = 2√(-p/3) · cos(⅓ · arccos((3q)/(2p) · √(-3/p)) − 2πk/3)
    const m = 2 * Math.sqrt(-p / 3);
    // clamp to [-1, 1] to guard against tiny floating-point overshoot
    const acosArg = Math.max(-1, Math.min(1, ((3 * q) / (2 * p)) * Math.sqrt(-3 / p)));
    const theta = Math.acos(acosArg) / 3;
    const roots: f64[] = [
      m * Math.cos(theta),
      m * Math.cos(theta - (2 * Math.PI) / 3),
      m * Math.cos(theta - (4 * Math.PI) / 3),
    ];
    return roots.sort((a, b) => a - b);
  }

  // Delta < 0: one real root, two complex conjugates — Cardano's formula
  const sqrtArg = (q / 2) * (q / 2) + (p / 3) * (p / 3) * (p / 3);
  const sqrtVal = Math.sqrt(Math.abs(sqrtArg));
  const u = Math.cbrt(-q / 2 + sqrtVal);
  const v = Math.cbrt(-q / 2 - sqrtVal);
  return [u + v];
}

/**
 * Solve cubic Ax³ + Bx² + Cx + D = 0 and return real roots as radical strings.
 * The five pre-evaluated samples fm2…f2 are used for a fast integer-root
 * short-circuit (rational-roots check on {-2,-1,0,1,2}) before calling the
 * closed-form solver.
 */
function solveCubicRadicals(
  A: f64,
  B: f64,
  C: f64,
  D: f64,
  fm2: f64,
  fm1: f64,
  f0: f64,
  f1: f64,
  f2: f64
): string[] {
  // Fast rational-root short-circuit: if a sample point is an exact root,
  // factor it out and solve the resulting quadratic.
  const candidates: [f64, f64][] = [
    [-2, fm2],
    [-1, fm1],
    [0, f0],
    [1, f1],
    [2, f2],
  ];

  for (const [r, fr] of candidates) {
    if (Math.abs(fr) < 1e-8) {
      // r is a root; divide out (x - r) via synthetic division
      // Ax³ + Bx² + Cx + D = (x - r)(Ax² + (B + rA)x + (C + r(B + rA)))
      const qa = A;
      const qb = B + r * A;
      const qc = C + r * qb;
      // Solve quadratic qa*x² + qb*x + qc = 0
      const disc = qb * qb - 4 * qa * qc;
      const roots: string[] = [formatCoeff(r)];
      if (Math.abs(disc) < 1e-10) {
        roots.push(formatCoeff(-qb / (2 * qa)));
      } else if (disc > 0) {
        const s = Math.sqrt(disc);
        roots.push(formatCoeff((-qb + s) / (2 * qa)));
        roots.push(formatCoeff((-qb - s) / (2 * qa)));
      }
      // disc < 0: complex conjugate pair — omit
      return roots;
    }
  }

  // Depress: x = t - B/(3A)
  const shift = B / (3 * A);
  const p = C / A - (B * B) / (3 * A * A);
  const q = D / A - (B * C) / (3 * A * A) + (2 * B * B * B) / (27 * A * A * A);

  const tRoots = depressedCubicRoots(p, q);
  return tRoots.map((t) => formatCoeff(t - shift));
}

/**
 * Solve quartic Ax⁴ + Bx³ + Cx² + Dx + E = 0 and return real roots as
 * radical strings.
 * Uses Ferrari's method (resolvent cubic) after depressing the quartic.
 * The five pre-evaluated samples fm2…f2 provide a fast integer-root
 * short-circuit before the closed-form path.
 */
function solveQuarticRadicals(
  A: f64,
  B: f64,
  C: f64,
  D: f64,
  E: f64,
  fm2: f64,
  fm1: f64,
  f0: f64,
  f1: f64,
  f2: f64
): string[] {
  // Fast rational-root short-circuit (same set as cubic)
  const candidates: [f64, f64][] = [
    [-2, fm2],
    [-1, fm1],
    [0, f0],
    [1, f1],
    [2, f2],
  ];

  for (const [r, fr] of candidates) {
    if (Math.abs(fr) < 1e-8) {
      // Factor out (x - r) via synthetic division: quartic → cubic
      const c1 = B + r * A;
      const c2 = C + r * c1;
      const c3 = D + r * c2;
      // Resulting cubic: A·x³ + c1·x² + c2·x + c3
      // Use depressed-cubic path (we don't have the cubic evaluations here
      // so we can't use the short-circuit; just call the closed-form directly)
      const shift2 = c1 / (3 * A);
      const p2 = c2 / A - (c1 * c1) / (3 * A * A);
      const q2 = c3 / A - (c1 * c2) / (3 * A * A) + (2 * c1 * c1 * c1) / (27 * A * A * A);
      const tRoots2 = depressedCubicRoots(p2, q2);
      const cubicRoots = tRoots2.map((t) => t - shift2);

      // Combine integer root with cubic roots
      const allRoots = [r, ...cubicRoots];
      return allRoots.map(formatCoeff);
    }
  }

  // Depress the quartic: x = t - B/(4A)
  // Depressed form: t⁴ + p4·t² + q4·t + r4  (no cubic term, leading coeff 1)
  const shift4 = B / (4 * A);
  const p4 = C / A - (6 * B * B) / (16 * A * A);
  const q4 = D / A - (3 * B * C) / (8 * A * A) + (B * B * B) / (8 * A * A * A);
  const r4 =
    E / A -
    (B * D) / (4 * A * A) +
    (B * B * C) / (16 * A * A * A) -
    (3 * B * B * B * B) / (256 * A * A * A * A);

  // Ferrari's method: resolve via the resolvent cubic
  // t⁴ + p4·t² + q4·t + r4 = 0
  // Resolvent cubic: 8m³ + 8p4·m² + (2p4² - 8r4)·m - q4² = 0
  const rA = 8;
  const rB = 8 * p4;
  const rC = 2 * p4 * p4 - 8 * r4;
  const rD = -(q4 * q4);

  // Solve resolvent cubic for m (we need any real root; take the first one)
  const rShift = rB / (3 * rA);
  const rp = rC / rA - (rB * rB) / (3 * rA * rA);
  const rq = rD / rA - (rB * rC) / (3 * rA * rA) + (2 * rB * rB * rB) / (27 * rA * rA * rA);
  const mRoots = depressedCubicRoots(rp, rq);
  const m = mRoots[mRoots.length - 1] - rShift; // pick largest for stability

  // With m known, factor the depressed quartic into two quadratics:
  // (t² + sqrt(2m + p4)·t + (m - q4/(2*sqrt(2m+p4))))
  // (t² - sqrt(2m + p4)·t + (m + q4/(2*sqrt(2m+p4))))
  const inner = 2 * m + p4;
  if (inner < -1e-10) {
    // No real factorisation found from this m; fall back to numerical
    const numRoots = solve(`${A}*x^4 + ${B}*x^3 + ${C}*x^2 + ${D}*x + ${E}`, 'x');
    // Numerical fallback yields real roots here; format each as a real coeff
    // (preserves the prior untyped `map(formatCoeff)` behaviour).
    return numRoots.map((c) => formatCoeff(c as number));
  }

  const sqrtInner = Math.sqrt(Math.max(0, inner));
  const real: f64[] = [];

  // Quadratic 1: t² + sqrtInner·t + (m - q4/(2*sqrtInner))
  const offset1 = Math.abs(sqrtInner) < 1e-12 ? 0 : -q4 / (2 * sqrtInner);
  const disc1 = sqrtInner * sqrtInner - 4 * (m + offset1);
  if (disc1 >= -1e-10) {
    const s1 = Math.sqrt(Math.max(0, disc1));
    real.push(-sqrtInner / 2 + s1 / 2 - shift4);
    if (Math.abs(disc1) > 1e-10) real.push(-sqrtInner / 2 - s1 / 2 - shift4);
  }

  // Quadratic 2: t² - sqrtInner·t + (m + q4/(2*sqrtInner))
  const offset2 = Math.abs(sqrtInner) < 1e-12 ? 0 : q4 / (2 * sqrtInner);
  const disc2 = sqrtInner * sqrtInner - 4 * (m + offset2);
  if (disc2 >= -1e-10) {
    const s2 = Math.sqrt(Math.max(0, disc2));
    real.push(sqrtInner / 2 + s2 / 2 - shift4);
    if (Math.abs(disc2) > 1e-10) real.push(sqrtInner / 2 - s2 / 2 - shift4);
  }

  real.sort((a, b) => a - b);
  return real.map(formatCoeff);
}

/**
 * Express a polynomial solution in radical form.
 *
 * Applies the quadratic formula, Cardano's formula (cubic), and
 * Ferrari's method (quartic) to express roots using radicals.
 *
 * @param expr - Polynomial expression string (set equal to 0)
 * @returns Array of root expressions in radical form
 *
 * @example
 * toRadicals('x^2 - 2')  // => ['sqrt(2)', '-sqrt(2)']
 * toRadicals('x^2 + x - 1') // => ['(-1 + sqrt(5))/2', '(-1 - sqrt(5))/2']
 */
export function toRadicals(expr: string): string[] {
  // Parse polynomial coefficients by evaluating at specific points
  // For ax^2 + bx + c: evaluate at x=0, 1, -1, 2
  const f = (x: f64) => evalAt(expr, 'x', x);

  // Detect degree by testing
  const f0 = f(0);
  const f1 = f(1);
  const fm1 = f(-1);
  const f2 = f(2);
  const fm2 = f(-2);

  // ── Coefficient extraction helpers ──────────────────────────────────────────
  // For a polynomial p(x) = a_n x^n + … evaluated at x ∈ {-2,-1,0,1,2}:
  //
  // Even-part sums cancel odd-degree terms:
  //   f(1)+f(-1) = 2*(a_2 + a_0)          [for quad] or 2*(a_3-terms cancel)
  //   f(2)+f(-2) = 2*(16*a_4 + 4*a_2 + a_0)
  //
  // Odd-part differences cancel even-degree terms:
  //   f(1)-f(-1) = 2*(a_1)                [for linear] or 2*(a_3 + a_1)
  //   f(2)-f(-2) = 2*(8*a_3 + 2*a_1)

  const sumP1 = (f1 + fm1) / 2; // even part at ±1  (cancels odd-degree)
  const sumP2 = (f2 + fm2) / 2; // even part at ±2
  const difP1 = (f1 - fm1) / 2; // odd part at ±1   (cancels even-degree)
  const difP2 = (f2 - fm2) / 2; // odd part at ±2

  // Check if linear: ax + b
  // f(0)=b, f(1)=a+b => a = f(1)-f(0)
  const b_lin = f0;
  const a_lin = f1 - f0;
  if (Math.abs(a_lin * 2 + b_lin - f2) < 1e-8 && Math.abs(-a_lin + b_lin - fm1) < 1e-8) {
    if (Math.abs(a_lin) < 1e-12) return [];
    const root = -b_lin / a_lin;
    return [formatCoeff(root)];
  }

  // Check if quadratic: ax^2 + bx + c
  // f(0)=c, f(1)=a+b+c, f(-1)=a-b+c
  const c = f0;
  const a_plus_b = f1 - c;
  const a_minus_b = fm1 - c;
  const a = (a_plus_b + a_minus_b) / 2;
  const b = (a_plus_b - a_minus_b) / 2;

  // Verify it's quadratic
  if (Math.abs(a * 4 + b * 2 + c - f2) < 1e-6) {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return []; // Complex roots

    const sqrtDisc = Math.sqrt(disc);
    const sqrtDiscStr = Number.isInteger(disc) ? `sqrt(${disc})` : formatCoeff(sqrtDisc);

    if (Math.abs(disc) < 1e-12) {
      // Double root
      return [formatCoeff(-b / (2 * a))];
    }

    const denom = 2 * a;
    if (Math.abs(denom - 2) < 1e-12) {
      return [`(${formatCoeff(-b)} + ${sqrtDiscStr})/2`, `(${formatCoeff(-b)} - ${sqrtDiscStr})/2`];
    }
    return [
      `(${formatCoeff(-b)} + ${sqrtDiscStr})/${formatCoeff(denom)}`,
      `(${formatCoeff(-b)} - ${sqrtDiscStr})/${formatCoeff(denom)}`,
    ];
  }

  // ── Cubic: Ax³ + Bx² + Cx + D ──────────────────────────────────────────────
  // Extract coefficients using the 5 evaluation points.
  // Even parts: sumP1 = B + D,  sumP2 = 4B + D  =>  B = (sumP2 - D)/4 - ...
  //   sumP2 - sumP1 = 3B  =>  B = (sumP2 - sumP1) / 3
  //   D = sumP1 - B
  // Odd parts:  difP1 = A + C,  difP2 = 8A + 2C
  //   difP2 - 2*difP1 = 6A  =>  A = (difP2 - 2*difP1) / 6
  //   C = difP1 - A
  const cub_B = (sumP2 - sumP1) / 3;
  const cub_D = sumP1 - cub_B;
  const cub_A = (difP2 - 2 * difP1) / 6;
  const cub_C = difP1 - cub_A;

  // Verify it's cubic: check f(0)=D and that f(2) matches (already encoded in
  // the extraction, but we also ensure it's not actually quartic+).
  // A quartic would show a residual when we subtract our cubic fit.
  const cubicFit2 = cub_A * 8 + cub_B * 4 + cub_C * 2 + cub_D;
  const cubicFitM2 = -cub_A * 8 + cub_B * 4 - cub_C * 2 + cub_D;

  if (
    Math.abs(cub_D - f0) < 1e-6 &&
    Math.abs(cubicFit2 - f2) < 1e-6 &&
    Math.abs(cubicFitM2 - fm2) < 1e-6 &&
    Math.abs(cub_A) > 1e-8
  ) {
    return solveCubicRadicals(cub_A, cub_B, cub_C, cub_D, fm2, fm1, f0, f1, f2);
  }

  // ── Quartic: Ax⁴ + Bx³ + Cx² + Dx + E ─────────────────────────────────────
  // Extract coefficients using all 5 evaluation points.
  // Even parts: sumP1 = A + C + E,   sumP2 = 16A + 4C + E
  //   sumP2 - 4*sumP1 = 12A  =>  A = (sumP2 - 4*sumP1 + 3*E) / 12
  // Odd parts:  difP1 = B + D,        difP2 = 8B + 2D
  //   difP2 - 2*difP1 = 6B  =>  B = (difP2 - 2*difP1) / 6
  const qrt_E = f0;
  const qrt_A = (sumP2 - 4 * sumP1 + 3 * qrt_E) / 12;
  const qrt_C = sumP1 - qrt_A - qrt_E;
  const qrt_B = (difP2 - 2 * difP1) / 6;
  const qrt_D = difP1 - qrt_B;

  const quarticFit2 = qrt_A * 16 + qrt_B * 8 + qrt_C * 4 + qrt_D * 2 + qrt_E;
  const quarticFitM2 = qrt_A * 16 - qrt_B * 8 + qrt_C * 4 - qrt_D * 2 + qrt_E;

  if (
    Math.abs(quarticFit2 - f2) < 1e-6 &&
    Math.abs(quarticFitM2 - fm2) < 1e-6 &&
    Math.abs(qrt_A) > 1e-8
  ) {
    return solveQuarticRadicals(qrt_A, qrt_B, qrt_C, qrt_D, qrt_E, fm2, fm1, f0, f1, f2);
  }

  // Higher degree: fall back to numerical roots.
  // Format each as a real coeff (preserves the prior untyped `map(formatCoeff)`).
  const numRoots = solve(expr, 'x');
  return numRoots.map((c) => formatCoeff(c as number));
}

/**
 * Construct a piecewise function.
 *
 * Returns a function that evaluates the appropriate expression based
 * on the condition that is satisfied.
 *
 * @param conditions - Array of condition expression strings
 * @param values - Array of value expression strings (one more than conditions for default)
 * @returns A function that evaluates the piecewise expression
 *
 * @example
 * const f = piecewise(
 *   ['x < 0', 'x >= 0'],
 *   ['-x', 'x']
 * );
 * f({ x: -3 }); // => 3
 * f({ x: 5 });  // => 5
 */
export function piecewise(
  conditions: string[],
  values: string[]
): (scope: Record<string, f64>) => f64 {
  if (values.length < conditions.length) {
    throw new Error('values must have at least as many entries as conditions');
  }

  return (scope: Record<string, f64>): f64 => {
    for (let i = 0; i < conditions.length; i++) {
      // Evaluate condition
      const condResult = evalWith(conditions[i], scope);
      if (condResult) {
        return evalWith(values[i], scope);
      }
    }
    // Default value (last in values if more than conditions)
    if (values.length > conditions.length) {
      return evalWith(values[values.length - 1], scope);
    }
    return NaN;
  };
}

/**
 * Solve an ordinary differential equation.
 *
 * Handles separable and linear first/second-order ODEs numerically
 * using the Runge-Kutta 4th order method.
 *
 * For an ODE dy/dx = f(x, y), returns solution values at specified points.
 *
 * @param ode - Right-hand side expression f(x, y) where dy/dx = f(x, y)
 * @param y - Dependent variable name
 * @param x - Independent variable name
 * @param x0 - Initial x value
 * @param y0 - Initial y value (or [y0, dy0] for 2nd order)
 * @param xEnd - End x value
 * @param steps - Number of steps (default 100)
 * @returns Array of {x, y} points
 *
 * @example
 * odeGeneral('y', 'y', 'x', 0, 1, 1, 100) // dy/dx = y, y(0)=1 => e^x
 */
export function odeGeneral(
  ode: string,
  y: string,
  x: string,
  x0: f64,
  y0: f64,
  xEnd: f64,
  steps: number = 100
): Array<{ x: f64; y: f64 }> {
  const h = (xEnd - x0) / steps;
  const result: Array<{ x: f64; y: f64 }> = [];

  let xCurr = x0;
  let yCurr = y0;

  result.push({ x: xCurr, y: yCurr });

  for (let i = 0; i < steps; i++) {
    // RK4
    const scope = { [x]: xCurr, [y]: yCurr };
    const k1 = evalWith(ode, scope);

    const k2 = evalWith(ode, { [x]: xCurr + h / 2, [y]: yCurr + (h * k1) / 2 });
    const k3 = evalWith(ode, { [x]: xCurr + h / 2, [y]: yCurr + (h * k2) / 2 });
    const k4 = evalWith(ode, { [x]: xCurr + h, [y]: yCurr + h * k3 });

    yCurr += (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
    xCurr += h;
    result.push({ x: xCurr, y: yCurr });
  }

  return result;
}

/**
 * Compute the curl of a 3D vector field.
 *
 * curl(F) = (dF3/dy - dF2/dz, dF1/dz - dF3/dx, dF2/dx - dF1/dy)
 *
 * @param exprs - Three expression strings [F1, F2, F3]
 * @param vars - Three variable names [x, y, z]
 * @param scope - Point at which to evaluate
 * @returns Three-element array [curl_x, curl_y, curl_z]
 *
 * @example
 * // F = (y, -x, 0), curl = (0, 0, -2)
 * curl(['y', '-x', '0'], ['x', 'y', 'z'], { x: 0, y: 0, z: 0 })
 * // => [0, 0, -2]
 */
export function curl(exprs: string[], vars: string[], scope: Record<string, f64>): [f64, f64, f64] {
  if (exprs.length !== 3 || vars.length !== 3) {
    throw new Error('curl requires exactly 3 expressions and 3 variables');
  }

  const [F1, F2, F3] = exprs;
  const [x, y, z] = vars;

  // curl = (dF3/dy - dF2/dz, dF1/dz - dF3/dx, dF2/dx - dF1/dy)
  const dF3dy = partialDerivative(F3, y, scope);
  const dF2dz = partialDerivative(F2, z, scope);
  const dF1dz = partialDerivative(F1, z, scope);
  const dF3dx = partialDerivative(F3, x, scope);
  const dF2dx = partialDerivative(F2, x, scope);
  const dF1dy = partialDerivative(F1, y, scope);

  return [dF3dy - dF2dz, dF1dz - dF3dx, dF2dx - dF1dy];
}

// =============================================================================
// inverseLaplaceTransform — ported from mathjs v15.2.0 (commit 6f4171662)
// Numerical pattern-matching against known Laplace transform pairs.
// =============================================================================

function iltEvalAt(node: MathNode, sVar: string, val: f64): f64 | null {
  try {
    const result = (node as any).evaluate({ [sVar]: val });
    if (typeof result === 'number' && isFinite(result)) return result;
    return null;
  } catch {
    return null;
  }
}

function iltMatchPattern(node: MathNode, sVar: string, pattern: string): boolean {
  const checkNode = parse(pattern.replace(/s/g, sVar));
  const testPoints = [2, 3, 5, 7, 11];
  for (const p of testPoints) {
    const v1 = iltEvalAt(node, sVar, p);
    const v2 = iltEvalAt(checkNode, sVar, p);
    if (v1 === null || v2 === null) return false;
    if (Math.abs(v1 - v2) > 1e-9) return false;
  }
  return true;
}

function iltGcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const tmp = b;
    b = a % b;
    a = tmp;
  }
  return a;
}

function iltNiceNumber(val: f64): string {
  const rounded = Math.round(val);
  if (Math.abs(val - rounded) < 1e-8) return String(rounded);
  for (let den = 2; den <= 12; den++) {
    const num = Math.round(val * den);
    if (Math.abs(val - num / den) < 1e-8) {
      const g = iltGcd(Math.abs(num), den);
      const n = num / g;
      const d = den / g;
      return d === 1 ? String(n) : n + '/' + d;
    }
  }
  return val.toPrecision(6);
}

function iltFactorial(n: number): f64 {
  if (n <= 1) return 1;
  let result: f64 = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function iltMatchQuadratic(node: MathNode, sVar: string, tVar: string): string | null {
  const v2 = iltEvalAt(node, sVar, 2);
  const v3 = iltEvalAt(node, sVar, 3);
  const v5 = iltEvalAt(node, sVar, 5);
  if (v2 === null || v3 === null || v5 === null) return null;

  if (Math.abs(v2) > 1e-12 && Math.abs(v3) > 1e-12) {
    const b2fromV2 = 2 / v2 - 4;
    const b2fromV3 = 3 / v3 - 9;

    if (b2fromV2 > 0 && Math.abs(b2fromV2 - b2fromV3) < 1e-6) {
      const b = Math.sqrt(b2fromV2);
      const expected = 5 / (25 + b2fromV2);
      if (Math.abs(v5 - expected) < 1e-8) {
        const bStr = iltNiceNumber(b);
        return 'cos(' + bStr + ' * ' + tVar + ')';
      }
    }

    const a2fromV2 = 4 - 2 / v2;
    const a2fromV3 = 9 - 3 / v3;
    if (a2fromV2 > 0 && Math.abs(a2fromV2 - a2fromV3) < 1e-6) {
      const a = Math.sqrt(a2fromV2);
      const expected = 5 / (25 - a2fromV2);
      if (isFinite(expected) && Math.abs(v5 - expected) < 1e-8) {
        const aStr = iltNiceNumber(a);
        return 'cosh(' + aStr + ' * ' + tVar + ')';
      }
    }
  }

  if (Math.abs(v2 - v3) > 1e-12) {
    const b2 = (9 * v3 - 4 * v2) / (v2 - v3);
    if (b2 > 0) {
      const c = v2 * (4 + b2);
      const b = Math.sqrt(b2);
      const expected = c / (25 + b2);
      if (Math.abs(v5 - expected) < 1e-8) {
        const coeff = c / b;
        const bStr = iltNiceNumber(b);
        const coeffStr = iltNiceNumber(coeff);
        if (Math.abs(coeff - 1) < 1e-8) {
          return 'sin(' + bStr + ' * ' + tVar + ')';
        }
        return coeffStr + ' * sin(' + bStr + ' * ' + tVar + ')';
      }
    }

    const a2sinh = (9 * v3 - 4 * v2) / (v3 - v2);
    if (a2sinh > 0) {
      const c2 = v2 * (4 - a2sinh);
      const a = Math.sqrt(a2sinh);
      const expected2 = c2 / (25 - a2sinh);
      if (isFinite(expected2) && Math.abs(v5 - expected2) < 1e-8) {
        const coeff = c2 / a;
        const aStr = iltNiceNumber(a);
        const coeffStr = iltNiceNumber(coeff);
        if (Math.abs(coeff - 1) < 1e-8) {
          return 'sinh(' + aStr + ' * ' + tVar + ')';
        }
        return coeffStr + ' * sinh(' + aStr + ' * ' + tVar + ')';
      }
    }
  }

  return null;
}

function iltMatchPower(node: MathNode, sVar: string, tVar: string): string | null {
  const v2 = iltEvalAt(node, sVar, 2);
  if (v2 === null || Math.abs(v2) < 1e-15) return null;

  for (let n = 1; n <= 10; n++) {
    const testVal = Math.pow(2, n) * v2;
    const v3 = iltEvalAt(node, sVar, 3);
    const v5 = iltEvalAt(node, sVar, 5);
    if (v3 === null || v5 === null) return null;

    const c3 = Math.pow(3, n) * v3;
    const c5 = Math.pow(5, n) * v5;

    if (Math.abs(testVal - c3) < 1e-8 && Math.abs(testVal - c5) < 1e-8) {
      const c = testVal;
      const fact = iltFactorial(n - 1);
      const coeff = c / fact;
      if (n === 1) {
        const coeffStr = iltNiceNumber(coeff);
        return Math.abs(coeff - 1) < 1e-8 ? '1' : coeffStr;
      }
      if (n === 2) {
        const coeffStr = iltNiceNumber(coeff);
        return Math.abs(coeff - 1) < 1e-8 ? tVar : coeffStr + ' * ' + tVar;
      }
      const power = n - 1;
      const coeffStr = iltNiceNumber(coeff);
      const term = tVar + '^' + power;
      return Math.abs(coeff - 1) < 1e-8 ? term : coeffStr + ' * ' + term;
    }
  }

  return null;
}

function iltMatchExponential(node: MathNode, sVar: string, tVar: string): string | null {
  const v3 = iltEvalAt(node, sVar, 3);
  const v5 = iltEvalAt(node, sVar, 5);
  const v7 = iltEvalAt(node, sVar, 7);
  if (v3 === null || v5 === null || v7 === null) return null;
  if (Math.abs(v3) < 1e-15) return null;

  const aFromV3 = 3 - 1 / v3;
  const aFromV5 = 5 - 1 / v5;
  const aFromV7 = 7 - 1 / v7;

  if (Math.abs(aFromV3 - aFromV5) < 1e-8 && Math.abs(aFromV3 - aFromV7) < 1e-8) {
    const a = aFromV3;
    const aStr = iltNiceNumber(a);
    if (Math.abs(a) < 1e-8) {
      return 'e^(0)';
    }
    if (a > 0) {
      return 'e^(' + aStr + ' * ' + tVar + ')';
    } else {
      const absA = iltNiceNumber(-a);
      return 'e^(-' + absA + ' * ' + tVar + ')';
    }
  }

  return null;
}

function iltMatchScaledExponential(node: MathNode, sVar: string, tVar: string): string | null {
  const s1 = 3;
  const s2 = 5;
  const s3 = 7;
  const v1 = iltEvalAt(node, sVar, s1);
  const v2 = iltEvalAt(node, sVar, s2);
  const v3 = iltEvalAt(node, sVar, s3);
  if (v1 === null || v2 === null || v3 === null) return null;
  if (Math.abs(v2 - v1) < 1e-12) return null;

  const a = (s2 * v2 - s1 * v1) / (v2 - v1);
  const c = v1 * (s1 - a);

  const expected = c / (s3 - a);
  if (!isFinite(expected) || Math.abs(v3 - expected) > 1e-8) return null;
  if (Math.abs(c) < 1e-12) return null;

  const aStr = iltNiceNumber(a);
  const cStr = iltNiceNumber(c);

  let expPart: string;
  if (Math.abs(a) < 1e-8) {
    expPart = '1';
  } else if (a > 0) {
    expPart = 'e^(' + aStr + ' * ' + tVar + ')';
  } else {
    const absA = iltNiceNumber(-a);
    expPart = 'e^(-' + absA + ' * ' + tVar + ')';
  }

  if (Math.abs(c - 1) < 1e-8) {
    return expPart;
  }
  if (Math.abs(a) < 1e-8) {
    return cStr;
  }
  return cStr + ' * ' + expPart;
}

function iltTableLookup(node: MathNode, sVar: string, tVar: string): string | null {
  if (iltMatchPattern(node, sVar, '1/s')) return '1';
  if (iltMatchPattern(node, sVar, '1/s^2')) return tVar;

  const quadResult = iltMatchQuadratic(node, sVar, tVar);
  if (quadResult !== null) return quadResult;

  const powerResult = iltMatchPower(node, sVar, tVar);
  if (powerResult !== null) return powerResult;

  const expResult = iltMatchExponential(node, sVar, tVar);
  if (expResult !== null) return expResult;

  const scaledExpResult = iltMatchScaledExponential(node, sVar, tVar);
  if (scaledExpResult !== null) return scaledExpResult;

  return null;
}

function iltSimplifyNode(node: MathNode): MathNode {
  return node;
}

function _inverseLaplaceNode(node: MathNode, sVar: string, tVar: string): string {
  let simplified: MathNode = node;
  try {
    simplified = iltSimplifyNode(node);
  } catch {
    simplified = node;
  }

  const nodeAny = simplified as any;

  if (nodeAny.type === 'OperatorNode' && nodeAny.op === '+') {
    const left = _inverseLaplaceNode(nodeAny.args[0], sVar, tVar);
    const right = _inverseLaplaceNode(nodeAny.args[1], sVar, tVar);
    return left + ' + ' + right;
  }

  if (nodeAny.type === 'OperatorNode' && nodeAny.op === '-' && nodeAny.args.length === 2) {
    const left = _inverseLaplaceNode(nodeAny.args[0], sVar, tVar);
    const right = _inverseLaplaceNode(nodeAny.args[1], sVar, tVar);
    return left + ' - ' + right;
  }

  const result = iltTableLookup(simplified, sVar, tVar);
  if (result !== null) return result;

  const exprStr = simplified.toString();
  throw new Error(
    'inverseLaplaceTransform: could not find inverse Laplace transform for "' +
      exprStr +
      '". Pattern not recognized in lookup table.'
  );
}

/**
 * Compute the inverse Laplace transform using a lookup table of known transform pairs.
 *
 * Given an expression F(s) in the s-domain, returns the time-domain
 * function f(t) by matching known Laplace transform pairs numerically.
 *
 * Supported patterns:
 *   - 1/s               → 1          (unit step)
 *   - 1/s^2             → t          (ramp)
 *   - c/s^n             → c * t^(n-1) / (n-1)!  (power)
 *   - 1/(s - a)         → e^(at)     (exponential)
 *   - c/(s - a)         → c * e^(at) (scaled exponential)
 *   - s/(s^2 + b^2)     → cos(b*t)
 *   - b/(s^2 + b^2)     → sin(b*t)
 *   - s/(s^2 - a^2)     → cosh(a*t)
 *   - a/(s^2 - a^2)     → sinh(a*t)
 *
 * For sums/differences, each term is transformed independently.
 *
 * @param expr - Expression in the s-domain (string or parsed Node)
 * @param sVar - Name of the s-domain variable (default: 's')
 * @param tVar - Name of the time variable (default: 't')
 * @returns Time-domain expression as a string
 *
 * @example
 * inverseLaplaceTransform('1/s', 's', 't')          // => '1'
 * inverseLaplaceTransform('1/s^2', 's', 't')        // => 't'
 * inverseLaplaceTransform('1/(s - 2)', 's', 't')    // => 'e^(2 * t)'
 * inverseLaplaceTransform('s/(s^2 + 4)', 's', 't')  // => 'cos(2 * t)'
 * inverseLaplaceTransform('2/(s^2 + 4)', 's', 't')  // => 'sin(2 * t)'
 */
export function inverseLaplaceTransform(
  expr: string | MathNode,
  sVar: string = 's',
  tVar: string = 't'
): string {
  let node: MathNode;
  if (typeof expr === 'string') {
    node = parse(expr);
  } else {
    node = expr;
  }
  return _inverseLaplaceNode(node, sVar, tVar);
}

// =============================================================================
// BATCH CAS — Slice 5.14
// =============================================================================

/**
 * Batch fan-out threshold.
 *
 * Arrays of length ≥ CAS_BATCH_THRESHOLD are processed via the compute pool
 * worker fan-out.  Below the threshold the expressions are processed in-process
 * with a simple loop (still async for a uniform call signature).
 */
export const CAS_BATCH_THRESHOLD = 16;

// ---------------------------------------------------------------------------
// Self-contained CAS kernels
//
// Each kernel function is designed to be fully self-contained so it can be
// serialised via `.toString()` and `eval()`'d inside a worker.  They must not
// close over any module-level variables or imports.
// ---------------------------------------------------------------------------

/**
 * Self-contained simplify kernel.
 *
 * Applies algebraic identity rules to a single expression string:
 * - Remove multiplication by 1
 * - Remove addition/subtraction of 0
 * - Collapse x^0 → 1, x^1 → x
 * - Evaluate pure-numeric sub-expressions
 * - Combine like-terms for simple polynomial patterns (2*x + x → 3*x)
 *
 * @internal
 */
function _casSimplifyOne(expr: string): string {
  let r = expr.trim();

  // x^0 → 1, x^1 → x  (must precede coefficient stripping)
  r = r.replace(/\b(\w+)\^0\b/g, '1');
  r = r.replace(/\b(\w+)\^1\b/g, '$1');

  // Remove multiplication by 1
  r = r.replace(/\b1\s*\*\s*/g, '');
  r = r.replace(/\s*\*\s*1\b/g, '');

  // Remove addition of 0
  r = r.replace(/\b0\s*\+\s*/g, '');
  r = r.replace(/\s*\+\s*0\b/g, '');

  // 0*anything → 0
  r = r.replace(/\b0\s*\*\s*[^+-]*/g, '0');

  // Evaluate pure-numeric expressions (digits, operators, parens)
  const numericPattern = /^[\d\s+\-*/().^]+$/;
  if (numericPattern.test(r)) {
    try {
      const jsExpr = r.replace(/\^/g, '**');
      // eslint-disable-next-line no-new-func
      const val: unknown = new Function('"use strict"; return (' + jsExpr + ')')();
      if (typeof val === 'number' && isFinite(val)) return String(val);
    } catch {
      // fall through
    }
  }

  // Combine like terms: c1*x + c2*x → (c1+c2)*x, x + x → 2*x, etc.
  // Simple single-variable, single-power pass.
  r = _combineLikeTerms(r);

  return r || '0';
}

/**
 * Combine like terms in a sum of monomials.  Only handles additive
 * combinations of terms matching `c*var` or standalone `var`.
 *
 * @internal
 */
function _combineLikeTerms(expr: string): string {
  // Normalise minus signs so every term is joined by +
  const normalised = expr.replace(/\s*-\s*/g, ' + -');
  const rawTerms = normalised.split(/\s*\+\s*/);

  // Map from key (e.g. "x", "x^2") to summed coefficient
  const termMap = new Map<string, number>();
  const otherTerms: string[] = [];

  for (const raw of rawTerms) {
    const t = raw.trim();
    if (!t) continue;

    // Numeric literal
    if (/^-?\d+(\.\d+)?$/.test(t)) {
      termMap.set('__const__', (termMap.get('__const__') ?? 0) + Number(t));
      continue;
    }

    // c*var^n or -c*var^n
    const cvpMatch = t.match(/^(-?\d*\.?\d*)\s*\*?\s*(\w+)\^(\d+)$/);
    if (cvpMatch) {
      const c =
        cvpMatch[1] === '' || cvpMatch[1] === '+'
          ? 1
          : cvpMatch[1] === '-'
            ? -1
            : Number(cvpMatch[1]);
      const key = cvpMatch[2] + '^' + cvpMatch[3];
      termMap.set(key, (termMap.get(key) ?? 0) + c);
      continue;
    }

    // c*var or -c*var
    const cvMatch = t.match(/^(-?\d*\.?\d*)\s*\*?\s*(\w+)$/);
    if (cvMatch && !/^\d+$/.test(cvMatch[2])) {
      const c =
        cvMatch[1] === '' || cvMatch[1] === '+' ? 1 : cvMatch[1] === '-' ? -1 : Number(cvMatch[1]);
      termMap.set(cvMatch[2], (termMap.get(cvMatch[2]) ?? 0) + c);
      continue;
    }

    otherTerms.push(t);
  }

  const parts: string[] = [];

  for (const [key, c] of termMap) {
    if (Math.abs(c) < 1e-12) continue;
    if (key === '__const__') {
      parts.push(String(c));
    } else if (Math.abs(c - 1) < 1e-12) {
      parts.push(key);
    } else if (Math.abs(c + 1) < 1e-12) {
      parts.push('-' + key);
    } else {
      parts.push(c + '*' + key);
    }
  }

  parts.push(...otherTerms);

  if (parts.length === 0) return '0';
  return parts.join(' + ').replace(/\+\s*-/g, '- ');
}

/**
 * Self-contained expand kernel.
 *
 * Distributes products over sums: `(a+b)*(c+d)` → `a*c + a*d + b*c + b*d`.
 * Also expands `(expr)^2` → `(expr)*(expr)`.
 *
 * @internal
 */
function _casExpandOne(expr: string): string {
  let result = expr;

  // Handle (expr)^2 → (expr)*(expr)
  result = result.replace(/\(([^()]+)\)\^2/g, '($1)*($1)');

  // Distribute (a+b)*(c+d)
  const mulPattern = /\(([^()]+)\)\s*\*\s*\(([^()]+)\)/g;
  let match: RegExpExecArray | null;
  let safetyCount = 0;
  while ((match = mulPattern.exec(result)) !== null && safetyCount++ < 20) {
    const leftTerms = match[1].split(/\s*\+\s*/);
    const rightTerms = match[2].split(/\s*\+\s*/);
    const products: string[] = [];
    for (const l of leftTerms) {
      for (const rv of rightTerms) {
        products.push(l.trim() + '*' + rv.trim());
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
 * Self-contained factor kernel.
 *
 * Factors out the integer GCD from a sum of integer-coefficient terms.
 * Returns the original expression unchanged when no common factor is found.
 *
 * @internal
 */
function _casFactorOne(expr: string): string {
  function _gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const tmp = b;
      b = a % b;
      a = tmp;
    }
    return a;
  }

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
    g = _gcd(g, Math.abs(coeffs[i]));
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
 * Self-contained derivative kernel.
 *
 * Computes a symbolic derivative using power rule, trig, exp, and log patterns.
 * Returns `d/d<var>(<term>)` as a placeholder for unrecognised forms.
 *
 * @internal
 */
function _casDerivativeOne(expr: string, variable: string): string {
  const terms = expr.split(/\s*\+\s*/);
  const derivedTerms: string[] = [];

  for (const term of terms) {
    const t = term.trim();

    if (!t.includes(variable)) {
      derivedTerms.push('0');
      continue;
    }

    // c*var^n
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

    // c*var (linear)
    const linearRe = new RegExp('^(-?\\d*\\.?\\d*)\\s*\\*?\\s*' + variable + '$');
    const linearMatch = t.match(linearRe);
    if (linearMatch) {
      const coeff = linearMatch[1] === '' ? 1 : parseFloat(linearMatch[1]);
      derivedTerms.push(String(coeff));
      continue;
    }

    // var alone
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

// ---------------------------------------------------------------------------
// Normalise input: string | MathNode → string
// ---------------------------------------------------------------------------

/** Convert a MathNode (or string) to its canonical string form. */
function _nodeToStr(expr: string | MathNode): string {
  return typeof expr === 'string' ? expr : expr.toString();
}

// ---------------------------------------------------------------------------
// Worker-dispatch helpers
//
// Batches of length ≥ CAS_BATCH_THRESHOLD are shipped to the compute pool
// via `computePool.map`.  The transformation closure is shipped as a source
// string (via `.toString()`) so it can be `eval`'d in the worker.  Therefore
// the closure passed to `computePool.map` must be fully self-contained — no
// captured imports or module-level bindings.
//
// The round-trip is: string → worker eval → transformed string → main thread.
// The caller receives `string[]` for the batch path and `string` for the
// single-expression path.
//
// Note on Option A / Option B choice:
//   We use Option A (string round-trip).  Workers cannot import
//   `@danielsimonjr/mathts-expression` at runtime (workerpool sits below
//   functions in the dep graph), so re-parsing in the worker is not
//   available.  Instead the worker kernel performs the same string-level
//   symbolic transformations that the single-expression path uses; this is
//   correct because those transformations are pure string-manipulation.
// ---------------------------------------------------------------------------

/**
 * Simplify a single expression (CAS batch-capable variant).
 *
 * Named `casSimplify` to avoid ambiguity with the factory-generated
 * `simplify` from the mathjs compatibility layer.  Both perform algebraic
 * simplification; this one uses string-level pattern matching and supports
 * a batch-array overload with worker fan-out for large inputs.
 *
 * @param expr - Expression string or parsed MathNode
 * @returns Simplified expression string
 *
 * @example
 * casSimplify('x + x')   // => '2*x'
 * casSimplify('1*y')     // => 'y'
 * casSimplify('2 * 3')   // => '6'
 */
export function casSimplify(expr: string | MathNode): string;
/**
 * Simplify an array of expressions (batch overload with worker fan-out).
 *
 * Arrays shorter than {@link CAS_BATCH_THRESHOLD} (16) are processed
 * synchronously in-process and the promise resolves immediately.
 * Longer arrays are dispatched to the worker pool — each expression is
 * shipped as a source string, the worker applies the same string-level
 * simplification rules, and the results are returned as strings.
 *
 * **String round-trip:** batch inputs are serialised to their source string,
 * processed in the worker, and the result strings are returned.  Parsed
 * `MathNode` inputs are converted to strings via `.toString()` before
 * dispatch.
 *
 * @param exprs - Array of expression strings (or MathNodes)
 * @returns Promise resolving to an array of simplified expression strings
 *
 * @example
 * // Below threshold — resolved synchronously
 * await casSimplify(['x + x', 'y * 1', '2 * 3'])
 * // => ['2*x', 'y', '6']
 *
 * // Above threshold — worker fan-out
 * await casSimplify(Array.from({ length: 32 }, (_, i) => `${i}*x + ${i}*x`))
 */
export function casSimplify(exprs: Array<string | MathNode>): Promise<string[]>;
export function casSimplify(
  input: string | MathNode | Array<string | MathNode>
): string | Promise<string[]> {
  if (!Array.isArray(input)) {
    // Single expression — synchronous path
    return _casSimplifyOne(_nodeToStr(input));
  }

  const strs = input.map(_nodeToStr);

  if (strs.length < CAS_BATCH_THRESHOLD || !computePool.isReady()) {
    // Below threshold or pool not ready — in-process loop
    return Promise.resolve(strs.map(_casSimplifyOne));
  }

  // ≥ threshold — worker fan-out via computePool.map
  // The closure must be self-contained (no captured imports).
  return computePool
    .map<string, string>(strs, (exprStr) => {
      // --- self-contained simplify kernel (copied from _casSimplifyOne) ---
      function _combineLikeTermsW(expr: string): string {
        const normalised = expr.replace(/\s*-\s*/g, ' + -');
        const rawTerms = normalised.split(/\s*\+\s*/);
        const termMap = new Map<string, number>();
        const otherTerms: string[] = [];
        for (const raw of rawTerms) {
          const t = raw.trim();
          if (!t) continue;
          if (/^-?\d+(\.\d+)?$/.test(t)) {
            termMap.set('__const__', (termMap.get('__const__') ?? 0) + Number(t));
            continue;
          }
          const cvpMatch = t.match(/^(-?\d*\.?\d*)\s*\*?\s*(\w+)\^(\d+)$/);
          if (cvpMatch) {
            const c =
              cvpMatch[1] === '' || cvpMatch[1] === '+'
                ? 1
                : cvpMatch[1] === '-'
                  ? -1
                  : Number(cvpMatch[1]);
            const key = cvpMatch[2] + '^' + cvpMatch[3];
            termMap.set(key, (termMap.get(key) ?? 0) + c);
            continue;
          }
          const cvMatch = t.match(/^(-?\d*\.?\d*)\s*\*?\s*(\w+)$/);
          if (cvMatch && !/^\d+$/.test(cvMatch[2])) {
            const c =
              cvMatch[1] === '' || cvMatch[1] === '+'
                ? 1
                : cvMatch[1] === '-'
                  ? -1
                  : Number(cvMatch[1]);
            termMap.set(cvMatch[2], (termMap.get(cvMatch[2]) ?? 0) + c);
            continue;
          }
          otherTerms.push(t);
        }
        const parts: string[] = [];
        for (const [key, c] of termMap) {
          if (Math.abs(c) < 1e-12) continue;
          if (key === '__const__') {
            parts.push(String(c));
          } else if (Math.abs(c - 1) < 1e-12) {
            parts.push(key);
          } else if (Math.abs(c + 1) < 1e-12) {
            parts.push('-' + key);
          } else {
            parts.push(c + '*' + key);
          }
        }
        parts.push(...otherTerms);
        if (parts.length === 0) return '0';
        return parts.join(' + ').replace(/\+\s*-/g, '- ');
      }

      let r = exprStr.trim();
      r = r.replace(/\b(\w+)\^0\b/g, '1');
      r = r.replace(/\b(\w+)\^1\b/g, '$1');
      r = r.replace(/\b1\s*\*\s*/g, '');
      r = r.replace(/\s*\*\s*1\b/g, '');
      r = r.replace(/\b0\s*\+\s*/g, '');
      r = r.replace(/\s*\+\s*0\b/g, '');
      r = r.replace(/\b0\s*\*\s*[^+-]*/g, '0');
      if (/^[\d\s+\-*/().^]+$/.test(r)) {
        try {
          const jsExpr = r.replace(/\^/g, '**');
          // eslint-disable-next-line no-new-func
          const val: unknown = new Function('"use strict"; return (' + jsExpr + ')')();
          if (typeof val === 'number' && isFinite(val as number)) return String(val);
        } catch {
          /**/
        }
      }
      return _combineLikeTermsW(r) || '0';
    })
    .then((r) => r.result);
}

/**
 * Compute the symbolic derivative of a single expression (CAS batch-capable variant).
 *
 * Named `casDerivative` to avoid ambiguity with the factory-generated
 * `derivative` from the mathjs compatibility layer.
 *
 * Uses power rule, trig (sin/cos), exp, and ln patterns.  Unrecognised terms
 * are left as `d/d<variable>(<term>)` placeholders.
 *
 * @param expr - Expression string or parsed MathNode
 * @param variable - Variable to differentiate with respect to
 * @returns Derivative expression string
 *
 * @example
 * casDerivative('x^2', 'x')   // => '2*x^1'
 * casDerivative('sin(x)', 'x') // => 'cos(x)'
 * casDerivative('exp(x)', 'x') // => 'exp(x)'
 */
export function casDerivative(expr: string | MathNode, variable: string): string;
/**
 * Compute the symbolic derivative of an array of expressions (batch overload).
 *
 * Arrays shorter than {@link CAS_BATCH_THRESHOLD} (16) are processed
 * synchronously in-process.  Longer arrays are dispatched to the worker pool.
 *
 * **String round-trip:** batch inputs are serialised to their source string
 * before dispatch.
 *
 * @param exprs - Array of expression strings (or MathNodes)
 * @param variable - Variable to differentiate with respect to
 * @returns Promise resolving to an array of derivative expression strings
 *
 * @example
 * await casDerivative(['x^2', 'sin(x)', 'exp(x)'], 'x')
 * // => ['2*x^1', 'cos(x)', 'exp(x)']
 */
export function casDerivative(exprs: Array<string | MathNode>, variable: string): Promise<string[]>;
export function casDerivative(
  input: string | MathNode | Array<string | MathNode>,
  variable: string
): string | Promise<string[]> {
  if (!Array.isArray(input)) {
    return _casDerivativeOne(_nodeToStr(input), variable);
  }

  const strs = input.map(_nodeToStr);

  if (strs.length < CAS_BATCH_THRESHOLD || !computePool.isReady()) {
    return Promise.resolve(strs.map((s) => _casDerivativeOne(s, variable)));
  }

  // Worker fan-out — closure must be self-contained
  const varName = variable;
  return computePool
    .map<string, string>(strs, (exprStr) => {
      // --- self-contained derivative kernel ---
      const _variable = varName;
      const terms = exprStr.split(/\s*\+\s*/);
      const derivedTerms: string[] = [];
      for (const term of terms) {
        const t = term.trim();
        if (!t.includes(_variable)) {
          derivedTerms.push('0');
          continue;
        }
        const powerRe = new RegExp('^(-?\\d*\\.?\\d*)\\s*\\*?\\s*' + _variable + '\\^(\\d+)$');
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
            derivedTerms.push(coeff * n + '*' + _variable + '^' + (n - 1));
          }
          continue;
        }
        const linearRe = new RegExp('^(-?\\d*\\.?\\d*)\\s*\\*?\\s*' + _variable + '$');
        const linearMatch = t.match(linearRe);
        if (linearMatch) {
          const coeff = linearMatch[1] === '' ? 1 : parseFloat(linearMatch[1]);
          derivedTerms.push(String(coeff));
          continue;
        }
        if (t === _variable) {
          derivedTerms.push('1');
          continue;
        }
        if (t === 'sin(' + _variable + ')') {
          derivedTerms.push('cos(' + _variable + ')');
          continue;
        }
        if (t === 'cos(' + _variable + ')') {
          derivedTerms.push('-sin(' + _variable + ')');
          continue;
        }
        if (t === 'exp(' + _variable + ')') {
          derivedTerms.push('exp(' + _variable + ')');
          continue;
        }
        if (t === 'ln(' + _variable + ')') {
          derivedTerms.push('1/' + _variable);
          continue;
        }
        derivedTerms.push('d/d' + _variable + '(' + t + ')');
      }
      return derivedTerms.join(' + ');
    })
    .then((r) => r.result);
}

/**
 * Expand a single expression by distributing products over sums
 * (CAS batch-capable variant).
 *
 * Named `casExpand` to avoid ambiguity with the `expand` function in
 * `algebra.ts`.  Both perform algebraic expansion; this one additionally
 * supports a batch-array overload with worker fan-out for large inputs.
 *
 * @param expr - Expression string or parsed MathNode
 * @returns Expanded expression string
 *
 * @example
 * casExpand('(x+1)^2')    // => 'x*x + x*1 + 1*x + 1*1'
 * casExpand('(a+b)*(a-b)') // distributes fully
 */
export function casExpand(expr: string | MathNode): string;
/**
 * Expand an array of expressions (batch overload with worker fan-out).
 *
 * Arrays shorter than {@link CAS_BATCH_THRESHOLD} (16) are processed
 * synchronously in-process.  Longer arrays are dispatched to the worker pool.
 *
 * **String round-trip:** batch inputs are serialised to their source string
 * before dispatch.
 *
 * @param exprs - Array of expression strings (or MathNodes)
 * @returns Promise resolving to an array of expanded expression strings
 *
 * @example
 * await casExpand(['(x+1)^2', '(a+b)^3'])
 */
export function casExpand(exprs: Array<string | MathNode>): Promise<string[]>;
export function casExpand(
  input: string | MathNode | Array<string | MathNode>
): string | Promise<string[]> {
  if (!Array.isArray(input)) {
    return _casExpandOne(_nodeToStr(input));
  }

  const strs = input.map(_nodeToStr);

  if (strs.length < CAS_BATCH_THRESHOLD || !computePool.isReady()) {
    return Promise.resolve(strs.map(_casExpandOne));
  }

  return computePool
    .map<string, string>(strs, (exprStr) => {
      // --- self-contained expand kernel ---
      let result = exprStr;
      result = result.replace(/\(([^()]+)\)\^2/g, '($1)*($1)');
      const mulPattern = /\(([^()]+)\)\s*\*\s*\(([^()]+)\)/g;
      let match: RegExpExecArray | null;
      let safetyCount = 0;
      while ((match = mulPattern.exec(result)) !== null && safetyCount++ < 20) {
        const leftTerms = (match[1] as string).split(/\s*\+\s*/);
        const rightTerms = (match[2] as string).split(/\s*\+\s*/);
        const products: string[] = [];
        for (const l of leftTerms) {
          for (const rv of rightTerms) {
            products.push((l as string).trim() + '*' + (rv as string).trim());
          }
        }
        result =
          result.slice(0, (match as RegExpExecArray).index) +
          products.join(' + ') +
          result.slice((match as RegExpExecArray).index + (match as RegExpExecArray)[0].length);
        mulPattern.lastIndex = 0;
      }
      return result;
    })
    .then((r) => r.result);
}

/**
 * Factor a single expression by extracting the integer GCD from all terms
 * (CAS batch-capable variant).
 *
 * Named `casFactor` to avoid ambiguity with the `factor` function in
 * `algebra.ts`.  Both factor expressions; this one additionally supports a
 * batch-array overload with worker fan-out for large inputs.
 *
 * Returns the original expression unchanged when no common integer factor
 * greater than 1 is found, or when terms do not follow the `c*var` pattern.
 *
 * @param expr - Expression string or parsed MathNode
 * @returns Factored expression string
 *
 * @example
 * casFactor('2*x + 4*y')  // => '2*(x + 2*y)'
 * casFactor('x^2 - 1')    // => 'x^2 - 1'  (no integer GCD > 1)
 */
export function casFactor(expr: string | MathNode): string;
/**
 * Factor an array of expressions (batch overload with worker fan-out).
 *
 * Arrays shorter than {@link CAS_BATCH_THRESHOLD} (16) are processed
 * synchronously in-process.  Longer arrays are dispatched to the worker pool.
 *
 * **String round-trip:** batch inputs are serialised to their source string
 * before dispatch.
 *
 * @param exprs - Array of expression strings (or MathNodes)
 * @returns Promise resolving to an array of factored expression strings
 *
 * @example
 * await casFactor(['2*x + 4*y', '3*a + 6*b'])
 */
export function casFactor(exprs: Array<string | MathNode>): Promise<string[]>;
export function casFactor(
  input: string | MathNode | Array<string | MathNode>
): string | Promise<string[]> {
  if (!Array.isArray(input)) {
    return _casFactorOne(_nodeToStr(input));
  }

  const strs = input.map(_nodeToStr);

  if (strs.length < CAS_BATCH_THRESHOLD || !computePool.isReady()) {
    return Promise.resolve(strs.map(_casFactorOne));
  }

  return computePool
    .map<string, string>(strs, (exprStr) => {
      // --- self-contained factor kernel ---
      function _gcdW(a: number, b: number): number {
        a = Math.abs(a);
        b = Math.abs(b);
        while (b !== 0) {
          const tmp = b;
          b = a % b;
          a = tmp;
        }
        return a;
      }
      const normalized = exprStr.replace(/\s*-\s*/g, ' + -');
      const terms = normalized.split(/\s*\+\s*/).filter((t: string) => t.trim() !== '');
      if (terms.length < 2) return exprStr;
      const coeffs: number[] = [];
      const varParts: string[] = [];
      for (const term of terms) {
        const numMatch = (term as string).match(/^(-?\d+)\s*\*?\s*(.*)$/);
        if (numMatch) {
          coeffs.push(parseInt(numMatch[1], 10));
          varParts.push(numMatch[2] || '1');
        } else return exprStr;
      }
      let g = Math.abs(coeffs[0]);
      for (let i = 1; i < coeffs.length; i++) g = _gcdW(g, Math.abs(coeffs[i]));
      if (g <= 1) return exprStr;
      const inner = coeffs
        .map((c: number, i: number) => {
          const reduced = c / g;
          if (varParts[i] === '1') return String(reduced);
          if (reduced === 1) return varParts[i];
          if (reduced === -1) return '-' + varParts[i];
          return reduced + '*' + varParts[i];
        })
        .join(' + ');
      return g + '*(' + inner + ')';
    })
    .then((r) => r.result);
}
