/**
 * Numerical Integration Functions
 *
 * Provides numerical integration (quadrature) methods:
 * - trapz: Trapezoidal rule
 * - simpson: Simpson's 1/3 rule
 * - gaussQuad: Gauss-Legendre quadrature (composite form for n ≥ 64 sub-intervals)
 * - romberg: Romberg integration (adaptive Richardson extrapolation)
 *
 * Every function here is synchronous except `parallelGaussQuad` and `parallelRomberg`.
 * - gaussQuad / romberg evaluate and sum on the calling thread.
 * - trapzF64 / simpsonF64 (a Float64Array of pre-computed values) sum with `pairwiseSum`
 *   at every size.
 *
 * Worker fan-out:
 * - parallelGaussQuad / parallelRomberg accept an optional `workerCount` option (default 1).
 *   When `workerCount > 1` and `totalPoints ≥ GAUSS_WORKER_THRESHOLD`, the
 *   integration domain is partitioned into `workerCount` equal sub-domains and
 *   one `integrateChunk` worker task is dispatched per sub-domain.  Each task
 *   stringifies the integrand closure and evaluates it inside the worker.
 *
 * **Closure-stringification contract:**
 * Only closures that are self-contained (no free variables referencing
 * outer scope) survive worker dispatch.  The heuristic in
 * `validateClosureSource` reads the parameter list of the function source and
 * tokenizes the source. It rejects any identifier that is not:
 *   - a declared parameter name (a plain name, a name with a default value,
 *     or a rest parameter),
 *   - the own name of a function expression (`function f(x){ return f(x - 1); }`),
 *   - a `Math` property access (`Math.*`),
 *   - a standard numeric literal keyword (`Infinity`, `NaN`), or
 *   - a keyword / punctuation.
 * An identifier is read with the Unicode rule (`ID_Start`, `ID_Continue`, `$`, `_`).
 * A non-ASCII name is accepted when an ASCII name in the same position is accepted.
 * `this`, `super` and `import` are not allowed: they have another binding in the worker.
 * Arrow functions (`x => x*x`, `(x) => x*x`) and classic function expressions
 * (`function(x){ return x*x; }`) both stringify cleanly.
 * Async closures, generators, methods and destructured parameters are rejected.
 *
 * These use plain exports (not mathTyped) because they accept function
 * arguments, which typed-function does not handle well.
 *
 * @packageDocumentation
 */

import { computePool } from '@danielsimonjr/mathts-parallel';
import { isDeterministic, pairwiseSum } from '@danielsimonjr/mathts-core';
import { numberVector } from './number-matrix.js';
import { assertLoopOrder } from '../utils/limits.js';
import { parameterName, readParameterList } from '../utils/function-source.js';

/** Largest sub-interval count that `gaussQuad` runs (n = 1e9 of a trivial `f` took 26.1 s). */
const MAX_GAUSS_QUAD_INTERVALS = 800_000_000;

// =============================================================================
// Thresholds
// =============================================================================

/** Minimum sub-interval count before gaussQuad / romberg offload the reduction. */
export const GAUSS_WORKER_THRESHOLD = 64;

/**
 * Former minimum array length before trapzF64 / simpsonF64 sent the summation to workers.
 * @deprecated trapzF64 and simpsonF64 are synchronous at every size and do not read it.
 */
export const ARRAY_WORKER_THRESHOLD = 65_536;

// =============================================================================
// Closure validation (Slice 5.10)
// =============================================================================

/**
 * Standard JS global identifiers allowed inside a worker-dispatched closure.
 *
 * The allow-list covers numeric literals, standard Math globals, and language
 * keywords / operators that appear as tokens in typical numeric expressions.
 * Any identifier NOT in this set (and NOT the declared parameter name) triggers
 * a rejection, protecting against silent closure-capture failures inside the
 * isolated worker context.
 */
const ALLOWED_GLOBALS = new Set([
  // numeric globals
  'Infinity',
  'NaN',
  'undefined',
  'Math',
  // common Math method names (accessed as Math.xxx — validated separately)
  'abs',
  'acos',
  'acosh',
  'asin',
  'asinh',
  'atan',
  'atan2',
  'atanh',
  'cbrt',
  'ceil',
  'clz32',
  'cos',
  'cosh',
  'exp',
  'expm1',
  'floor',
  'fround',
  'hypot',
  'imul',
  'log',
  'log10',
  'log1p',
  'log2',
  'max',
  'min',
  'pow',
  'random',
  'round',
  'sign',
  'sin',
  'sinh',
  'sqrt',
  'tan',
  'tanh',
  'trunc',
  'E',
  'LN10',
  'LN2',
  'LOG10E',
  'LOG2E',
  'PI',
  'SQRT1_2',
  'SQRT2',
  // JS keywords / control-flow tokens that appear in stringified functions.
  // `this`, `super`, `import` and `export` are absent: a closure that reads them has another
  // binding in the worker. `from` and `as` are absent too: a function body uses them as
  // ordinary names, never as keywords. `of` and `let` stay: a body can use them as keywords
  // (`for (x of [1, 2])`, a block-scoped `let x`), and removing them would add false rejections.
  'function',
  'return',
  'var',
  'let',
  'const',
  'if',
  'else',
  'for',
  'while',
  'do',
  'break',
  'continue',
  'true',
  'false',
  'null',
  'new',
  'typeof',
  'instanceof',
  'void',
  'delete',
  'in',
  'of',
  'throw',
  'try',
  'catch',
  'finally',
  'switch',
  'case',
  'default',
  'class',
]);

/**
 * Validate that a stringified function closure is safe to dispatch to a worker.
 *
 * The heuristic:
 * 1. Rejects async closures outright (they cannot be reconstructed portably).
 * 2. Reads the parameter list with `readParameterList`. It rejects a source whose list
 *    cannot be read, a method, a getter and a generator (the worker compiles the source as an
 *    expression, and a generator returns an iterator, not a number), and a destructured parameter.
 * 3. Takes the parameter names, a default value and a rest parameter included, and the own name
 *    of a function expression.
 * 4. Tokenizes the whole source (the defaults included) by extracting all bare identifiers
 *    (the Unicode rule), not preceded by a single dot: a property name is skipped, a spread is not.
 * 5. Rejects any identifier that is not one of those names, not in the ALLOWED_GLOBALS set,
 *    and not part of a numeric literal.
 *
 * It is a correctness guard, not a security boundary: the closure is the caller's own code and
 * runs with the caller's privileges.
 *
 * @param fnSource - Result of `f.toString()`
 * @throws Error when the closure references outer-scope identifiers, has a parameter pattern, or is async
 */
export function validateClosureSource(fnSource: string): void {
  // Reject async closures
  if (/\basync\b/.test(fnSource)) {
    throw new Error(
      'parallelGaussQuad/parallelRomberg workerCount fan-out: async closures cannot be dispatched to workers. ' +
        'Use a synchronous (x: number) => number function.'
    );
  }

  const list = readParameterList(fnSource);
  if (list === undefined) {
    throw new Error(
      'parallelGaussQuad/parallelRomberg workerCount fan-out: the closure parameter list cannot be read. ' +
        'Use an arrow function or a function expression with a closed parameter list.'
    );
  }
  if (list.kind === 'method' || list.generator) {
    throw new Error(
      'parallelGaussQuad/parallelRomberg workerCount fan-out: only an arrow function or a function expression can be dispatched, ' +
        'not a method, a getter or a generator.'
    );
  }

  // The names that the closure binds: its parameters and, for a function expression, its own name.
  const paramSet = new Set<string>();
  if (list.name !== undefined) paramSet.add(list.name);
  for (const entry of list.params) {
    const name = parameterName(entry);
    if (name === undefined) {
      throw new Error(
        `parallelGaussQuad/parallelRomberg workerCount fan-out: destructured parameters are not supported (${entry}). ` +
          'Use plain parameter names.'
      );
    }
    paramSet.add(name);
  }

  // Extract all bare identifiers (the Unicode rule), not preceded by a single dot. A property
  // name (`sin` of `Math.sin`, `x?.y`) is skipped. The identifier after `...` is kept: a spread
  // reads a name. The first look-behind keeps the scan out of a name, a number (`1e5`, `0xFF`,
  // `10n`, `1_000`) and a joiner.
  const identifiers = fnSource.matchAll(
    /(?<![\p{ID_Continue}$\u200C\u200D])(?<!(?<!\.)\.)[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*/gu
  );

  for (const match of identifiers) {
    const id = match[0];
    // Skip if it is a bound name or an allowed global
    if (paramSet.has(id) || ALLOWED_GLOBALS.has(id)) continue;
    throw new Error(
      `parallelGaussQuad/parallelRomberg workerCount fan-out: closure references outer-scope identifier ` +
        `"${id}", which is not available inside the isolated worker context. ` +
        `Only arithmetic, Math.* functions, and the parameter name are allowed. ` +
        `If you need outer variables, inline them as literal values in the closure body.`
    );
  }
}

// =============================================================================
// Gauss-Legendre nodes and weights (precomputed for order=2..5)
// =============================================================================

const GL_NODES: Record<number, number[]> = {
  2: [-0.5773502691896257, 0.5773502691896257],
  3: [-0.7745966692414834, 0, 0.7745966692414834],
  4: [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526],
  5: [-0.906179845938664, -0.5384693101056831, 0, 0.5384693101056831, 0.906179845938664],
};

const GL_WEIGHTS: Record<number, number[]> = {
  2: [1, 1],
  3: [0.5555555555555556, 0.8888888888888888, 0.5555555555555556],
  4: [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538],
  5: [
    0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665,
    0.2369268850561891,
  ],
};

// =============================================================================
// trapz - Trapezoidal Rule
// =============================================================================

/**
 * Numerical integration using the trapezoidal rule over a number array.
 *
 * @param y - Array of function values
 * @param x - Optional array of x-coordinates (defaults to uniform spacing h=1)
 * @returns Approximate integral
 *
 * @example
 * trapz([1, 2, 3], [0, 1, 2]) // => 4
 * trapz([0, 1, 0])             // => 1 (uniform spacing)
 */
export function trapz(y: number[], x?: number[]): number {
  numberVector('trapz', y);
  if (x) numberVector('trapz', x);
  if (y.length < 2) {
    throw new Error('trapz requires at least 2 data points');
  }
  if (x && x.length !== y.length) {
    throw new Error('x and y arrays must have the same length');
  }

  let sum = 0;
  if (!x) {
    // Uniform spacing (h = 1)
    for (let i = 1; i < y.length; i++) {
      sum += (y[i - 1] + y[i]) / 2;
    }
  } else {
    // Non-uniform spacing
    for (let i = 1; i < y.length; i++) {
      sum += ((y[i - 1] + y[i]) * (x[i] - x[i - 1])) / 2;
    }
  }
  return sum;
}

/**
 * Numerical integration using the trapezoidal rule over a Float64Array.
 *
 * Synchronous at every size. The trapezoidal terms are summed with `pairwiseSum`
 * (error O(log n) instead of O(n) for a naive loop).
 *
 * @param y  - Float64Array of function values (uniform spacing h=1 unless dx provided)
 * @param dx - Optional uniform step size (default 1)
 * @returns The approximate integral
 *
 * @example
 * trapzF64(new Float64Array([0, 1, 0])) // => 1
 */
export function trapzF64(y: Float64Array, dx = 1): number {
  const n = y.length;
  if (n < 2) {
    throw new Error('trapzF64 requires at least 2 data points');
  }

  // Build array of trapezoidal terms: (y[i-1] + y[i]) * dx / 2
  const terms = new Float64Array(n - 1);
  const halfDx = dx / 2;
  for (let i = 1; i < n; i++) {
    terms[i - 1] = (y[i - 1] + y[i]) * halfDx;
  }

  return pairwiseSum(terms);
}

// =============================================================================
// simpson - Simpson's 1/3 Rule
// =============================================================================

/**
 * Numerical integration using Simpson's 1/3 rule (function form).
 *
 * @param f - Function to integrate
 * @param a - Lower bound
 * @param b - Upper bound
 * @param n - Number of subintervals (must be even, default 100)
 * @returns Approximate integral
 *
 * @example
 * simpson(x => x ** 2, 0, 1) // => ~0.3333
 */
export function simpson(f: (x: number) => number, a: number, b: number, n: number = 100): number {
  if (n % 2 !== 0) {
    n += 1; // Simpson's rule requires even number of subintervals
  }
  const h = (b - a) / n;
  let sum = f(a) + f(b);

  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    sum += i % 2 === 0 ? 2 * f(x) : 4 * f(x);
  }

  return (h / 3) * sum;
}

/**
 * Numerical integration using Simpson's 1/3 rule over a pre-computed
 * Float64Array of uniformly-spaced function values.
 *
 * Synchronous at every size. The weighted terms are summed with `pairwiseSum`.
 *
 * @param y  - Float64Array of function values at uniform spacing
 * @param dx - Uniform step size (default 1)
 * @returns The approximate integral
 */
export function simpsonF64(y: Float64Array, dx = 1): number {
  const n = y.length - 1; // number of sub-intervals
  if (y.length < 3 || n % 2 !== 0) {
    throw new Error('simpsonF64 requires an odd number of points (even sub-intervals)');
  }

  // Build weighted terms array: each interior point contributes 2x or 4x
  const terms = new Float64Array(y.length);
  terms[0] = y[0];
  terms[y.length - 1] = y[y.length - 1];
  for (let i = 1; i < y.length - 1; i++) {
    terms[i] = (i % 2 === 0 ? 2 : 4) * y[i];
  }

  return (pairwiseSum(terms) * dx) / 3;
}

// =============================================================================
// gaussQuad - Gauss-Legendre Quadrature
// =============================================================================

/**
 * Single-interval Gauss-Legendre quadrature (sequential, 2–5 points).
 *
 * @internal
 */
function gaussQuadSerial(f: (x: number) => number, a: number, b: number, order: number): number {
  const nodes = GL_NODES[order];
  const weights = GL_WEIGHTS[order];
  const halfWidth = (b - a) / 2;
  const midpoint = (a + b) / 2;
  let sum = 0;
  for (let i = 0; i < order; i++) {
    sum += weights[i] * f(halfWidth * nodes[i] + midpoint);
  }
  return halfWidth * sum;
}

/**
 * Options for `parallelGaussQuad`.
 */
export interface GaussQuadOptions {
  /**
   * Number of sub-domain worker tasks.
   *
   * - `1` (default): no fan-out. The result is `gaussQuad(f, a, b, n, order)`.
   * - `> 1`: `parallelGaussQuad` divides `[a, b]` into `workerCount` equal
   *   sub-domains and sends one `integrateChunk` worker task for each sub-domain.
   *   The worker makes `f` again from `f.toString()` with an indirect `eval`.
   *
   * **Closure constraint:** The integrand must be a self-contained expression
   * (no references to outer-scope variables). Use `Math.*` methods and
   * arithmetic only. Async closures are rejected. See `validateClosureSource`.
   * Give `(x) => Math.sin(x)`, not `Math.sin`: the source of a built-in function is
   * `[native code]`, and the worker cannot rebuild the function.
   *
   * **Fall-back:** when `totalPoints < GAUSS_WORKER_THRESHOLD` or the pool is not
   * ready, `parallelGaussQuad` gives the synchronous `gaussQuad` result.
   *
   * The synchronous `gaussQuad` refuses `workerCount > 1` with a `TypeError`.
   */
  workerCount?: number;
}

/** Throw when a synchronous quadrature gets a worker fan-out option. */
function refuseWorkerCount(
  name: string,
  parallelName: string,
  options: { workerCount?: number }
): void {
  if ((options.workerCount ?? 1) > 1) {
    throw new TypeError(
      `${name} is synchronous and does not use workers. ` +
        `For workerCount > 1, call ${parallelName} (async) with the same options.`
    );
  }
}

/**
 * Numerical integration using Gauss-Legendre quadrature. The function is synchronous.
 *
 * When `n` is in [2, 5] the single-interval mode is used: `n` is the number of
 * GL quadrature points applied to [a, b].
 *
 * When `n` ≥ 6 the domain is split into `n` equal sub-intervals, each
 * integrated with a fixed-order GL rule (default order 5), on the calling thread.
 *
 * For worker threads, use `parallelGaussQuad` with `{ workerCount }`.
 *
 * @param f       - Function to integrate
 * @param a       - Lower bound
 * @param b       - Upper bound
 * @param n       - Number of quadrature points (2–5) OR number of sub-intervals (≥ 6)
 * @param order   - GL order to use per sub-interval when n ≥ 6 (default 5)
 * @param options - `{ workerCount }` is accepted only as 1. Use `parallelGaussQuad` for more.
 * @returns Approximate integral
 * @throws TypeError when `options.workerCount > 1`
 *
 * @example
 * gaussQuad(x => x ** 2, 0, 1, 3)          // => ~0.3333  (3-point GL, single interval)
 * gaussQuad(Math.sin, 0, Math.PI, 64)      // => ~2.0     (composite, 64 sub-intervals)
 */
export function gaussQuad(
  f: (x: number) => number,
  a: number,
  b: number,
  n: number = 5,
  order: number = 5,
  options: GaussQuadOptions = {}
): number {
  refuseWorkerCount('gaussQuad', 'parallelGaussQuad', options);
  if (Number.isNaN(n)) return NaN;

  // Single-interval mode
  if (n >= 2 && n <= 5) {
    return gaussQuadSerial(f, a, b, n);
  }

  if (n < 2) {
    throw new Error('gaussQuad requires n ≥ 2');
  }

  // Composite Gauss-Legendre: split [a, b] into n sub-intervals
  assertLoopOrder('gaussQuad', 'n', n, MAX_GAUSS_QUAD_INTERVALS);
  const clampedOrder = order >= 2 && order <= 5 ? order : 5;
  const nodes = GL_NODES[clampedOrder];
  const weights = GL_WEIGHTS[clampedOrder];
  const subWidth = (b - a) / n;
  const halfSub = subWidth / 2;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const midSub = a + i * subWidth + halfSub;
    for (let j = 0; j < clampedOrder; j++) {
      sum += f(halfSub * nodes[j] + midSub) * (weights[j] * halfSub);
    }
  }
  return sum;
}

/**
 * Gauss-Legendre quadrature with an optional worker fan-out. The function is async.
 *
 * With `{ workerCount: k }` (k > 1), `totalPoints = n * order ≥ GAUSS_WORKER_THRESHOLD`
 * and a ready pool, the function divides `[a, b]` into `k` equal sub-domains and sends
 * one worker task for each sub-domain. In all other cases it gives the synchronous
 * `gaussQuad(f, a, b, n, order)` result.
 *
 * The integrand `f` must obey the closure-stringification contract. See
 * `validateClosureSource` and the module-level JSDoc.
 *
 * @param f       - Function to integrate
 * @param a       - Lower bound
 * @param b       - Upper bound
 * @param n       - Number of quadrature points (2–5) OR number of sub-intervals (≥ 6)
 * @param order   - GL order to use per sub-interval when n ≥ 6 (default 5)
 * @param options - `{ workerCount }`
 * @returns Promise of the approximate integral
 *
 * @example
 * await parallelGaussQuad((x) => Math.sin(x), 0, Math.PI, 64, 5, { workerCount: 4 }) // => ~2.0
 */
export async function parallelGaussQuad(
  f: (x: number) => number,
  a: number,
  b: number,
  n: number = 5,
  order: number = 5,
  options: GaussQuadOptions = {}
): Promise<number> {
  const workerCount = options.workerCount ?? 1;
  const clampedOrder = order >= 2 && order <= 5 ? order : 5;
  const composite = n > 5;
  if (
    !isDeterministic() &&
    composite &&
    workerCount > 1 &&
    n * clampedOrder >= GAUSS_WORKER_THRESHOLD &&
    computePool.isReady()
  ) {
    // Validate the closure before sending it to the worker.
    validateClosureSource(f.toString());
    return computePool.integrateFanOut(
      f.toString(),
      a,
      b,
      workerCount,
      Array.from(GL_NODES[clampedOrder]),
      Array.from(GL_WEIGHTS[clampedOrder])
    );
  }
  return gaussQuad(f, a, b, n, order);
}

// =============================================================================
// romberg - Romberg Integration
// =============================================================================

/**
 * Options for `parallelRomberg`.
 */
export interface RombergOptions {
  /**
   * Number of sub-domain worker tasks.
   *
   * - `1` (default): no fan-out. The result is `romberg(f, a, b, tol)`.
   * - `> 1`: `parallelRomberg` divides `[a, b]` into `workerCount` equal
   *   sub-domains. A worker integrates each sub-domain with a 5-point GL rule.
   *
   * **Closure constraint:** Same as `GaussQuadOptions.workerCount`. See
   * `validateClosureSource`.
   *
   * **Fall-back:** when the pool is not ready, `parallelRomberg` gives the
   * synchronous `romberg` result.
   *
   * The synchronous `romberg` refuses `workerCount > 1` with a `TypeError`.
   */
  workerCount?: number;
}

/**
 * Romberg integration using Richardson extrapolation on the trapezoidal rule.
 * The function is synchronous.
 *
 * Adaptively refines the estimate until the desired tolerance is reached
 * or the maximum number of iterations (20) is exceeded.
 *
 * For worker threads, use `parallelRomberg` with `{ workerCount }`.
 *
 * @param f       - Function to integrate
 * @param a       - Lower bound
 * @param b       - Upper bound
 * @param tol     - Desired absolute tolerance (default 1e-12)
 * @param options - `{ workerCount }` is accepted only as 1. Use `parallelRomberg` for more.
 * @returns Approximate integral
 * @throws TypeError when `options.workerCount > 1`
 *
 * @example
 * romberg(Math.sin, 0, Math.PI) // => ~2.0
 */
export function romberg(
  f: (x: number) => number,
  a: number,
  b: number,
  tol: number = 1e-12,
  options: RombergOptions = {}
): number {
  refuseWorkerCount('romberg', 'parallelRomberg', options);

  const maxIter = 20;
  const R: number[][] = [];

  // R[0][0] = trapezoidal rule with 1 interval
  R[0] = [((b - a) * (f(a) + f(b))) / 2];

  for (let n = 1; n < maxIter; n++) {
    // Trapezoidal estimate with 2^n intervals.
    // New evaluation points: a + (2k-1)*h  for k = 1 .. 2^(n-1)
    const h = (b - a) / Math.pow(2, n);
    const newPointCount = Math.pow(2, n - 1);

    let partialSum = 0;
    for (let k = 1; k <= newPointCount; k++) {
      partialSum += f(a + (2 * k - 1) * h);
    }

    R[n] = [R[n - 1][0] / 2 + h * partialSum];

    // Richardson extrapolation
    for (let m = 1; m <= n; m++) {
      const factor = Math.pow(4, m);
      R[n][m] = (factor * R[n][m - 1] - R[n - 1][m - 1]) / (factor - 1);
    }

    // Check convergence
    if (Math.abs(R[n][n] - R[n - 1][n - 1]) < tol) {
      return R[n][n];
    }
  }

  return R[maxIter - 1][maxIter - 1];
}

/**
 * Romberg integration with an optional worker fan-out. The function is async.
 *
 * With `{ workerCount: k }` (k > 1) and a ready pool, the function divides `[a, b]` into
 * `k` equal sub-domains, and a worker integrates each one with a 5-point GL rule. That
 * path does not run the Romberg recursion. In all other cases it gives the synchronous
 * `romberg(f, a, b, tol)` result.
 *
 * @param f       - Function to integrate
 * @param a       - Lower bound
 * @param b       - Upper bound
 * @param tol     - Desired absolute tolerance (default 1e-12)
 * @param options - `{ workerCount }`
 * @returns Promise of the approximate integral
 *
 * @example
 * await parallelRomberg((x) => Math.sin(x), 0, Math.PI, 1e-12, { workerCount: 4 }) // => ~2.0
 */
export async function parallelRomberg(
  f: (x: number) => number,
  a: number,
  b: number,
  tol: number = 1e-12,
  options: RombergOptions = {}
): Promise<number> {
  if (!isDeterministic() && (options.workerCount ?? 1) > 1 && computePool.isReady()) {
    validateClosureSource(f.toString());
    return computePool.integrateFanOut(
      f.toString(),
      a,
      b,
      options.workerCount as number,
      Array.from(GL_NODES[5]),
      Array.from(GL_WEIGHTS[5])
    );
  }
  return romberg(f, a, b, tol);
}
