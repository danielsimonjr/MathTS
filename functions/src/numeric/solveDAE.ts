/**
 * Semi-explicit index-1 differential-algebraic equation (DAE) solver via BDF.
 *
 * Solves the semi-explicit index-1 system
 *
 *     y' = f(t, y, z)      (differential variables y)
 *     0  = g(t, y, z)      (algebraic constraint z)
 *
 * on `t ∈ [t0, T]`. "Index-1" means the algebraic Jacobian block `∂g/∂z` is
 * **nonsingular**, so the constraint `g = 0` locally determines `z` from
 * `(t, y)`; this is exactly the condition that makes the coupled per-step
 * Newton system solvable.
 *
 * ## Method — variable-step, variable-order (1–2) BDF with a combined Newton step
 *
 * The differential derivative is discretised with a Backward Differentiation
 * Formula (the same BDF family that backs {@link bdfSolve}): on the last `k`
 * accepted times plus the new time `t_{n+1}`, the interpolating polynomial's
 * derivative at `t_{n+1}` is `Σ_j c_j·w_{n+1-j}` (variable-step coefficients
 * `c_j` from the Lagrange-basis derivative, so BDF1/BDF2 work on a non-uniform
 * grid). Each step then solves the **combined** nonlinear system for the new
 * `w_{n+1} = (y_{n+1}, z_{n+1})`
 *
 *     differential rows:  c_0·y_{n+1} + (history) − f(t_{n+1}, y_{n+1}, z_{n+1}) = 0
 *     algebraic rows:     g(t_{n+1}, y_{n+1}, z_{n+1}) = 0
 *
 * by Newton's method. The Newton (iteration) matrix is the block
 *
 *     ⎡ c_0·I − ∂f/∂y     − ∂f/∂z ⎤
 *     ⎣    ∂g/∂y            ∂g/∂z  ⎦
 *
 * (finite-differenced from the residual by default, or built from analytic
 * blocks supplied via `options.jacobian`) and is LU-solved through the shared
 * matrix-package factorisation ({@link _factorSolver}). The index-1 condition
 * (`∂g/∂z` nonsingular) is exactly what makes this matrix nonsingular, so a
 * **higher-index** input is detected as a singular Jacobian and reported
 * (it is not silently integrated to garbage).
 *
 * Adaptive step size uses a predictor/corrector local-error estimate (the
 * corrector minus a lower-order extrapolation predictor), scaled by the usual
 * `atol + rtol·|w|` weights.
 *
 * ## Consistent initial values
 *
 * The initial algebraic value `z0` is treated as a **guess**: the solver runs
 * Newton on `g(t0, y0, z0) = 0` to land on the constraint manifold before the
 * first step (so a slightly-off or omitted `z0` is corrected rather than
 * silently propagated). If that Newton fails / `∂g/∂z` is singular at `t0`,
 * the problem is not index-1 and an error is thrown.
 *
 * Plain-number state only (the Jacobian and linear solves are numeric).
 *
 * @packageDocumentation
 */

import { _factorSolver } from './solveODE.js';

/** Differential forcing `y' = f(t, y, z)`. Returns the `y'` vector (a scalar is accepted for 1-D y). */
export type DAEDifferential = (t: number, y: number[], z: number[]) => number[] | number;

/** Algebraic constraint `0 = g(t, y, z)`. Returns the residual vector (a scalar is accepted for 1-D z). */
export type DAEConstraint = (t: number, y: number[], z: number[]) => number[] | number;

/**
 * Analytic Jacobian blocks of the DAE at `(t, y, z)`, supplied via
 * {@link SolveDAEOptions.jacobian} in place of the default finite differences.
 * Each block is a matrix in the usual `[row][col]` convention:
 * `fy[i][j] = ∂fᵢ/∂yⱼ`, `fz[i][j] = ∂fᵢ/∂zⱼ`, `gy`, `gz` likewise.
 */
export interface DAEJacobianBlocks {
  fy: number[][];
  fz: number[][];
  gy: number[][];
  gz: number[][];
}

/** Options for {@link solveDAE}. */
export interface SolveDAEOptions {
  /** Relative tolerance for the local-error step control (default `1e-6`). */
  tol?: number;
  /** Absolute tolerance (default `tol · 1e-3`). */
  atol?: number;
  /** Initial step size (default: chosen from `‖f‖`). */
  firstStep?: number;
  /** Minimum step size (a hard floor; the solver throws if it must go below it). */
  minStep?: number;
  /** Maximum step size (default: no cap). */
  maxStep?: number;
  /** Maximum number of accepted steps (default `1e5`). */
  maxIter?: number;
  /** Maximum BDF order, 1 or 2 (default `2`). */
  maxOrder?: 1 | 2;
  /** Newton convergence tolerance on the scaled increment (default derived from `tol`). */
  newtonTol?: number;
  /**
   * Analytic Jacobian blocks `(t, y, z) => { fy, fz, gy, gz }`. When given they
   * replace the default finite-difference Newton matrix (faster + more accurate).
   */
  jacobian?: (t: number, y: number[], z: number[]) => DAEJacobianBlocks;
}

/**
 * Solution returned by {@link solveDAE}.
 *
 * `y`/`z` are `number[][]` (one state vector per time) when the corresponding
 * initial value was an array, and unwrapped to `number[]` when it was a scalar.
 */
export interface DAESolution {
  /** Accepted output times, `t[0] = t0`, last entry `= T`. */
  t: number[];
  /** Differential state at each time. */
  y: number[][] | number[];
  /** Algebraic state at each time. */
  z: number[][] | number[];
}

/** Coerce a `number | number[]` into a fresh `number[]`. */
function _arr(v: number | number[]): number[] {
  return Array.isArray(v) ? v.slice() : [v];
}

/** Evaluate a DAE function and coerce its (scalar-or-vector) result to a `number[]`. */
function _evalArr(
  fn: (t: number, y: number[], z: number[]) => number[] | number,
  t: number,
  y: number[],
  z: number[]
): number[] {
  const r = fn(t, y, z);
  return Array.isArray(r) ? r : [r];
}

/** RMS norm `‖v/scale‖₂ / √n` (the standard weighted-RMS error norm). */
function _wrms(v: number[], scale: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const q = v[i] / scale[i];
    s += q * q;
  }
  return Math.sqrt(s / v.length);
}

/**
 * BDF coefficients `c_j = L_j'(t_new)` — the derivative at `t_new` of the
 * Lagrange basis over `nodes = [t_new, t_n, t_{n-1}, …]`. `c[0]` multiplies the
 * unknown `w_{n+1}`. Works for any order (node count); used here at order 1–2.
 */
function _bdfCoeffs(nodes: number[]): number[] {
  const m = nodes.length;
  const x0 = nodes[0];
  const c = new Array<number>(m).fill(0);
  let diag = 0;
  for (let p = 1; p < m; p++) diag += 1 / (x0 - nodes[p]);
  c[0] = diag;
  for (let j = 1; j < m; j++) {
    let val = 1 / (nodes[j] - x0);
    for (let p = 0; p < m; p++) {
      if (p === 0 || p === j) continue;
      val *= (x0 - nodes[p]) / (nodes[j] - nodes[p]);
    }
    c[j] = val;
  }
  return c;
}

/** Value at `tnew` of the polynomial interpolating `(times[i], vals[i])` (Lagrange form). */
function _polyExtrap(times: number[], vals: number[][], tnew: number): number[] {
  const p = times.length;
  const n = vals[0].length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < p; i++) {
    let li = 1;
    for (let m = 0; m < p; m++) {
      if (m === i) continue;
      li *= (tnew - times[m]) / (times[i] - times[m]);
    }
    for (let d = 0; d < n; d++) out[d] += li * vals[i][d];
  }
  return out;
}

/** Dense Gaussian-elimination solve of `A·x = b` for the small algebraic-init systems. */
function _denseSolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r) => r.slice());
  const x = b.slice();
  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
    if (Math.abs(M[piv][k]) < 1e-300) return new Array<number>(n).fill(NaN);
    [M[k], M[piv]] = [M[piv], M[k]];
    [x[k], x[piv]] = [x[piv], x[k]];
    const akk = M[k][k];
    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k] / akk;
      for (let j = k; j < n; j++) M[i][j] -= factor * M[k][j];
      x[i] -= factor * x[k];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/**
 * Solve `g(t, y, z) = 0` for `z` by Newton (finite-difference `∂g/∂z`),
 * warm-started from `zGuess`. Returns `null` if `∂g/∂z` is singular or Newton
 * fails to converge — the caller reads that as "not index-1".
 */
function _solveAlgebraic(
  g: DAEConstraint,
  t: number,
  y: number[],
  zGuess: number[],
  tol: number
): number[] | null {
  const na = zGuess.length;
  const z = zGuess.slice();
  for (let iter = 0; iter < 50; iter++) {
    const g0 = _evalArr(g, t, y, z);
    if (g0.length !== na) {
      throw new Error(
        `solveDAE: the constraint g must return ${na} value(s) (matching z0); got ${g0.length}`
      );
    }
    // FD Jacobian ∂g/∂z (na×na)
    const J: number[][] = Array.from({ length: na }, () => new Array<number>(na));
    for (let j = 0; j < na; j++) {
      const eps = Math.max(1e-8, 1e-7 * Math.abs(z[j]));
      const zp = z.slice();
      zp[j] += eps;
      const gp = _evalArr(g, t, y, zp);
      for (let i = 0; i < na; i++) J[i][j] = (gp[i] - g0[i]) / eps;
    }
    const dz = _denseSolve(
      J,
      g0.map((v) => -v)
    );
    if (!dz.every((v) => Number.isFinite(v))) return null;
    let znorm = 0;
    let dnorm = 0;
    for (let i = 0; i < na; i++) {
      z[i] += dz[i];
      znorm += z[i] * z[i];
      dnorm += dz[i] * dz[i];
    }
    if (Math.sqrt(dnorm) <= tol * (1 + Math.sqrt(znorm))) {
      // Confirm the residual is genuinely small (guards against a false "converged").
      const gCheck = _evalArr(g, t, y, z);
      const res = Math.sqrt(gCheck.reduce((a, v) => a + v * v, 0));
      return res < 1e-6 ? z : null;
    }
  }
  return null;
}

/**
 * Solve the semi-explicit index-1 DAE `y' = f(t, y, z)`, `0 = g(t, y, z)` on
 * `[tspan[0], tspan[1]]` with a variable-step BDF(1–2) integrator and a coupled
 * Newton solve for `(y, z)` at each step.
 *
 * @param f      Differential forcing `f(t, y, z) → y'`.
 * @param g      Algebraic constraint `g(t, y, z) → 0`.
 * @param tspan  `[t0, T]` (forward integration; `T > t0`).
 * @param y0     Initial differential state (scalar or vector).
 * @param z0     Initial algebraic guess (scalar or vector). Refined to satisfy
 *               `g(t0, y0, z0) = 0` before the first step. Defaults to `[0]`.
 * @param options See {@link SolveDAEOptions}.
 * @returns `{ t, y, z }` — `y`/`z` are unwrapped to `number[]` when the matching
 *          initial value was a scalar, else `number[][]`.
 *
 * @example
 * // RC circuit: C·V' = i, i·R = Vs − V  (semi-explicit, index-1)
 * // with C=R=Vs=1, V(0)=0 → V = 1 − e^{−t}, i = e^{−t}
 * const sol = solveDAE(
 *   (t, y, z) => [z[0]],                 // V' = i
 *   (t, y, z) => [z[0] - (1 - y[0])],    // i − (Vs − V) = 0
 *   [0, 3], 0, 1,
 * );
 */
export function solveDAE(
  f: DAEDifferential,
  g: DAEConstraint,
  tspan: [number, number] | number[],
  y0: number | number[],
  z0?: number | number[],
  options: SolveDAEOptions = {}
): DAESolution {
  const t0 = tspan[0];
  const tf = tspan[1];
  if (!(typeof t0 === 'number' && typeof tf === 'number')) {
    throw new Error('solveDAE: tspan must be [t0, T] numbers');
  }
  if (!(tf > t0)) {
    throw new Error('solveDAE: require T > t0 (forward integration)');
  }

  const yScalar = !Array.isArray(y0);
  // An omitted z0 defaults to a single scalar algebraic variable, so unwrap z to a scalar too.
  const zScalar = z0 === undefined || !Array.isArray(z0);
  const y0v = _arr(y0);
  const z0v = z0 === undefined ? [0] : _arr(z0);
  const nd = y0v.length;
  const na = z0v.length;
  const n = nd + na;

  const rtol = options.tol ?? 1e-6;
  const atol = options.atol ?? rtol * 1e-3;
  const maxOrder = options.maxOrder ?? 2;
  const maxIter = options.maxIter ?? 100_000;
  const maxStep = options.maxStep ?? Infinity;
  const minStepOpt = options.minStep ?? 0;
  // Newton convergence tolerance on the WRMS-normalised update (dw / (atol+rtol|w|)).
  // scipy's simplified-Newton criterion: a MODEST fraction, not ~rtol — the normalised
  // update floors at ~eps/scale, so demanding ≈rtol makes Newton never "converge".
  const EPS = Number.EPSILON;
  const newtonTol =
    options.newtonTol ?? Math.max((10 * EPS) / rtol, Math.min(0.03, Math.sqrt(rtol)));
  const span = tf - t0;

  // Split a combined state w = [y, z].
  const yOf = (w: number[]): number[] => w.slice(0, nd);
  const zOf = (w: number[]): number[] => w.slice(nd);

  // --- Consistent initialisation: land z0 on the manifold g(t0, y0, z0) = 0. ---
  const z0consistent = _solveAlgebraic(g, t0, y0v, z0v, newtonTol);
  if (z0consistent === null) {
    throw new Error(
      'solveDAE: could not solve g(t0, y0, z0) = 0 for a consistent z0 — ∂g/∂z appears singular. ' +
        'The DAE is not semi-explicit index-1 (index-1 requires ∂g/∂z nonsingular).'
    );
  }

  let t = t0;
  let w = [...y0v, ...z0consistent];

  // Accepted history (most-recent first): times and combined states.
  const histT: number[] = [t];
  const histW: number[][] = [w.slice()];

  // Output arrays.
  const tOut: number[] = [t];
  const yOut: number[][] = [yOf(w)];
  const zOut: number[][] = [zOf(w)];

  // Initial step: Hairer-style h₀ ≈ 0.01·‖y0‖/‖f0‖, capped to the span.
  let h: number;
  if (options.firstStep !== undefined) {
    h = Math.abs(options.firstStep);
  } else {
    const f0 = _evalArr(f, t0, y0v, z0consistent);
    const nrm = (v: number[]) =>
      Math.sqrt(v.reduce((a, x) => a + x * x, 0) / Math.max(1, v.length));
    const d0 = nrm(y0v);
    const d1 = nrm(f0);
    h = Math.min(d0 < 1e-5 || d1 < 1e-5 ? 1e-3 : 0.01 * (d0 / d1), span);
  }
  h = Math.min(h, maxStep);

  /** Build the combined residual R(w) at (tNew, order-k history) for the Newton solve. */
  function makeResidual(tNew: number, c0: number, histSum: number[]): (wc: number[]) => number[] {
    return (wc: number[]): number[] => {
      const y = yOf(wc);
      const z = zOf(wc);
      const fv = _evalArr(f, tNew, y, z);
      const gv = _evalArr(g, tNew, y, z);
      if (fv.length !== nd) {
        throw new Error(`solveDAE: f must return ${nd} value(s) (matching y0); got ${fv.length}`);
      }
      if (gv.length !== na) {
        throw new Error(`solveDAE: g must return ${na} value(s) (matching z0); got ${gv.length}`);
      }
      const R = new Array<number>(n);
      for (let i = 0; i < nd; i++) R[i] = c0 * wc[i] + histSum[i] - fv[i];
      for (let i = 0; i < na; i++) R[nd + i] = gv[i];
      return R;
    };
  }

  /** Newton (iteration) matrix from analytic Jacobian blocks, else finite differences. */
  function newtonMatrix(
    tNew: number,
    wc: number[],
    c0: number,
    residual: (w: number[]) => number[],
    R0: number[]
  ): number[][] {
    if (options.jacobian) {
      const { fy, fz, gy, gz } = options.jacobian(tNew, yOf(wc), zOf(wc));
      const J: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
      for (let i = 0; i < nd; i++) {
        for (let j = 0; j < nd; j++) J[i][j] = (i === j ? c0 : 0) - fy[i][j];
        for (let j = 0; j < na; j++) J[i][nd + j] = -fz[i][j];
      }
      for (let i = 0; i < na; i++) {
        for (let j = 0; j < nd; j++) J[nd + i][j] = gy[i][j];
        for (let j = 0; j < na; j++) J[nd + i][nd + j] = gz[i][j];
      }
      return J;
    }
    // Finite-difference the residual column by column (captures c0·w and f/g together).
    const J: number[][] = Array.from({ length: n }, () => new Array<number>(n));
    for (let col = 0; col < n; col++) {
      const eps = Math.max(1e-8, 1e-7 * Math.abs(wc[col]));
      const wp = wc.slice();
      wp[col] += eps;
      const Rp = residual(wp);
      for (let row = 0; row < n; row++) J[row][col] = (Rp[row] - R0[row]) / eps;
    }
    return J;
  }

  let iter = 0;
  while (t < tf && iter < maxIter) {
    iter++;
    if (t + h > tf) h = tf - t;
    const minStep = Math.max(minStepOpt, 1e-13 * Math.max(1, Math.abs(t)));

    // Order ramps up with available history. Order k needs k+1 accepted points to
    // form a degree-k predictor (so the corrector−predictor error estimate is the
    // true O(h^{k+1}) local error); hence order = min(maxOrder, nPoints − 1).
    const order = Math.max(1, Math.min(maxOrder, histT.length - 1));

    let accepted = false;
    let wNew: number[] = w;
    let acceptedTime = t;

    while (!accepted) {
      if (h < minStep) {
        throw new Error(
          'solveDAE: required step size fell below the minimum — the Newton iteration is not ' +
            'converging. The system may be higher-index (∂g/∂z singular) or the tolerance too tight.'
        );
      }
      const tNew = t + h;

      // BDF nodes: [tNew, t_n, t_{n-1}, …] (order+1 nodes) → coefficients.
      const nodes = [tNew];
      for (let j = 0; j < order; j++) nodes.push(histT[j]);
      const coeffs = _bdfCoeffs(nodes);
      const c0 = coeffs[0];

      // History sum for the differential rows: Σ_{j≥1} c_j · w_{n+1-j}.
      const histSum = new Array<number>(nd).fill(0);
      for (let j = 1; j <= order; j++) {
        const cj = coeffs[j];
        const wj = histW[j - 1];
        for (let i = 0; i < nd; i++) histSum[i] += cj * wj[i];
      }

      const residual = makeResidual(tNew, c0, histSum);

      // Predictor — warm start AND the basis of the local-error estimate. When at
      // least order+1 points exist, a degree-`order` polynomial extrapolation gives
      // an O(h^{order+1}) predictor so corrector−predictor is the true LTE. On the
      // very first step (only one point) fall back to a forward-Euler predictor
      // (w_n + h·ẇ_n on the differential block) so the estimate is still O(h²).
      let wPred: number[];
      if (histT.length >= order + 1) {
        wPred = _polyExtrap(histT.slice(0, order + 1), histW.slice(0, order + 1), tNew);
      } else {
        wPred = w.slice();
        const fn = _evalArr(f, histT[0], yOf(w), zOf(w));
        for (let i = 0; i < nd; i++) wPred[i] = w[i] + h * fn[i];
      }

      // --- Combined Newton solve for w_{n+1}. ---
      const wc = wPred.slice();
      let converged = false;
      const scale = new Array<number>(n);
      for (let it = 0; it < 12; it++) {
        const R0 = residual(wc);
        const J = newtonMatrix(tNew, wc, c0, residual, R0);
        const solve = _factorSolver(J, n);
        const dw = solve(R0.map((v) => -v));
        if (!dw.every((v) => Number.isFinite(v))) break;
        for (let i = 0; i < n; i++) {
          wc[i] += dw[i];
          scale[i] = atol + rtol * Math.abs(wc[i]);
        }
        if (_wrms(dw, scale) <= newtonTol) {
          converged = true;
          break;
        }
      }

      if (!converged) {
        h *= 0.5;
        continue;
      }

      // --- Local error estimate: corrector minus predictor, weighted. ---
      for (let i = 0; i < n; i++) scale[i] = atol + rtol * Math.abs(wc[i]);
      const errNorm = _wrms(
        wc.map((v, i) => v - wPred[i]),
        scale
      );

      if (errNorm <= 1 || h <= minStep) {
        wNew = wc;
        acceptedTime = tNew;
        accepted = true;
      }

      // Step-size control (order-k local error ⇒ exponent 1/(order+1)), clamped.
      const factor = errNorm === 0 ? 4 : 0.9 * Math.pow(errNorm, -1 / (order + 1));
      h *= Math.min(4, Math.max(0.2, factor));
      if (h > maxStep) h = maxStep;
    }

    // Commit the accepted step: advance time, push onto history + output.
    w = wNew;
    t = acceptedTime;
    histT.unshift(t);
    histW.unshift(w.slice());
    if (histT.length > maxOrder + 2) {
      histT.pop();
      histW.pop();
    }
    tOut.push(t);
    yOut.push(yOf(w));
    zOut.push(zOf(w));
  }

  if (iter >= maxIter) {
    throw new Error(
      'solveDAE: maximum number of steps reached — try loosening tol or raising maxIter'
    );
  }

  return {
    t: tOut,
    y: yScalar ? yOut.map((v) => v[0]) : yOut,
    z: zScalar ? zOut.map((v) => v[0]) : zOut,
  };
}
