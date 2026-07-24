/**
 * General 1-D parabolic PDE solver via the method of lines (MOL).
 *
 * Solves
 *
 *     u_t = D(x)·u_xx + c(x)·u_x + f(x, t, u)
 *
 * on `x ∈ [x0, x1]`, `t ∈ [0, T]`, with initial condition `u(x,0) = u0(x)` and
 * Dirichlet or Neumann boundary conditions at each end.
 *
 * The spatial domain is discretised on a uniform grid of `nx` points (spacing
 * `h`). The second derivative uses the standard central second difference
 * `u_xx ≈ (u_{i-1} − 2u_i + u_{i+1})/h²` and the first derivative the central
 * difference `u_x ≈ (u_{i+1} − u_{i-1})/(2h)` — both second-order accurate, so
 * the scheme converges as `O(h²)` in space. This semi-discretisation turns the
 * PDE into a **stiff** ODE system `U'(t) = RHS(t, U)` in the nodal values (the
 * diffusion term gives the Jacobian eigenvalues ≈ −D/h², very stiff for fine
 * grids), which is integrated with the variable-order BDF stiff solver
 * ({@link bdfSolve}) — implicit, so there is no explicit-Euler CFL step cap.
 *
 * This is a NEW public entry point; the legacy explicit-Euler heat-only
 * {@link solvePDE} is intentionally left unchanged.
 *
 * @packageDocumentation
 */

import { bdfSolve } from './solveODE.js';

/** A spatially-varying coefficient `D(x)` / `c(x)`; a plain number means constant. */
export type SpaceCoefficient = number | ((x: number) => number);

/** A time-varying boundary datum `g(t)`; a plain number means constant in time. */
export type BoundaryDatum = number | ((t: number) => number);

/**
 * Boundary condition at one end of the domain.
 * - `dirichlet`: prescribes the value `u = g(t)`.
 * - `neumann`: prescribes the spatial derivative `u_x = g(t)` (a second-order
 *   ghost-node closure is used so overall `O(h²)` accuracy is preserved).
 */
export interface ParabolicBC {
  type: 'dirichlet' | 'neumann';
  value: BoundaryDatum;
}

/** Reaction / source term `f(x, t, u)`. */
export type ParabolicSource = (x: number, t: number, u: number) => number;

/** Options for {@link solveParabolicPDE}. */
export interface SolveParabolicPDEOptions {
  /** Diffusion coefficient `D(x)` (constant if a number). Must be > 0 for a well-posed problem. */
  diffusion: SpaceCoefficient;
  /** Advection coefficient `c(x)` in `c(x)·u_x` (default 0 — pure diffusion/reaction). */
  advection?: SpaceCoefficient;
  /** Reaction/source `f(x, t, u)` (default 0). */
  source?: ParabolicSource;
  /** Left domain endpoint. */
  x0: number;
  /** Right domain endpoint (`x1 > x0`). */
  x1: number;
  /** Final integration time (`T > 0`). */
  T: number;
  /** Number of grid points including both boundaries (`nx ≥ 3`). Spacing `h = (x1−x0)/(nx−1)`. */
  nx: number;
  /** Initial condition `u0(x)`. */
  u0: (x: number) => number;
  /** Left (`x = x0`) boundary condition. */
  bcLeft: ParabolicBC;
  /** Right (`x = x1`) boundary condition. */
  bcRight: ParabolicBC;
  /** Relative tolerance for the BDF integrator (default 1e-6). */
  tol?: number;
  /** Maximum BDF step size (default: no cap). */
  maxStep?: number;
  /**
   * Explicit output times at which to report the solution (each in `[0, T]`).
   * When omitted the solver's own accepted time steps are returned (the last is
   * exactly `T`). When given, the free-node states are linearly interpolated
   * between accepted steps and the boundary nodes evaluated exactly at each time.
   */
  times?: number[];
}

/** Solution returned by {@link solveParabolicPDE}. */
export interface ParabolicPDESolution {
  /** The `nx` spatial grid points. */
  x: number[];
  /** The output times (length `nt`). */
  t: number[];
  /** Solution values `u[timeIndex][spaceIndex]`, full grid including boundary nodes. */
  u: number[][];
}

/** Normalise a coefficient into a function of `x`. */
function asSpaceFn(c: SpaceCoefficient | undefined, dflt: number): (x: number) => number {
  if (c === undefined) return () => dflt;
  return typeof c === 'function' ? c : () => c;
}

/** Normalise a boundary datum into a function of `t`. */
function asTimeFn(g: BoundaryDatum): (t: number) => number {
  return typeof g === 'function' ? g : () => g;
}

/**
 * Solve the general 1-D parabolic PDE `u_t = D(x)·u_xx + c(x)·u_x + f(x, t, u)`
 * by the method of lines onto the BDF stiff ODE solver.
 *
 * @example
 * // Heat equation u_t = u_xx, u(x,0)=sin(πx), Dirichlet 0 → u = e^{−π²t} sin(πx)
 * const sol = solveParabolicPDE({
 *   diffusion: 1, x0: 0, x1: 1, T: 0.1, nx: 81,
 *   u0: (x) => Math.sin(Math.PI * x),
 *   bcLeft: { type: 'dirichlet', value: 0 },
 *   bcRight: { type: 'dirichlet', value: 0 },
 * });
 * // sol.u[sol.t.length - 1] ≈ e^{−π²·0.1} sin(πx)
 */
export function solveParabolicPDE(options: SolveParabolicPDEOptions): ParabolicPDESolution {
  const { x0, x1, T, nx, u0, bcLeft, bcRight } = options;

  if (!(nx >= 3) || !Number.isInteger(nx)) {
    throw new Error('solveParabolicPDE: nx must be an integer ≥ 3');
  }
  if (!(x1 > x0)) {
    throw new Error('solveParabolicPDE: require x1 > x0');
  }
  if (!(T > 0)) {
    throw new Error('solveParabolicPDE: require T > 0');
  }

  const h = (x1 - x0) / (nx - 1);
  const D = asSpaceFn(options.diffusion, 0);
  const c = asSpaceFn(options.advection, 0);
  const f: ParabolicSource = options.source ?? (() => 0);
  const gL = asTimeFn(bcLeft.value);
  const gR = asTimeFn(bcRight.value);

  const x: number[] = new Array<number>(nx);
  for (let i = 0; i < nx; i++) x[i] = x0 + i * h;

  const leftDirichlet = bcLeft.type === 'dirichlet';
  const rightDirichlet = bcRight.type === 'dirichlet';

  // Free nodes are the ODE unknowns: all interior nodes, plus a boundary node
  // whenever its BC is Neumann (a Dirichlet boundary node is algebraic, set to g(t)).
  const freeIdx: number[] = [];
  if (!leftDirichlet) freeIdx.push(0);
  for (let i = 1; i < nx - 1; i++) freeIdx.push(i);
  if (!rightDirichlet) freeIdx.push(nx - 1);
  const m = freeIdx.length;

  // Reconstruct the full nodal vector at time `t` from the free-node state `U`.
  const reconstruct = (t: number, U: number[]): number[] => {
    const full = new Array<number>(nx);
    if (leftDirichlet) full[0] = gL(t);
    if (rightDirichlet) full[nx - 1] = gR(t);
    for (let s = 0; s < m; s++) full[freeIdx[s]] = U[s];
    return full;
  };

  // Semi-discrete RHS: U'(t) for the free nodes.
  const rhs = (t: number, U: number[]): number[] => {
    const full = reconstruct(t, U);
    const out = new Array<number>(m);
    for (let s = 0; s < m; s++) {
      const i = freeIdx[s];
      const xi = x[i];
      let uxx: number;
      let ux: number;
      if (i === 0) {
        // Neumann-left: ghost u_{-1} = u_1 − 2h·gL so u_x(x0) = gL.
        const g = gL(t);
        uxx = (2 * full[1] - 2 * full[0] - 2 * h * g) / (h * h);
        ux = g;
      } else if (i === nx - 1) {
        // Neumann-right: ghost u_{nx} = u_{nx-2} + 2h·gR so u_x(x1) = gR.
        const g = gR(t);
        uxx = (2 * full[nx - 2] - 2 * full[nx - 1] + 2 * h * g) / (h * h);
        ux = g;
      } else {
        uxx = (full[i - 1] - 2 * full[i] + full[i + 1]) / (h * h);
        ux = (full[i + 1] - full[i - 1]) / (2 * h);
      }
      out[s] = D(xi) * uxx + c(xi) * ux + f(xi, t, full[i]);
    }
    return out;
  };

  const y0: number[] = freeIdx.map((i) => u0(x[i]));

  const bdfOptions: { tol?: number; maxStep?: number } = {};
  if (options.tol !== undefined) bdfOptions.tol = options.tol;
  else bdfOptions.tol = 1e-6;
  if (options.maxStep !== undefined) bdfOptions.maxStep = options.maxStep;

  const sol = bdfSolve(rhs as unknown as Parameters<typeof bdfSolve>[0], [0, T], y0, bdfOptions);
  const stepT = sol.t;
  const stepY = sol.y;

  const requested = options.times;
  if (requested === undefined) {
    // Return the solver's own steps, reconstructing the full grid at each.
    return { x, t: stepT.slice(), u: stepT.map((tk, k) => reconstruct(tk, stepY[k])) };
  }

  // Interpolate the free-node states onto the requested output times.
  const u: number[][] = requested.map((tq) => {
    const U = interpState(stepT, stepY, tq);
    return reconstruct(tq, U);
  });
  return { x, t: requested.slice(), u };
}

/** Linear interpolation of the free-node state vector at time `tq` between BDF steps. */
function interpState(stepT: number[], stepY: number[][], tq: number): number[] {
  const n = stepT.length;
  if (tq <= stepT[0]) return stepY[0].slice();
  if (tq >= stepT[n - 1]) return stepY[n - 1].slice();
  // Binary search for the bracketing interval [stepT[lo], stepT[lo+1]].
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (stepT[mid] <= tq) lo = mid;
    else hi = mid;
  }
  const t0 = stepT[lo];
  const t1 = stepT[lo + 1];
  const w = t1 === t0 ? 0 : (tq - t0) / (t1 - t0);
  const y0 = stepY[lo];
  const y1 = stepY[lo + 1];
  return y0.map((v, i) => v + w * (y1[i] - v));
}
