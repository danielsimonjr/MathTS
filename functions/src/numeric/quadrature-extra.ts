/**
 * Additional quadrature rules and multiple integrals.
 *
 * - {@link tanhSinh}: double-exponential (tanh-sinh) quadrature. Handles
 *   endpoint singularities well. Abscissae are computed from the distance to
 *   the nearer endpoint, so the nodes stay strictly inside `(a, b)`.
 * - {@link clenshawCurtis}: Clenshaw–Curtis rule on Chebyshev extreme points.
 * - {@link dblquad} / {@link tplquad}: iterated adaptive integration built on
 *   {@link quad}. The argument order matches SciPy: `f(y, x)` and `f(z, y, x)`.
 *
 * Infinite limits are rejected with a `RangeError` in this version.
 *
 * @packageDocumentation
 */
import { quad, type QuadOptions, type QuadResult } from './adaptive-quad.js';

/** Options for {@link tanhSinh}. */
export interface TanhSinhOptions {
  /** Relative tolerance between successive levels (default 1e-12). */
  tol?: number;
  /** Maximum refinement level; level k uses step `2^{-k}` (default 10). */
  maxLevel?: number;
}

/** A limit that is either a constant or a function of the outer variables. */
export type Limit1 = number | ((x: number) => number);
/** A limit that is either a constant or a function of two outer variables. */
export type Limit2 = number | ((x: number, y: number) => number);

const TANH_SINH_T_MAX = 6;

function checkFiniteLimits(a: number, b: number, name: string): void {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new RangeError(`${name}: infinite limits are not supported`);
  }
}

/**
 * Tanh-sinh (double-exponential) quadrature of `f` over `[a, b]`.
 *
 * Substitution `x = m + h·tanh(π/2 · sinh t)` (`m` midpoint, `h` half-width),
 * trapezoid rule in `t` with step `2^{-k}`. Each level's error estimate is the
 * change from the previous level.
 *
 * @example
 * tanhSinh((x) => 1 / Math.sqrt(1 - x * x), -1, 1).value // ~π
 */
export function tanhSinh(
  f: (x: number) => number,
  a: number,
  b: number,
  opts: TanhSinhOptions = {}
): QuadResult {
  checkFiniteLimits(a, b, 'tanhSinh');
  if (a > b) {
    const r = tanhSinh(f, b, a, opts);
    return { ...r, value: -r.value };
  }
  const tol = opts.tol ?? 1e-12;
  const maxLevel = opts.maxLevel ?? 10;
  const half = 0.5 * (b - a);

  const levelSum = (h: number): number => {
    const N = Math.floor(TANH_SINH_T_MAX / h);
    let s = 0;
    for (let j = -N; j <= N; j++) {
      const t = j * h;
      const u = (Math.PI / 2) * Math.sinh(t);
      const cu = Math.cosh(u);
      const w = (half * ((Math.PI / 2) * Math.cosh(t))) / (cu * cu);
      if (!(w > 0) || !Number.isFinite(w)) continue;
      // Distance to the nearer endpoint, computed without cancellation.
      const e = 2 / (Math.exp(2 * Math.abs(u)) + 1);
      const d = half * e;
      const x = u >= 0 ? b - d : a + d;
      // Never evaluate at an endpoint: nodes that round onto one are skipped.
      if (!(x > a && x < b)) continue;
      const fx = f(x);
      if (Number.isFinite(fx)) s += w * fx;
    }
    return h * s;
  };

  let prev = levelSum(1);
  let value = prev;
  let error = Number.POSITIVE_INFINITY;
  for (let level = 1; level <= maxLevel; level++) {
    const h = Math.pow(2, -level);
    value = levelSum(h);
    error = Math.abs(value - prev);
    if (error <= tol * Math.max(1, Math.abs(value))) break;
    prev = value;
  }
  return { value, error };
}

/**
 * Clenshaw–Curtis quadrature of `f` over `[a, b]` with `n` intervals on the
 * Chebyshev extreme points (exact for polynomials of degree `n`). An odd `n`
 * is rounded up to the next even value.
 *
 * @example
 * clenshawCurtis((x) => x ** 4, -1, 1, 8) // 0.4
 */
export function clenshawCurtis(f: (x: number) => number, a: number, b: number, n: number): number {
  checkFiniteLimits(a, b, 'clenshawCurtis');
  if (!Number.isInteger(n) || n < 2) {
    throw new RangeError('clenshawCurtis: n must be an integer ≥ 2');
  }
  const N = n % 2 === 0 ? n : n + 1;
  const half = 0.5 * (b - a);
  const mid = 0.5 * (a + b);
  let s = 0;
  for (let k = 0; k <= N; k++) {
    const theta = (k * Math.PI) / N;
    let acc = 1;
    for (let j = 1; j <= N / 2; j++) {
      const bj = j === N / 2 ? 1 : 2;
      acc -= (bj / (4 * j * j - 1)) * Math.cos(2 * j * theta);
    }
    const ck = k === 0 || k === N ? 1 : 2;
    const wk = (ck / N) * acc;
    s += wk * f(mid + half * Math.cos(theta));
  }
  return half * s;
}

function asLimit1(v: Limit1, x: number): number {
  return typeof v === 'number' ? v : v(x);
}

/**
 * Iterated integral `∫_{ax}^{bx} ∫_{gy(x)}^{hy(x)} f(y, x) dy dx`, with both
 * levels integrated by {@link quad}. Returns the outer `error` estimate, and
 * the value is the sum of the outer integrals of the inner results.
 *
 * @example
 * dblquad((y, x) => x * y, 0, 1, 0, 1).value // 0.25
 */
export function dblquad(
  f: (y: number, x: number) => number,
  ax: number,
  bx: number,
  gy: Limit1,
  hy: Limit1,
  opts?: QuadOptions
): QuadResult {
  checkFiniteLimits(ax, bx, 'dblquad');
  const inner = (x: number): number => {
    const lo = asLimit1(gy, x);
    const hi = asLimit1(hy, x);
    return quad((y) => f(y, x), lo, hi, opts).value;
  };
  const outer = quad(inner, ax, bx, opts);
  return { value: outer.value, error: outer.error };
}

/**
 * Triple iterated integral `∫_{ax}^{bx} ∫_{gy(x)}^{hy(x)} ∫_{qz(x,y)}^{rz(x,y)}
 * f(z, y, x) dz dy dx`, each level integrated by {@link quad}.
 *
 * @example
 * tplquad((z, y, x) => x * y * z, 0, 1, 0, 1, 0, 1).value // 0.125
 */
export function tplquad(
  f: (z: number, y: number, x: number) => number,
  ax: number,
  bx: number,
  gy: Limit1,
  hy: Limit1,
  qz: Limit2,
  rz: Limit2,
  opts?: QuadOptions
): QuadResult {
  checkFiniteLimits(ax, bx, 'tplquad');
  const asLimit2 = (v: Limit2, x: number, y: number): number =>
    typeof v === 'number' ? v : v(x, y);
  const inner = (x: number): number => {
    const lo = asLimit1(gy, x);
    const hi = asLimit1(hy, x);
    return quad(
      (y) => {
        const zLo = asLimit2(qz, x, y);
        const zHi = asLimit2(rz, x, y);
        return quad((z) => f(z, y, x), zLo, zHi, opts).value;
      },
      lo,
      hi,
      opts
    ).value;
  };
  const outer = quad(inner, ax, bx, opts);
  return { value: outer.value, error: outer.error };
}
