/**
 * Open (non-bracketing) scalar root-finders.
 *
 * Complements the bracketing `findRoot` (bisection/Brent, `../typed/numeric.ts`)
 * with classic open methods that iterate from a starting point (or two)
 * without requiring a sign-change bracket: Newton–Raphson, secant, and
 * Halley's method (cubic convergence).
 *
 * @packageDocumentation
 */

type f64 = number;
type i32 = number;

/** Central-difference step size: h = max(1, |x|) * cbrt(machine epsilon). */
const EPS_CBRT = Math.cbrt(2.220446049250313e-16);

function centralDiff1(f: (x: f64) => f64, x: f64): f64 {
  const h = Math.max(1, Math.abs(x)) * EPS_CBRT;
  return (f(x + h) - f(x - h)) / (2 * h);
}

function centralDiff2(f: (x: f64) => f64, x: f64): f64 {
  const h = Math.max(1, Math.abs(x)) * EPS_CBRT;
  return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
}

/**
 * Options for Newton's method.
 */
export interface NewtonOptions {
  /** Analytic derivative f'(x). If omitted, a central-difference estimate is used. */
  fprime?: (x: f64) => f64;
  /** Absolute tolerance for convergence (default 1e-12) */
  tol?: f64;
  /** Maximum iterations (default 100) */
  maxIter?: i32;
}

/**
 * Find a root of f(x) = 0 via Newton–Raphson iteration:
 * `x_{k+1} = x_k - f(x_k) / f'(x_k)`.
 *
 * If `opts.fprime` is not supplied, the derivative is estimated by a
 * central difference with step `h = max(1, |x|) * cbrt(eps)`.
 *
 * @param f - Function whose root is sought
 * @param x0 - Initial guess
 * @param opts - Options (fprime, tol, maxIter)
 * @returns Approximate root
 *
 * @example
 * newton(x => x ** 2 - 2, 1) // => ~1.4142135623730951
 */
export function newton(f: (x: f64) => f64, x0: f64, opts?: NewtonOptions): f64 {
  const fprime = opts?.fprime;
  const tol = opts?.tol ?? 1e-12;
  const maxIter = opts?.maxIter ?? 100;

  let x = x0;

  for (let iter = 0; iter < maxIter; iter++) {
    const fx = f(x);
    if (Math.abs(fx) < tol) return x;

    const dfx = fprime ? fprime(x) : centralDiff1(f, x);
    if (Math.abs(dfx) < 1e-300) {
      throw new Error('newton: derivative near zero — cannot continue');
    }

    const dx = fx / dfx;
    const xNext = x - dx;
    if (Math.abs(dx) < tol) return xNext;
    x = xNext;
  }

  throw new Error(`newton: failed to converge within ${maxIter} iterations`);
}

/**
 * Options for the secant method.
 */
export interface SecantOptions {
  /** Absolute tolerance for convergence (default 1e-12) */
  tol?: f64;
  /** Maximum iterations (default 100) */
  maxIter?: i32;
}

/**
 * Find a root of f(x) = 0 via the secant method:
 * `x_{k+1} = x_k - f(x_k) (x_k - x_{k-1}) / (f(x_k) - f(x_{k-1}))`.
 *
 * Requires no derivative, but two initial estimates.
 *
 * @param f - Function whose root is sought
 * @param x0 - First initial estimate
 * @param x1 - Second initial estimate
 * @param opts - Options (tol, maxIter)
 * @returns Approximate root
 *
 * @example
 * secant(x => x ** 2 - 2, 1, 2) // => ~1.4142135623730951
 */
export function secant(f: (x: f64) => f64, x0: f64, x1: f64, opts?: SecantOptions): f64 {
  const tol = opts?.tol ?? 1e-12;
  const maxIter = opts?.maxIter ?? 100;

  let xPrev = x0;
  let x = x1;
  let fPrev = f(xPrev);

  for (let iter = 0; iter < maxIter; iter++) {
    const fx = f(x);
    if (Math.abs(fx) < tol) return x;

    const denom = fx - fPrev;
    if (Math.abs(denom) < 1e-300) {
      throw new Error('secant: f(x_k) - f(x_{k-1}) near zero — cannot continue');
    }

    const dx = (fx * (x - xPrev)) / denom;
    const xNext = x - dx;
    if (Math.abs(dx) < tol) return xNext;

    xPrev = x;
    fPrev = fx;
    x = xNext;
  }

  throw new Error(`secant: failed to converge within ${maxIter} iterations`);
}

/**
 * Options for Halley's method.
 */
export interface HalleyOptions {
  /** Analytic first derivative f'(x). If omitted, estimated via central difference. */
  fprime?: (x: f64) => f64;
  /** Analytic second derivative f''(x). If omitted, estimated via central difference. */
  fprime2?: (x: f64) => f64;
  /** Absolute tolerance for convergence (default 1e-12) */
  tol?: f64;
  /** Maximum iterations (default 100) */
  maxIter?: i32;
}

/**
 * Find a root of f(x) = 0 via Halley's method (cubic convergence):
 * `x_{k+1} = x_k - 2 f f' / (2 f'^2 - f f'')`.
 *
 * If `opts.fprime` / `opts.fprime2` are not supplied, both derivatives are
 * estimated by central differences with step `h = max(1, |x|) * cbrt(eps)`.
 *
 * @param f - Function whose root is sought
 * @param x0 - Initial guess
 * @param opts - Options (fprime, fprime2, tol, maxIter)
 * @returns Approximate root
 *
 * @example
 * halley(x => x ** 3 - 2, 1) // => ~1.2599210498948732
 */
export function halley(f: (x: f64) => f64, x0: f64, opts?: HalleyOptions): f64 {
  const fprime = opts?.fprime;
  const fprime2 = opts?.fprime2;
  const tol = opts?.tol ?? 1e-12;
  const maxIter = opts?.maxIter ?? 100;

  let x = x0;

  for (let iter = 0; iter < maxIter; iter++) {
    const fx = f(x);
    if (Math.abs(fx) < tol) return x;

    const dfx = fprime ? fprime(x) : centralDiff1(f, x);
    const d2fx = fprime2 ? fprime2(x) : centralDiff2(f, x);

    const denom = 2 * dfx * dfx - fx * d2fx;
    if (Math.abs(denom) < 1e-300) {
      throw new Error('halley: denominator near zero — cannot continue');
    }

    const dx = (2 * fx * dfx) / denom;
    const xNext = x - dx;
    if (Math.abs(dx) < tol) return xNext;
    x = xNext;
  }

  throw new Error(`halley: failed to converge within ${maxIter} iterations`);
}
