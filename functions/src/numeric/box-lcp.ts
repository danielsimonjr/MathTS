/**
 * Projected Gauss-Seidel solver for the dense box-constrained linear
 * complementarity problem (issue 379).
 *
 * The problem: given A (n x n), b, lo and hi, find x with
 * `lo_i <= x_i <= hi_i` and `w = A x - b` such that, for each i:
 * - `lo_i < x_i < hi_i` implies `w_i = 0`,
 * - `x_i = lo_i` implies `w_i >= 0`,
 * - `x_i = hi_i` implies `w_i <= 0`.
 *
 * With `lo = -Infinity` and `hi = +Infinity` the problem is `A x = b`.
 *
 * The solver makes no allocation inside its loops. The only object it creates
 * is the result, and only when the caller passes no `result` option.
 *
 * @packageDocumentation
 */

/** Options of {@link solveBoxLcp}. Every field is optional. */
export interface BoxLcpOptions {
  /** Number of unknowns. Default `b.length`. */
  n?: number;
  /** Sweep cap. Default 100. */
  iterations?: number;
  /**
   * Stop after a sweep whose largest `|change of x_i|` is at most this value.
   * The bound is absolute, in the units of x. Default 1e-10.
   */
  tolerance?: number;
  /** Over-relaxation factor in `(0, 2)`. Default 1 (plain Gauss-Seidel). */
  sor?: number;
  /**
   * Friction coupling, as ODE's `findex`. For a row `j` with `findex[j] = i >= 0`,
   * the bounds of `x_j` at each update are `lo_j * x_i` and `hi_j * x_i`, with the
   * current `x_i`. When the lower bound is above the upper bound (`x_i < 0`), the
   * two swap. Entries are -1 (no coupling) or an index in `[0, n)` other than the
   * row itself. The lower and upper bounds of a coupled row must be finite.
   * Keep the lower bound of the normal row at 0, so `x_i` is non-negative after its
   * first update. A negative warm start of `x_i` only affects the first sweep.
   * A forward index (to a later row) gives the order that PhysJS uses for
   * a contact point: tangents first, then the normal.
   */
  findex?: ArrayLike<number>;
  /** An object that receives the result fields, so a solve loop allocates nothing. Default: a new object. */
  result?: BoxLcpResult;
}

/** Result of {@link solveBoxLcp}. */
export interface BoxLcpResult {
  /** Sweeps run. The sweep that met the tolerance counts. */
  iterations: number;
  /**
   * Natural-map residual `max_i |x_i - clamp(x_i - w_i, l_i, h_i)|`, with the
   * bounds of `findex` applied. It mixes the units of x and w, because it is not
   * scaled by `a_ii`. It is 0 exactly when `x` satisfies the complementarity conditions.
   */
  residual: number;
  /**
   * True only when the tolerance stop fired. It means that `x` stopped changing,
   * not that the LCP is solved. A row without a positive diagonal makes no step,
   * so `residual` can stay above 0 while `converged` is true. Callers check `residual`.
   */
  converged: boolean;
}

/**
 * Solves the box LCP by projected Gauss-Seidel.
 *
 * `A` is dense and stored row-major: `A[i * n + j]` is row `i`, column `j`.
 * Projected Gauss-Seidel converges for a symmetric positive semidefinite `A`; for
 * another matrix it can diverge to Infinity or NaN without a throw
 * (`converged: false`). It needs a positive diagonal. A row whose `A[i * n + i]` is
 * zero or negative (or NaN) makes no step. Its `x_i` is still clamped into its
 * box on every sweep, so a positive semidefinite matrix with a zero diagonal
 * entry (for example a static body pair in a contact solver) is accepted, and
 * the row is reported through `residual`.
 *
 * `x` is in and out. On entry its contents are the warm start (zeros, or the
 * previous solution). Entries outside their bounds are clamped in the first sweep.
 * On return `x` holds the solution.
 *
 * A NaN in an input propagates into `x`. The solver does not throw. The result
 * then has `converged: false` and `residual: NaN`, and every sweep runs.
 *
 * Example (PhysJS contact): `A = J M^-1 Jᵀ`, `b_i = target_i - J_i v0`, where
 * `v0` is the velocity with none of this step's impulses applied. Then
 * `w = J v - target`, and the Gauss-Seidel step `x_i - w_i / a_ii` equals
 * `impulse + mass * (target - speed)` with `mass = 1 / a_ii`. The normal row has
 * `lo = 0`, `hi = Infinity`. Each tangent row has `lo = -mu`, `hi = mu` and a
 * `findex` that points at the normal row.
 *
 * @param A - Row-major n x n matrix, read at index `i * n + j`.
 * @param b - Right-hand side, length at least `n`.
 * @param lo - Lower bounds, length at least `n`. `-Infinity` allowed.
 * @param hi - Upper bounds, length at least `n`. `Infinity` allowed. `lo[i] <= hi[i]` is required.
 * @param x - Unknowns, in and out. Length at least `n`.
 * @param options - Solver options. See {@link BoxLcpOptions}.
 * @returns The result. It is `options.result` when that is given.
 * @throws {RangeError} When an option or an input has an invalid value or length.
 */
export function solveBoxLcp(
  A: ArrayLike<number>,
  b: ArrayLike<number>,
  lo: ArrayLike<number>,
  hi: ArrayLike<number>,
  x: { readonly length: number; [i: number]: number },
  options?: BoxLcpOptions
): BoxLcpResult {
  const n = options?.n ?? b.length;
  const iterations = options?.iterations ?? 100;
  const tolerance = options?.tolerance ?? 1e-10;
  const sor = options?.sor ?? 1;
  const findex = options?.findex;
  const result: BoxLcpResult = options?.result ?? { iterations: 0, residual: 0, converged: false };

  if (!(Number.isInteger(n) && n >= 0))
    throw new RangeError(`n must be a non-negative integer, got ${n}`);
  if (!(A.length >= n * n))
    throw new RangeError(`A must hold n*n = ${n * n} values, got ${A.length}`);
  if (!(b.length >= n)) throw new RangeError(`b must hold n = ${n} values, got ${b.length}`);
  if (!(lo.length >= n)) throw new RangeError(`lo must hold n = ${n} values, got ${lo.length}`);
  if (!(hi.length >= n)) throw new RangeError(`hi must hold n = ${n} values, got ${hi.length}`);
  if (!(x.length >= n)) throw new RangeError(`x must hold n = ${n} values, got ${x.length}`);
  if (!(Number.isInteger(iterations) && iterations >= 0))
    throw new RangeError(`iterations must be a non-negative integer, got ${iterations}`);
  if (!(tolerance >= 0))
    throw new RangeError(`tolerance must be a non-negative number, got ${tolerance}`);
  if (!(sor > 0 && sor < 2)) throw new RangeError(`sor must be in (0, 2), got ${sor}`);
  for (let i = 0; i < n; i++) {
    if (lo[i]! > hi[i]!) throw new RangeError(`lo[${i}] must not exceed hi[${i}]`);
  }
  if (findex !== undefined) {
    if (!(findex.length >= n))
      throw new RangeError(`findex must hold n = ${n} values, got ${findex.length}`);
    for (let j = 0; j < n; j++) {
      const k = findex[j]!;
      if (!(Number.isInteger(k) && k >= -1 && k < n))
        throw new RangeError(`findex[${j}] must be -1 or an integer in [0, n), got ${k}`);
      if (k === j) throw new RangeError(`findex[${j}] must not point at its own row`);
      if (k >= 0 && !(Number.isFinite(lo[j]!) && Number.isFinite(hi[j]!)))
        throw new RangeError(`coupled row ${j} needs finite lo and hi`);
    }
  }

  if (n === 0) {
    result.iterations = 0;
    result.residual = 0;
    result.converged = true;
    return result;
  }

  let sweeps = iterations;
  let converged = false;
  for (let sweep = 1; sweep <= iterations; sweep++) {
    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      let l = lo[i]!;
      let h = hi[i]!;
      if (findex !== undefined && findex[i]! >= 0) {
        const xk = x[findex[i]!]!;
        l = lo[i]! * xk;
        h = hi[i]! * xk;
        if (l > h) {
          const t = l;
          l = h;
          h = t;
        }
      }
      const xi = x[i]!;
      const aii = A[i * n + i]!;
      let xNew: number;
      if (!(aii > 0)) {
        xNew = Math.min(Math.max(xi, l), h);
      } else {
        let s = 0;
        for (let j = 0; j < n; j++) s += A[i * n + j]! * x[j]!;
        const w = s - b[i]!;
        xNew = Math.min(Math.max(xi - (sor * w) / aii, l), h);
      }
      maxDelta = Math.max(maxDelta, Math.abs(xNew - xi));
      x[i] = xNew;
    }
    if (maxDelta <= tolerance) {
      converged = true;
      sweeps = sweep;
      break;
    }
  }

  let residual = 0;
  for (let i = 0; i < n; i++) {
    let l = lo[i]!;
    let h = hi[i]!;
    if (findex !== undefined && findex[i]! >= 0) {
      const xk = x[findex[i]!]!;
      l = lo[i]! * xk;
      h = hi[i]! * xk;
      if (l > h) {
        const t = l;
        l = h;
        h = t;
      }
    }
    let s = 0;
    for (let j = 0; j < n; j++) s += A[i * n + j]! * x[j]!;
    const w = s - b[i]!;
    const xi = x[i]!;
    residual = Math.max(residual, Math.abs(xi - Math.min(Math.max(xi - w, l), h)));
  }

  result.iterations = sweeps;
  result.residual = residual;
  result.converged = converged;
  return result;
}
