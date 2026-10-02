/**
 * Symplectic Gauss–Legendre 4th-order ODE integrator.
 *
 * Two-stage implicit Runge–Kutta collocation on the roots of the shifted
 * Legendre polynomial P₂ (order 4, stage order 2). The Butcher tableau is
 * the one in Hairer, Lubich, and Wanner, *Geometric Numerical Integration*
 * §II.1, and it satisfies the Sanz-Serna 1988 symplecticity condition
 * `b_i a_ij + b_j a_ji = b_i b_j`. That is what keeps a Hamiltonian's
 * energy error bounded instead of drifting.
 *
 * This is an ODE solver (`y' = f(t, y)`). It is not Gauss–Legendre
 * quadrature — that function is `gaussQuad`.
 *
 * The stage equations
 *
 *   Y_i = y_n + h Σ_j a_ij f(t_n + c_j h, Y_j)
 *
 * are solved by Picard iteration. A step that does not contract throws
 * {@link GL4ConvergenceError}; shrink `h` (or raise `steps`) or raise
 * `picardMaxIter`.
 *
 * @packageDocumentation
 */

const SQRT3_OVER_6 = Math.sqrt(3) / 6;

/**
 * GL4 nodes `c₁ = ½ − √3/6`, `c₂ = ½ + √3/6`.
 */
export const GL4_C: readonly [number, number] = [0.5 - SQRT3_OVER_6, 0.5 + SQRT3_OVER_6];

/**
 * GL4 Butcher matrix
 *
 *   [ 1/4            1/4 − √3/6 ]
 *   [ 1/4 + √3/6     1/4        ]
 */
export const GL4_A: readonly [readonly [number, number], readonly [number, number]] = [
  [0.25, 0.25 - SQRT3_OVER_6],
  [0.25 + SQRT3_OVER_6, 0.25],
];

/**
 * GL4 weights `b₁ = b₂ = ½`.
 */
export const GL4_B: readonly [number, number] = [0.5, 0.5];

/**
 * Thrown when Picard iteration on a GL4 step does not reach `picardTol`
 * within `picardMaxIter`. The message matches `/Picard iteration did not converge/`.
 */
export class GL4ConvergenceError extends Error {
  constructor(message = 'Picard iteration did not converge') {
    super(message);
    this.name = 'GL4ConvergenceError';
  }
}

/** Options for {@link gaussLegendre4}. */
export interface GaussLegendre4Options {
  /**
   * Positive step size. The span is split into equal steps of size at most
   * `h` that land on `tspan[1]`. Ignored when `steps` is set.
   */
  h?: number;
  /** Number of equal steps across `tspan`. Takes precedence over `h`. */
  steps?: number;
  /** Infinity-norm tolerance on successive Picard iterates (default `1e-12`). */
  picardTol?: number;
  /** Picard iteration cap per step (default `64`). */
  picardMaxIter?: number;
}

/** Time grid and states, same shape as `solveODESystem`. */
export interface GaussLegendre4Solution {
  t: number[];
  y: number[][];
}

function assertFiniteVector(label: string, v: readonly number[]): void {
  for (let i = 0; i < v.length; i++) {
    if (!Number.isFinite(v[i])) {
      throw new TypeError(`${label}[${i}] must be a finite number`);
    }
  }
}

/**
 * Integrate `y' = f(t, y)` with the 2-stage Gauss–Legendre method.
 *
 * @param f - Right-hand side. Must return a vector the same length as `y`.
 * @param y0 - Initial state (non-empty, finite).
 * @param tspan - `[t0, t1]`. `t1` may be less than `t0`.
 * @param options - Step control and Picard tolerances. With neither `steps`
 *   nor `h`, the span is split into 100 equal steps.
 */
export function gaussLegendre4(
  f: (t: number, y: readonly number[]) => readonly number[],
  y0: readonly number[],
  tspan: readonly [number, number],
  options?: GaussLegendre4Options
): GaussLegendre4Solution {
  if (y0.length === 0) {
    throw new TypeError('y0 must be a non-empty vector');
  }
  assertFiniteVector('y0', y0);
  const t0 = tspan[0];
  const t1 = tspan[1];
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) {
    throw new TypeError('tspan entries must be finite numbers');
  }

  const picardTol = options?.picardTol ?? 1e-12;
  const picardMaxIter = options?.picardMaxIter ?? 64;
  if (!(picardTol > 0) || !Number.isFinite(picardTol)) {
    throw new TypeError('picardTol must be a positive finite number');
  }
  if (!Number.isInteger(picardMaxIter) || picardMaxIter < 1) {
    throw new TypeError('picardMaxIter must be a positive integer');
  }

  if (t0 === t1) {
    return { t: [t0], y: [y0.slice()] };
  }

  const span = t1 - t0;
  let nSteps: number;
  if (options?.steps !== undefined) {
    nSteps = options.steps;
    if (!Number.isInteger(nSteps) || nSteps < 1) {
      throw new TypeError('steps must be a positive integer');
    }
  } else if (options?.h !== undefined) {
    const hAbs = options.h;
    if (!(hAbs > 0) || !Number.isFinite(hAbs)) {
      throw new TypeError('h must be a positive finite number');
    }
    nSteps = Math.max(1, Math.ceil(Math.abs(span) / hAbs));
  } else {
    nSteps = 100;
  }

  const h = span / nSteps;
  const n = y0.length;
  const c0 = GL4_C[0];
  const c1 = GL4_C[1];
  const a00 = GL4_A[0][0];
  const a01 = GL4_A[0][1];
  const a10 = GL4_A[1][0];
  const a11 = GL4_A[1][1];
  const b0 = GL4_B[0];
  const b1 = GL4_B[1];

  const t: number[] = [t0];
  const y: number[][] = [y0.slice()];
  let tn = t0;
  let yn = y0.slice();

  for (let step = 0; step < nSteps; step++) {
    let Y0 = yn.slice();
    let Y1 = yn.slice();
    let converged = false;
    const next = new Array<number>(n);

    for (let iter = 0; iter < picardMaxIter; iter++) {
      const k0 = f(tn + c0 * h, Y0);
      const k1 = f(tn + c1 * h, Y1);
      if (k0.length !== n || k1.length !== n) {
        throw new TypeError(`f must return a vector of length ${n}`);
      }
      assertFiniteVector('f(t, y)', k0);
      assertFiniteVector('f(t, y)', k1);

      let maxDiff = 0;
      const nY0 = new Array<number>(n);
      const nY1 = new Array<number>(n);
      for (let i = 0; i < n; i++) {
        nY0[i] = yn[i] + h * (a00 * k0[i] + a01 * k1[i]);
        nY1[i] = yn[i] + h * (a10 * k0[i] + a11 * k1[i]);
        const d0 = Math.abs(nY0[i] - Y0[i]);
        const d1 = Math.abs(nY1[i] - Y1[i]);
        if (d0 > maxDiff) maxDiff = d0;
        if (d1 > maxDiff) maxDiff = d1;
      }
      Y0 = nY0;
      Y1 = nY1;
      if (maxDiff <= picardTol) {
        for (let i = 0; i < n; i++) {
          next[i] = yn[i] + h * (b0 * k0[i] + b1 * k1[i]);
        }
        converged = true;
        break;
      }
    }

    if (!converged) {
      throw new GL4ConvergenceError(
        `Picard iteration did not converge within ${picardMaxIter} iterations (step h=${h})`
      );
    }

    tn += h;
    yn = next;
    t.push(tn);
    y.push(yn.slice());
  }

  return { t, y };
}
