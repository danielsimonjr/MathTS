import { isUnit, isNumber, isBigNumber } from '../utils/is.js';
import { factory } from '../utils/factory.js';
import { wasmLoader } from '../wasm/WasmLoader.js';
import { DenseMatrix, lu, luSolve } from '@danielsimonjr/mathts-matrix';
import type { MathNumericType, MathArray, Matrix, Unit, BigNumber } from '../types.js';

// Minimum y0 vector size for WASM acceleration to be beneficial
const WASM_ODE_THRESHOLD = 10;

const name = 'solveODE';
const dependencies = [
  'typed',
  'add',
  'subtract',
  'multiply',
  'divide',
  'max',
  'map',
  'abs',
  'isPositive',
  'isNegative',
  'larger',
  'smaller',
  'matrix',
  'bignumber',
  'unaryMinus',
] as const;

/**
 * Butcher Tableau structure for Runge-Kutta methods
 */
interface ButcherTableau {
  a: number[][] | BigNumber[][];
  c: (number | null)[] | (BigNumber | null)[];
  b: number[] | BigNumber[];
  bp: number[] | BigNumber[];
}

/**
 * An event function `g(t, y)` whose zero crossings `solveODE` locates. May carry scipy-style
 * `terminal`/`direction` attributes directly on the function object.
 *
 * - `terminal`: `true` (stop at the first crossing), a positive integer (stop after that many
 *   crossings), or omitted/`false` (record every crossing, never stop).
 * - `direction`: `+1` (trigger only on `−`→`+` crossings), `−1` (only `+`→`−`), or `0`/omitted
 *   (either direction).
 *
 * The state `y` is passed in the same shape the forcing function receives it (a `number[]` — a
 * length-1 array for a scalar ODE).
 */
interface EventFunction {
  (t: number, y: number[]): number;
  terminal?: boolean | number;
  direction?: number;
}

/** Object form of an ODE event: the function plus its `terminal`/`direction` attributes. */
interface EventSpec {
  event: (t: number, y: number[]) => number;
  terminal?: boolean | number;
  direction?: number;
}

/** One event, or an array of events, accepted by the `events` option. */
type ODEEvents = EventFunction | EventSpec | Array<EventFunction | EventSpec>;

/** Internal normalised event: `terminal` as a crossing count (0 = never), `direction` as −1/0/+1. */
interface NormalizedEvent {
  g: (t: number, y: number[]) => number;
  terminal: number;
  direction: number;
}

/**
 * Options for ODE solver
 */
interface ODEOptions {
  method?: 'RK23' | 'RK45' | 'Rosenbrock' | 'RODAS' | 'BDF' | 'Radau';
  tol?: number;
  firstStep?: number | Unit;
  minStep?: number | Unit;
  maxStep?: number | Unit;
  minDelta?: number;
  maxDelta?: number;
  maxIter?: number;
  /**
   * Analytic Jacobian ∂fᵢ/∂yⱼ of the forcing function, used by the stiff methods (`Rosenbrock`
   * and `RODAS`) in place of the default finite-difference Jacobian. Must return an n×n matrix
   * (n = state dimension). Ignored by the explicit RK23/RK45 methods.
   */
  jac?: (t: number, y: number[]) => number[][];
  /**
   * Event detection (scipy `solve_ivp`-style). One event function `g(t, y)` or an array of them;
   * `solveODE` locates each zero crossing between accepted steps and reports it in `tEvents`/
   * `yEvents`. A `terminal` event stops the integration at its crossing; `direction` filters the
   * crossing sign. Requires plain-number state (throws otherwise). See {@link EventFunction}.
   */
  events?: ODEEvents;
}

/**
 * Solution result from ODE solver
 */
interface ODESolution<T = unknown> {
  t: T[];
  y: T[];
  /** Event crossing times, one array per event function (present only when `events` was given). */
  tEvents?: number[][];
  /** Event states, one array per event function, aligned with `tEvents`. */
  yEvents?: T[][];
}

/**
 * Forcing function type for ODE
 */
type ForcingFunction = (
  t: MathNumericType,
  y: MathNumericType | MathArray
) => MathNumericType | MathArray;

/** Root-mean-square norm of a plain-number state vector, used for initial-step selection. */
function _rmsNorm(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s / v.length);
}

/**
 * Inline dense solve of `A·x = b` by Gaussian elimination with partial pivoting (A and b copied,
 * not mutated). Retained for the *small* iteration matrices the stiff solvers actually use.
 */
function _inlineLuSolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r) => r.slice());
  const x = b.slice();
  for (let k = 0; k < n; k++) {
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
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
 * Threshold (state dimension) at or above which the stiff step routes its per-step linear solve
 * onto the maintained `@danielsimonjr/mathts-matrix` LU primitive. Measured crossover: for the
 * tiny iteration matrices typical of stiff ODEs (n = 1–3 across the whole test corpus) the inline
 * elimination is 1.8×–8× faster — the matrix `DenseMatrix`/`lu()` allocation overhead dwarfs the
 * trivial O(n³) factorisation. Factor-once via the matrix primitive only overtakes it at n ≈ 8
 * (up to 4× faster by n = 40), the same crossover the `matrix/native-accel.ts` `det`/`inv`
 * fast-paths use. So we keep inline below and route above.
 */
const LU_ROUTE_THRESHOLD = 8;

/**
 * Return a solver for `A·x = b` reused across the 3–6 right-hand sides a single stiff step solves
 * against the same iteration matrix (W for Rosenbrock, E for RODAS).
 *
 * Small systems (n < {@link LU_ROUTE_THRESHOLD}) use the allocation-light inline elimination.
 * Large systems factor `A` **once** with the matrix `lu()` primitive (per
 * project-two-decomposition-layers-prefer-matrix) and solve each RHS with `luSolve` — one O(n³)
 * factorisation instead of the old inline's re-factorisation per RHS.
 *
 * Numerics are unchanged on the small path (identical inline code) and, on the large path, the
 * matrix `lu()` uses the same partial-pivoting strategy and elimination arithmetic, so results
 * match to rounding (well within the solver's `tol`). The one edge case — a singular iteration
 * matrix — made the inline solve emit NaN/Inf (division by zero), which fails the embedded error
 * test and rejects the step (h is then reduced); the matrix `lu()` throws "singular" instead, so
 * we catch it and return a NaN vector to preserve that step-rejection behaviour.
 */
export function _factorSolver(A: number[][], n: number): (b: number[]) => number[] {
  if (n < LU_ROUTE_THRESHOLD) {
    return (b: number[]) => _inlineLuSolve(A, b);
  }
  try {
    const fac = lu(DenseMatrix.fromArray(A));
    return (b: number[]) => luSolve(fac, b);
  } catch {
    return () => new Array<number>(n).fill(NaN);
  }
}

/**
 * Evaluate the forcing function and coerce the result to a plain-number array. A scalar ODE's
 * state is internally the wrapped `[v]`, but a scalar `f` returns a bare number (JS coerces
 * `-[v]`→`-v`), so every stiff-solver evaluation normalises the shape.
 */
function _fArr(f: ForcingFunction, t: number, y: number[]): number[] {
  const r = f(t, y);
  return (Array.isArray(r) ? r : [r]) as number[];
}

/** Finite-difference Jacobian ∂fᵢ/∂yⱼ of the forcing function at (t, y), for the stiff method. */
function _fdJacobian(f: ForcingFunction, t: number, y: number[], f0: number[]): number[][] {
  const n = y.length;
  const J: number[][] = Array.from({ length: n }, () => new Array<number>(n));
  for (let j = 0; j < n; j++) {
    const eps = Math.max(1e-8, 1e-7 * Math.abs(y[j]));
    const yj = y.slice();
    yj[j] += eps;
    const fj = _fArr(f, t, yj);
    for (let i = 0; i < n; i++) J[i][j] = (fj[i] - f0[i]) / eps;
  }
  return J;
}

/**
 * Jacobian ∂fᵢ/∂yⱼ at (t, y) for the stiff methods: the user-supplied analytic `jac` when present
 * (validated to be n×n, throwing clearly on a shape mismatch), otherwise the finite-difference
 * Jacobian. Keeping the FD path when `jac` is omitted preserves backward compatibility.
 */
function _jacobianAt(
  f: ForcingFunction,
  t: number,
  y: number[],
  f0: number[],
  options: ODEOptions
): number[][] {
  const n = y.length;
  if (options.jac) {
    const J = options.jac(t, y);
    const ok =
      Array.isArray(J) &&
      J.length === n &&
      J.every((row) => Array.isArray(row) && row.length === n);
    if (!ok) {
      throw new Error(
        `The "jac" option must return an ${n}×${n} matrix (n = state dimension); got a mismatched shape`
      );
    }
    return J;
  }
  return _fdJacobian(f, t, y, f0);
}

/** Finite-difference ∂f/∂t at (t, y), used by RODAS to retain 4th order on non-autonomous systems. */
function _fdTimeDerivative(f: ForcingFunction, t: number, y: number[], f0: number[]): number[] {
  const delt = Math.sqrt(Number.EPSILON * Math.max(1e-5, Math.abs(t)));
  const fp = _fArr(f, t + delt, y);
  return f0.map((v, i) => (fp[i] - v) / delt);
}

// ---------------------------------------------------------------------------------------------
// Event detection (scipy solve_ivp-style) — pure numeric helpers, plain-number state only.
// ---------------------------------------------------------------------------------------------

/** Normalise `terminal` (true → 1, positive int → that count, else 0 = non-terminal). */
function _terminalCount(t: boolean | number | undefined): number {
  if (t === true) return 1;
  if (typeof t === 'number' && t > 0) return Math.floor(t);
  return 0;
}

/** Normalise `direction` to −1, 0, or +1. */
function _directionSign(d: number | undefined): number {
  return typeof d === 'number' && d !== 0 ? Math.sign(d) : 0;
}

/** Normalise the `events` option (function/attributes or object form, single or array). */
function _normalizeEvents(events: ODEEvents): NormalizedEvent[] {
  const list = Array.isArray(events) ? events : [events];
  return list.map((spec) => {
    if (typeof spec === 'function') {
      return {
        g: spec,
        terminal: _terminalCount(spec.terminal),
        direction: _directionSign(spec.direction),
      };
    }
    return {
      g: spec.event,
      terminal: _terminalCount(spec.terminal),
      direction: _directionSign(spec.direction),
    };
  });
}

/**
 * Cubic-Hermite dense interpolation of the state on an accepted step `[ta, tb]`, using the endpoint
 * states `ya`, `yb` and endpoint derivatives `fa = f(ta, ya)`, `fb = f(tb, yb)`. C¹ and O(h⁴)
 * accurate, so an event root located on it matches the true crossing to well under the solver `tol`.
 */
function _hermite(
  ta: number,
  tb: number,
  ya: number[],
  yb: number[],
  fa: number[],
  fb: number[],
  t: number
): number[] {
  const h = tb - ta;
  const theta = h === 0 ? 0 : (t - ta) / h;
  const th2 = theta * theta;
  const th3 = th2 * theta;
  const h00 = 2 * th3 - 3 * th2 + 1;
  const h10 = th3 - 2 * th2 + theta;
  const h01 = -2 * th3 + 3 * th2;
  const h11 = th3 - th2;
  return ya.map((_, i) => h00 * ya[i] + h10 * h * fa[i] + h01 * yb[i] + h11 * h * fb[i]);
}

/**
 * Locate the zero of `gEval` in `[ta, tb]` by bisection, given endpoint values `ga`, `gb` that
 * straddle zero (or `gb === 0`). Works for forward (`ta < tb`) or backward (`ta > tb`) steps.
 */
function _bisectEventRoot(
  gEval: (t: number) => number,
  ta: number,
  tb: number,
  ga: number,
  gb: number
): number {
  if (gb === 0) return tb;
  if (ga === 0) return ta;
  let a = ta;
  let b = tb;
  let gaCur = ga;
  for (let iter = 0; iter < 100; iter++) {
    const m = 0.5 * (a + b);
    const gm = gEval(m);
    if (gm === 0 || Math.abs(b - a) <= 1e-15 * Math.max(1, Math.abs(m))) return m;
    if (gaCur < 0 === gm < 0) {
      a = m;
      gaCur = gm;
    } else {
      b = m;
    }
  }
  return 0.5 * (a + b);
}

/** A located event crossing within one accepted step. */
interface EventHit {
  eventIndex: number;
  tStar: number;
  yStar: number[];
}

/**
 * Scan the accepted-step trajectory for zero crossings of each event function, honouring
 * `direction`. Crossings are located by cubic-Hermite interpolation + bisection. `terminal` events
 * stop the scan at their required crossing count; the earliest such terminal crossing across all
 * events is returned as `trunc` (with the step index it falls in) so the caller can truncate the
 * returned solution there.
 *
 * @param dir +1 for forward integration (`tf ≥ t0`), −1 for backward — used to order within-step
 *            crossings in integration order.
 */
function _detectEvents(
  f: ForcingFunction,
  tArr: number[],
  yArr: number[][],
  evs: NormalizedEvent[],
  dir: number
): {
  tEvents: number[][];
  yEvents: number[][];
  trunc: { tStar: number; yStar: number[]; stepIndex: number } | null;
} {
  const nEv = evs.length;
  const tEvents: number[][] = evs.map(() => []);
  const yEvents: number[][][] = evs.map(() => []) as unknown as number[][][];
  const remaining = evs.map((e) => e.terminal); // crossings left before a terminal event fires
  let trunc: { tStar: number; yStar: number[]; stepIndex: number } | null = null;

  let gPrev = evs.map((e) => e.g(tArr[0], yArr[0]));

  for (let i = 0; i < tArr.length - 1 && trunc === null; i++) {
    const ta = tArr[i];
    const tb = tArr[i + 1];
    const ya = yArr[i];
    const yb = yArr[i + 1];
    const gCurr = evs.map((e) => e.g(tb, yb));

    // Endpoint derivatives for the Hermite interpolant — computed at most once per step, lazily.
    let fa: number[] | null = null;
    let fb: number[] | null = null;

    const hits: EventHit[] = [];
    for (let e = 0; e < nEv; e++) {
      const ga = gPrev[e];
      const gb = gCurr[e];
      const up = ga < 0 && gb >= 0; // −→+ crossing (strict on ga avoids recounting a shared endpoint)
      const down = ga > 0 && gb <= 0; // +→− crossing
      if (!up && !down) continue;
      const d = evs[e].direction;
      if (d > 0 && !up) continue;
      if (d < 0 && !down) continue;

      let tStar: number;
      let yStar: number[];
      if (gb === 0) {
        tStar = tb;
        yStar = yb.slice();
      } else {
        if (fa === null) {
          fa = _fArr(f, ta, ya);
          fb = _fArr(f, tb, yb);
        }
        const interp = (t: number): number[] => _hermite(ta, tb, ya, yb, fa!, fb!, t);
        tStar = _bisectEventRoot((t) => evs[e].g(t, interp(t)), ta, tb, ga, gb);
        yStar = interp(tStar);
      }
      hits.push({ eventIndex: e, tStar, yStar });
    }

    // Order crossings within the step in integration order, then commit them.
    hits.sort((p, q) => (dir >= 0 ? p.tStar - q.tStar : q.tStar - p.tStar));
    for (const hit of hits) {
      tEvents[hit.eventIndex].push(hit.tStar);
      yEvents[hit.eventIndex].push(hit.yStar);
      if (remaining[hit.eventIndex] > 0) {
        remaining[hit.eventIndex] -= 1;
        if (remaining[hit.eventIndex] === 0) {
          trunc = { tStar: hit.tStar, yStar: hit.yStar, stepIndex: i };
          break;
        }
      }
    }
    gPrev = gCurr;
  }

  return { tEvents, yEvents: yEvents as unknown as number[][], trunc };
}

/**
 * Apply event detection to a computed numeric solution: attach `tEvents`/`yEvents` and, if a
 * terminal event fired, truncate the trajectory at the crossing. Throws if the state is not plain
 * numeric (events need `g(t, y)` numeric arithmetic). The state inside `solveODE` is always a
 * `number[]` per step (a scalar ODE's state is the wrapped `[v]`).
 */
function _applyEvents(
  f: ForcingFunction,
  sol: { t: unknown[]; y: unknown[] },
  events: ODEEvents,
  dir: number
): ODESolution {
  const numeric =
    sol.y.every((s) => Array.isArray(s) && (s as unknown[]).every((v) => typeof v === 'number')) &&
    sol.t.every((v) => typeof v === 'number');
  if (!numeric) {
    throw new Error('solveODE: the "events" option requires plain-number state and time');
  }
  const tArr = sol.t as number[];
  const yArr = sol.y as number[][];
  const evs = _normalizeEvents(events);
  const { tEvents, yEvents, trunc } = _detectEvents(f, tArr, yArr, evs, dir);

  if (trunc) {
    const keep = trunc.stepIndex + 1; // accepted points up to and including the step's start
    return {
      t: [...tArr.slice(0, keep), trunc.tStar],
      y: [...yArr.slice(0, keep), trunc.yStar],
      tEvents,
      yEvents,
    };
  }
  return { t: tArr, y: yArr, tEvents, yEvents };
}

/**
 * Rosenbrock stiff ODE solver — the linearly-implicit ode23s method (Shampine & Reichelt),
 * L-stable, with an embedded error estimate for adaptive stepping. Unlike the explicit RK23/RK45
 * methods, it stays stable on stiff systems (chemical kinetics, circuits, control) where explicit
 * methods need vanishingly small steps or blow up. One finite-difference Jacobian and one LU
 * factorisation of `W = I − h·γ·J` per step, reused for its three stage solves. Plain-number
 * state only (the Jacobian/linear solve are numeric).
 *
 * This form omits the `h·γ·∂f/∂t` term, so it is exact-2nd-order for **autonomous** systems
 * `f(y)`; for time-dependent `f(t, y)` it drops to 1st order (the adaptive stepper still holds
 * the result to `tol`, just with more steps). The default maxIter is 1e5 for this reason.
 *
 * Module-level (not factory-nested) so it can be called directly both by `createSolveODE`'s
 * `Rosenbrock` method branch and by `stiffODESolver` (`functions/src/typed/numeric.ts`) — a
 * single shared engine instead of two divergent implementations.
 */
export function rosenbrockSolve(
  f: ForcingFunction,
  tspan: unknown[],
  y0raw: unknown[],
  options: ODEOptions = {}
): { t: number[]; y: number[][] } {
  const t0 = tspan[0] as number;
  const tf = tspan[1] as number;
  if (!(typeof t0 === 'number' && typeof tf === 'number')) {
    throw new Error('The "Rosenbrock" stiff method requires numeric tspan');
  }
  if (!(y0raw as unknown[]).every((v) => typeof v === 'number')) {
    throw new Error('The "Rosenbrock" stiff method requires plain-number state (y0)');
  }
  const y0 = y0raw as number[];
  const n = y0.length;
  const dir = tf >= t0 ? 1 : -1;
  const gamma = 1 / (2 + Math.SQRT2);
  const c32 = 6 + Math.SQRT2;
  const rtol = options.tol ? (options.tol as number) : 1e-4;
  const atol = rtol * 1e-3;
  const maxIter = options.maxIter ? options.maxIter : 100_000;
  const span = Math.abs(tf - t0);

  let t = t0;
  let y = y0.slice();
  // Initial step: Hairer heuristic, or the user's firstStep.
  let h: number;
  if (options.firstStep) {
    h = dir * Math.abs(options.firstStep as number);
  } else {
    const f0 = f(t, y) as number[];
    const d0 = _rmsNorm(y);
    const d1 = _rmsNorm(Array.isArray(f0) ? f0 : [f0 as unknown as number]);
    h = dir * Math.min(d0 < 1e-5 || d1 < 1e-5 ? 1e-6 : 0.01 * (d0 / d1), span);
  }

  const tOut: number[] = [t];
  const yOut: number[][] = [y.slice()];
  let iter = 0;
  const identityMinus = (J: number[][], hg: number): number[][] =>
    J.map((row, i) => row.map((v, j) => (i === j ? 1 : 0) - hg * v));

  while ((dir > 0 ? t < tf : t > tf) && iter < maxIter) {
    if (Math.abs(h) > Math.abs(tf - t)) h = tf - t; // don't overshoot
    const F0 = _fArr(f, t, y);
    const J = _jacobianAt(f, t, y, F0, options);
    const W = identityMinus(J, h * gamma);
    // Factor W once (matrix-package LU) and solve it against the three stage RHS.
    const solveW = _factorSolver(W, n);

    const k1 = solveW(F0);
    const y1 = y.map((yi, i) => yi + 0.5 * h * k1[i]);
    const F1 = _fArr(f, t + 0.5 * h, y1);
    const dk = solveW(F1.map((v, i) => v - k1[i]));
    const k2 = k1.map((v, i) => v + dk[i]);
    const yNew = y.map((yi, i) => yi + h * k2[i]);
    const F2 = _fArr(f, t + h, yNew);
    const k3 = solveW(F2.map((v, i) => v - c32 * (k2[i] - F1[i]) - 2 * (k1[i] - F0[i])));

    // Embedded error estimate and its scaled RMS norm.
    let errNorm = 0;
    for (let i = 0; i < n; i++) {
      const err = (h / 6) * (k1[i] - 2 * k2[i] + k3[i]);
      const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(yNew[i]));
      errNorm += (err / sc) ** 2;
    }
    errNorm = Math.sqrt(errNorm / n);

    if (errNorm <= 1 || Math.abs(h) <= 1e-14 * Math.abs(t)) {
      t += h;
      y = yNew;
      tOut.push(t);
      yOut.push(y.slice());
    }
    // Step-size control (order-2 method → exponent 1/3), clamped to avoid wild swings.
    h *= Math.min(4, Math.max(0.25, 0.9 * Math.pow(errNorm || 1e-10, -1 / 3)));
    // Honour the same minStep/maxStep bounds as the RK paths (magnitude, sign preserved).
    const maxStepR = options.maxStep as number | undefined;
    const minStepR = options.minStep as number | undefined;
    if (maxStepR && Math.abs(h) > maxStepR) h = dir * maxStepR;
    else if (minStepR && Math.abs(h) < minStepR) h = dir * minStepR;
    iter++;
  }
  if (iter >= maxIter) {
    throw new Error('Maximum number of iterations reached, try changing options');
  }
  return { t: tOut, y: yOut };
}

/**
 * RODAS coefficient tableau (Hairer & Wanner, "Solving Ordinary Differential Equations II",
 * Section IV.7) — the 4th-order, 6-stage, L-stable, stiffly-accurate Rosenbrock method. The
 * `a_ij` combine the stage states, the `c_ij` combine the stage increments (divided by h), the
 * `d_i` weight the ∂f/∂t term, `alpha_i` are the internal time points, and `gamma` is the common
 * diagonal. The propagated solution is stiffly accurate — y_{n+1} = y_n + a51·k1 + a52·k2 +
 * a53·k3 + a54·k4 + k5 + k6 — and the last increment k6 is exactly the embedded 3rd-order error
 * estimate. Verified numerically to integrate a linear stiff system to 4th order (halving h drops
 * the error ~16×) and to match scipy Radau on the Robertson problem.
 */
const RODAS = {
  gamma: 0.25,
  alpha2: 0.386,
  alpha3: 0.21,
  alpha4: 0.63,
  d1: 0.25,
  d2: -0.1043,
  d3: 0.1035,
  d4: -0.03620000000000023,
  a21: 1.544,
  a31: 0.9466785280815826,
  a32: 0.2557011698983284,
  a41: 3.314825187068521,
  a42: 2.896124015972201,
  a43: 0.9986419139977817,
  a51: 1.221224509226641,
  a52: 6.019134481288629,
  a53: 12.53708332932087,
  a54: -0.687886036105895,
  C21: -5.6688,
  C31: -2.430093356833875,
  C32: -0.2063599157091915,
  C41: -0.1073529058151375,
  C42: -9.594562251023355,
  C43: -20.47028614809616,
  C51: 7.496443313967647,
  C52: -10.24680431464352,
  C53: -33.99990352819905,
  C54: 11.7089089320616,
  C61: 8.083246795921522,
  C62: -7.981132988064893,
  C63: -31.52159432874371,
  C64: 16.31930543123136,
  C65: -6.058818238834054,
} as const;

/**
 * RODAS stiff ODE solver — Hairer & Wanner's 4th-order, 6-stage, L-stable Rosenbrock method. Like
 * the 2nd-order `rosenbrockSolve` (ode23s) it is linearly implicit: it forms the iteration matrix
 * `E = I/(γh) − J` once per step (Jacobian J analytic via `options.jac` or finite-differenced),
 * LU-factorises it, and solves it against six successive right-hand sides. Being 4th order it
 * reaches tight tolerances (rtol < 1e-6) in far fewer steps than ode23s, whose 2nd order forces
 * many small steps there. It retains the `h·d_i·∂f/∂t` term (∂f/∂t finite-differenced once per
 * step) so it stays 4th order on non-autonomous systems `f(t, y)`.
 *
 * Module-level (not factory-nested) for the same reason as `rosenbrockSolve`: pure numeric helpers
 * with no factory-scope dependency. Plain-number state only (the Jacobian/linear solve are numeric).
 */
export function rodasSolve(
  f: ForcingFunction,
  tspan: unknown[],
  y0raw: unknown[],
  options: ODEOptions = {}
): { t: number[]; y: number[][] } {
  const t0 = tspan[0] as number;
  const tf = tspan[1] as number;
  if (!(typeof t0 === 'number' && typeof tf === 'number')) {
    throw new Error('The "RODAS" stiff method requires numeric tspan');
  }
  if (!(y0raw as unknown[]).every((v) => typeof v === 'number')) {
    throw new Error('The "RODAS" stiff method requires plain-number state (y0)');
  }
  const y0 = y0raw as number[];
  const n = y0.length;
  const dir = tf >= t0 ? 1 : -1;
  const g = RODAS.gamma;
  const rtol = options.tol ? (options.tol as number) : 1e-4;
  const atol = rtol * 1e-3;
  const maxIter = options.maxIter ? options.maxIter : 100_000;
  const span = Math.abs(tf - t0);

  let t = t0;
  let y = y0.slice();
  let h: number;
  if (options.firstStep) {
    h = dir * Math.abs(options.firstStep as number);
  } else {
    const f0 = f(t, y) as number[];
    const d0 = _rmsNorm(y);
    const d1 = _rmsNorm(Array.isArray(f0) ? f0 : [f0 as unknown as number]);
    h = dir * Math.min(d0 < 1e-5 || d1 < 1e-5 ? 1e-6 : 0.01 * (d0 / d1), span);
  }

  const tOut: number[] = [t];
  const yOut: number[][] = [y.slice()];
  let iter = 0;

  while ((dir > 0 ? t < tf : t > tf) && iter < maxIter) {
    if (Math.abs(h) > Math.abs(tf - t)) h = tf - t; // don't overshoot
    const F0 = _fArr(f, t, y);
    const J = _jacobianAt(f, t, y, F0, options);
    const fx = _fdTimeDerivative(f, t, y, F0);
    // Iteration matrix E = I/(γh) − J, factored once and solved against each stage RHS.
    const E = J.map((row, i) => row.map((v, j) => (i === j ? 1 / (g * h) : 0) - v));
    const solveE = _factorSolver(E, n);

    const k1 = solveE(F0.map((v, i) => v + h * RODAS.d1 * fx[i]));
    const g2 = y.map((yi, i) => yi + RODAS.a21 * k1[i]);
    const f2 = _fArr(f, t + RODAS.alpha2 * h, g2);
    const k2 = solveE(f2.map((v, i) => v + (RODAS.C21 * k1[i]) / h + h * RODAS.d2 * fx[i]));
    const g3 = y.map((yi, i) => yi + RODAS.a31 * k1[i] + RODAS.a32 * k2[i]);
    const f3 = _fArr(f, t + RODAS.alpha3 * h, g3);
    const k3 = solveE(
      f3.map((v, i) => v + (RODAS.C31 * k1[i] + RODAS.C32 * k2[i]) / h + h * RODAS.d3 * fx[i])
    );
    const g4 = y.map((yi, i) => yi + RODAS.a41 * k1[i] + RODAS.a42 * k2[i] + RODAS.a43 * k3[i]);
    const f4 = _fArr(f, t + RODAS.alpha4 * h, g4);
    const k4 = solveE(
      f4.map(
        (v, i) =>
          v + (RODAS.C41 * k1[i] + RODAS.C42 * k2[i] + RODAS.C43 * k3[i]) / h + h * RODAS.d4 * fx[i]
      )
    );
    const g5 = y.map(
      (yi, i) => yi + RODAS.a51 * k1[i] + RODAS.a52 * k2[i] + RODAS.a53 * k3[i] + RODAS.a54 * k4[i]
    );
    const f5 = _fArr(f, t + h, g5);
    const k5 = solveE(
      f5.map(
        (v, i) =>
          v + (RODAS.C51 * k1[i] + RODAS.C52 * k2[i] + RODAS.C53 * k3[i] + RODAS.C54 * k4[i]) / h
      )
    );
    // Stiffly-accurate: g6 = y + Σ a5i·ki + k5 is already the 3rd-order embedded solution.
    const g6 = g5.map((v, i) => v + k5[i]);
    const f6 = _fArr(f, t + h, g6);
    const k6 = solveE(
      f6.map(
        (v, i) =>
          v +
          (RODAS.C61 * k1[i] +
            RODAS.C62 * k2[i] +
            RODAS.C63 * k3[i] +
            RODAS.C64 * k4[i] +
            RODAS.C65 * k5[i]) /
            h
      )
    );
    const yNew = g6.map((v, i) => v + k6[i]); // 4th-order solution; k6 is the error estimate.

    // Embedded (order-3) error estimate is exactly k6; scaled RMS norm.
    let errNorm = 0;
    for (let i = 0; i < n; i++) {
      const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(yNew[i]));
      errNorm += (k6[i] / sc) ** 2;
    }
    errNorm = Math.sqrt(errNorm / n);

    if (errNorm <= 1 || Math.abs(h) <= 1e-14 * Math.abs(t)) {
      t += h;
      y = yNew;
      tOut.push(t);
      yOut.push(y.slice());
    }
    // Step-size control (order-4 method → exponent 1/4), clamped to avoid wild swings.
    h *= Math.min(6, Math.max(0.2, 0.9 * Math.pow(errNorm || 1e-10, -1 / 4)));
    const maxStepR = options.maxStep as number | undefined;
    const minStepR = options.minStep as number | undefined;
    if (maxStepR && Math.abs(h) > maxStepR) h = dir * maxStepR;
    else if (minStepR && Math.abs(h) < minStepR) h = dir * minStepR;
    iter++;
  }
  if (iter >= maxIter) {
    throw new Error('Maximum number of iterations reached, try changing options');
  }
  return { t: tOut, y: yOut };
}

// =================================================================================================
// Shared numeric helpers for the higher-order implicit stiff methods (BDF, Radau)
// =================================================================================================

const _EPS = Number.EPSILON;

/** scipy-style RMS norm `‖x‖₂ / √n` (used by BDF/Radau error control, matching `solve_ivp`). */
function _rms(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s / v.length);
}

/**
 * Empirically-chosen initial step (Hairer & Wanner II.4, the exact routine scipy's `solve_ivp`
 * uses via `select_initial_step`). `order` is the error-estimator order (1 for BDF, 3 for Radau).
 * Costs one extra `f` evaluation. Returns a positive magnitude.
 */
function _selectInitialStep(
  f: ForcingFunction,
  t0: number,
  y0: number[],
  tf: number,
  maxStep: number,
  f0: number[],
  dir: number,
  order: number,
  rtol: number,
  atol: number
): number {
  const interval = Math.abs(tf - t0);
  if (interval === 0) return 0;
  const scale = y0.map((yi) => atol + Math.abs(yi) * rtol);
  const d0 = _rms(y0.map((yi, i) => yi / scale[i]));
  const d1 = _rms(f0.map((fi, i) => fi / scale[i]));
  let h0 = d0 < 1e-5 || d1 < 1e-5 ? 1e-6 : 0.01 * (d0 / d1);
  h0 = Math.min(h0, interval);
  const y1 = y0.map((yi, i) => yi + h0 * dir * f0[i]);
  const f1 = _fArr(f, t0 + h0 * dir, y1);
  const d2 = _rms(f1.map((v, i) => (v - f0[i]) / scale[i])) / h0;
  const h1 =
    d1 <= 1e-15 && d2 <= 1e-15
      ? Math.max(1e-6, h0 * 1e-3)
      : Math.pow(0.01 / Math.max(d1, d2), 1 / (order + 1));
  return Math.min(100 * h0, h1, interval, maxStep);
}

/** Newton tolerance shared by both implicit methods (scipy: `max(10ε/rtol, min(0.03, √rtol))`). */
function _newtonTol(rtol: number): number {
  return Math.max((10 * _EPS) / rtol, Math.min(0.03, Math.sqrt(rtol)));
}

/** Minimum step magnitude guard (scipy uses `10·ulp(t)`; this is the same order of magnitude). */
function _minStep(t: number): number {
  return 10 * _EPS * Math.max(1, Math.abs(t));
}

/** Dense (m×m)·(m×m) matrix product for the small BDF difference-array transforms. */
function _matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const p = B[0].length;
  const q = B.length;
  const out: number[][] = Array.from({ length: m }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < q; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < p; j++) out[i][j] += aik * B[k][j];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// BDF — variable-order (1–5) variable-step backward differentiation (scipy's default stiff method,
// NDF-enhanced per Shampine & Reichelt "The MATLAB ODE Suite"). Faithful port of scipy's
// `scipy.integrate.BDF`: the difference-array representation `D`, quasi-constant step size via
// `change_D`, modified-formula coefficients `kappa`, and simplified-Newton on `(I − c·J)`.
// ---------------------------------------------------------------------------------------------

const BDF_MAX_ORDER = 5;
const BDF_NEWTON_MAXITER = 4;
const BDF_MIN_FACTOR = 0.2;
const BDF_MAX_FACTOR = 10;

const BDF_KAPPA = [0, -0.185, -1 / 9, -0.0823, -0.0415, 0];
// gamma = [0, cumsum(1/1..1/5)]
const BDF_GAMMA = (() => {
  const g = [0];
  let acc = 0;
  for (let i = 1; i <= BDF_MAX_ORDER; i++) {
    acc += 1 / i;
    g.push(acc);
  }
  return g;
})();
const BDF_ALPHA = BDF_KAPPA.map((k, i) => (1 - k) * BDF_GAMMA[i]);
// error_const = kappa*gamma + 1/arange(1, MAX_ORDER+2)  (length MAX_ORDER+1 = 6)
const BDF_ERROR_CONST = BDF_KAPPA.map((k, i) => k * BDF_GAMMA[i] + 1 / (i + 1));

/**
 * `compute_R(order, factor)` from scipy — the (order+1)×(order+1) matrix (cumulative product down
 * columns) used to rescale the difference array `D` when the step size changes.
 */
function _bdfComputeR(order: number, factor: number): number[][] {
  const M: number[][] = Array.from({ length: order + 1 }, () =>
    new Array<number>(order + 1).fill(0)
  );
  for (let j = 0; j <= order; j++) M[0][j] = 1;
  for (let i = 1; i <= order; i++) {
    for (let j = 1; j <= order; j++) M[i][j] = (i - 1 - factor * j) / i;
  }
  // cumulative product down each column
  for (let j = 0; j <= order; j++) {
    for (let i = 1; i <= order; i++) M[i][j] *= M[i - 1][j];
  }
  return M;
}

/** Rescale the difference array `D[0..order]` in place for a step-size change by `factor`. */
function _bdfChangeD(D: number[][], order: number, factor: number): void {
  const R = _bdfComputeR(order, factor);
  const U = _bdfComputeR(order, 1);
  const RU = _matMul(R, U); // (order+1)×(order+1)
  // newTop[i] = Σ_j RU[j][i] · D[j]   (i.e. RUᵀ · D[:order+1])
  const n = D[0].length;
  const newTop: number[][] = Array.from({ length: order + 1 }, () => new Array<number>(n).fill(0));
  for (let i = 0; i <= order; i++) {
    for (let j = 0; j <= order; j++) {
      const c = RU[j][i];
      if (c === 0) continue;
      const Dj = D[j];
      const row = newTop[i];
      for (let k = 0; k < n; k++) row[k] += c * Dj[k];
    }
  }
  for (let i = 0; i <= order; i++) D[i] = newTop[i];
}

/**
 * Solve the implicit BDF algebraic system by simplified Newton on `(I − c·J)`, given a pre-factored
 * solver `solveW`. Faithful port of scipy's `solve_bdf_system` (rate-based convergence test).
 */
function _bdfNewton(
  f: ForcingFunction,
  tNew: number,
  yPredict: number[],
  c: number,
  psi: number[],
  solveW: (b: number[]) => number[],
  scale: number[],
  tol: number
): { converged: boolean; nIter: number; y: number[]; d: number[] } {
  const n = yPredict.length;
  const d = new Array<number>(n).fill(0);
  const y = yPredict.slice();
  let dyNormOld: number | null = null;
  let converged = false;
  let k = 0;
  for (; k < BDF_NEWTON_MAXITER; k++) {
    const fv = _fArr(f, tNew, y);
    if (!fv.every((v) => Number.isFinite(v))) break;
    const rhs = fv.map((v, i) => c * v - psi[i] - d[i]);
    const dy = solveW(rhs);
    const dyNorm = _rms(dy.map((v, i) => v / scale[i]));
    const rate = dyNormOld === null ? null : dyNorm / dyNormOld;
    if (
      rate !== null &&
      (rate >= 1 || (Math.pow(rate, BDF_NEWTON_MAXITER - k) / (1 - rate)) * dyNorm > tol)
    ) {
      break;
    }
    for (let i = 0; i < n; i++) {
      y[i] += dy[i];
      d[i] += dy[i];
    }
    if (dyNorm === 0 || (rate !== null && (rate / (1 - rate)) * dyNorm < tol)) {
      converged = true;
      k++;
      break;
    }
    dyNormOld = dyNorm;
  }
  return { converged, nIter: k, y, d };
}

/**
 * BDF variable-order (1–5) variable-step stiff solver — scipy's default `method='BDF'`. Adaptive
 * local-error control drives step size and order (1–5) automatically; Newton iteration on the
 * implicit BDF formula reuses the shared Jacobian machinery and the `(I − c·J)` dense LU solve
 * (`_factorSolver`) the Rosenbrock/RODAS paths use. Plain-number state only.
 *
 * Module-level for the same reason as `rosenbrockSolve`/`rodasSolve`: a pure-numeric engine with no
 * factory-scope dependency, routed from `createSolveODE`'s `BDF` method branch.
 */
export function bdfSolve(
  f: ForcingFunction,
  tspan: unknown[],
  y0raw: unknown[],
  options: ODEOptions = {}
): { t: number[]; y: number[][] } {
  const t0 = tspan[0] as number;
  const tf = tspan[1] as number;
  if (!(typeof t0 === 'number' && typeof tf === 'number')) {
    throw new Error('The "BDF" stiff method requires numeric tspan');
  }
  if (!(y0raw as unknown[]).every((v) => typeof v === 'number')) {
    throw new Error('The "BDF" stiff method requires plain-number state (y0)');
  }
  const y0 = y0raw as number[];
  const n = y0.length;
  const dir = tf >= t0 ? 1 : -1;
  const rtol = options.tol ? (options.tol as number) : 1e-4;
  const atol = rtol * 1e-3;
  const maxIter = options.maxIter ? options.maxIter : 100_000;
  const maxStep = (options.maxStep as number | undefined) ?? Infinity;
  const newtonTol = _newtonTol(rtol);

  let t = t0;
  let y = y0.slice();
  const f0 = _fArr(f, t, y);
  let hAbs = options.firstStep
    ? Math.abs(options.firstStep as number)
    : _selectInitialStep(f, t0, y0, tf, maxStep, f0, dir, 1, rtol, atol);

  // Difference array D (MAX_ORDER+3 rows × n); D[0]=y, D[1]=h·f (scaled first difference).
  const D: number[][] = Array.from({ length: BDF_MAX_ORDER + 3 }, () =>
    new Array<number>(n).fill(0)
  );
  D[0] = y.slice();
  D[1] = f0.map((v) => v * hAbs * dir);

  let order = 1;
  let nEqualSteps = 0;

  const tOut: number[] = [t];
  const yOut: number[][] = [y.slice()];
  let iter = 0;

  while ((dir > 0 ? t < tf : t > tf) && iter < maxIter) {
    iter++;
    const minStep = _minStep(t);
    if (hAbs > maxStep) {
      _bdfChangeD(D, order, maxStep / hAbs);
      hAbs = maxStep;
      nEqualSteps = 0;
    } else if (hAbs < minStep) {
      _bdfChangeD(D, order, minStep / hAbs);
      hAbs = minStep;
      nEqualSteps = 0;
    }

    // Jacobian is recomputed at the start of each step (analytic `jac` or finite-difference),
    // reused across the accept/reject retries below — simpler and more robust than scipy's lazy-J
    // (which only refreshes on Newton failure); efficiency-only difference, same numerics.
    const F0 = _fArr(f, t, y);
    const J = _jacobianAt(f, t, y, F0, options);

    let stepAccepted = false;
    let yNew: number[];
    let dVec: number[] = new Array<number>(n).fill(0);
    let errorNorm = 0;
    let nIter = 1;
    let scale: number[] = new Array<number>(n).fill(1);

    while (!stepAccepted) {
      if (hAbs < minStep) {
        throw new Error('Required step size is less than spacing between numbers (BDF)');
      }
      let h = hAbs * dir;
      let tNew = t + h;
      if (dir * (tNew - tf) > 0) {
        tNew = tf;
        _bdfChangeD(D, order, Math.abs(tNew - t) / hAbs);
        nEqualSteps = 0;
      }
      h = tNew - t;
      hAbs = Math.abs(h);

      const yPredict = new Array<number>(n).fill(0);
      for (let j = 0; j <= order; j++) for (let k = 0; k < n; k++) yPredict[k] += D[j][k];

      scale = yPredict.map((v) => atol + rtol * Math.abs(v));
      const psi = new Array<number>(n).fill(0);
      for (let k = 0; k < n; k++) {
        let s = 0;
        for (let j = 1; j <= order; j++) s += D[j][k] * BDF_GAMMA[j];
        psi[k] = s / BDF_ALPHA[order];
      }

      const c = h / BDF_ALPHA[order];
      // W = I − c·J, factored once and reused across Newton iterations.
      const W = J.map((rowv, i) => rowv.map((v, j) => (i === j ? 1 : 0) - c * v));
      const solveW = _factorSolver(W, n);
      const res = _bdfNewton(f, tNew, yPredict, c, psi, solveW, scale, newtonTol);

      if (!res.converged) {
        hAbs *= 0.5;
        _bdfChangeD(D, order, 0.5);
        nEqualSteps = 0;
        continue;
      }
      nIter = res.nIter;
      yNew = res.y;
      dVec = res.d;
      const safety = (0.9 * (2 * BDF_NEWTON_MAXITER + 1)) / (2 * BDF_NEWTON_MAXITER + nIter);
      scale = yNew.map((v) => atol + rtol * Math.abs(v));
      errorNorm = _rms(dVec.map((v, i) => (BDF_ERROR_CONST[order] * v) / scale[i]));
      if (errorNorm > 1) {
        const factor = Math.max(BDF_MIN_FACTOR, safety * Math.pow(errorNorm, -1 / (order + 1)));
        hAbs *= factor;
        _bdfChangeD(D, order, factor);
        nEqualSteps = 0;
      } else {
        stepAccepted = true;
      }

      // Advance time only on acceptance (uses the accepted h implicitly via tNew).
      if (stepAccepted) {
        t = tNew;
        y = yNew;
        tOut.push(t);
        yOut.push(y.slice());
      }
    }

    nEqualSteps++;
    const safety = (0.9 * (2 * BDF_NEWTON_MAXITER + 1)) / (2 * BDF_NEWTON_MAXITER + nIter);

    // Update the difference array: D^{order+2} = d − D^{order+1}; D^{order+1} = d; roll down.
    for (let k = 0; k < n; k++) {
      D[order + 2][k] = dVec[k] - D[order + 1][k];
      D[order + 1][k] = dVec[k];
    }
    for (let i = order; i >= 0; i--) for (let k = 0; k < n; k++) D[i][k] += D[i + 1][k];

    // Hold the order/step for order+1 equal steps before reconsidering (quasi-constant stepping).
    if (nEqualSteps < order + 1) continue;

    const errM =
      order > 1
        ? _rms(D[order].map((v, i) => (BDF_ERROR_CONST[order - 1] * v) / scale[i]))
        : Infinity;
    const errP =
      order < BDF_MAX_ORDER
        ? _rms(D[order + 2].map((v, i) => (BDF_ERROR_CONST[order + 1] * v) / scale[i]))
        : Infinity;
    const errNorms = [errM, errorNorm, errP];
    const factors = errNorms.map((e, i) => Math.pow(e, -1 / (order + i)));
    let best = 0;
    for (let i = 1; i < 3; i++) if (factors[i] > factors[best]) best = i;
    order += best - 1;

    const factor = Math.min(BDF_MAX_FACTOR, safety * factors[best]);
    hAbs *= factor;
    _bdfChangeD(D, order, factor);
    nEqualSteps = 0;
  }

  if (iter >= maxIter) {
    throw new Error('Maximum number of iterations reached, try changing options');
  }
  return { t: tOut, y: yOut };
}

// ---------------------------------------------------------------------------------------------
// Radau IIA — 3-stage, order-5, L-stable implicit Runge-Kutta (scipy's `method='Radau'`). scipy
// diagonalises the 3×3 tableau `A` into one real + one complex eigenvalue and solves an n×n real
// and an n×n complex system per Newton step; we instead solve the full real 3n×3n collocation
// system by simplified Newton (real arithmetic throughout — the matrix package's dense LU is real).
// The error estimate reproduces scipy's exactly: `(MU_REAL/h·I − J)⁻¹ (f + Eᵀ·Z/h)`.
// ---------------------------------------------------------------------------------------------

const RADAU_NEWTON_MAXITER = 6;
const RADAU_MIN_FACTOR = 0.2;
const RADAU_MAX_FACTOR = 10;
const _S6 = Math.sqrt(6);
// Butcher tableau A (rows sum to C; last row is stiffly-accurate b), nodes C, error weights E.
const RADAU_A = [
  [(88 - 7 * _S6) / 360, (296 - 169 * _S6) / 1800, (-2 + 3 * _S6) / 225],
  [(296 + 169 * _S6) / 1800, (88 + 7 * _S6) / 360, (-2 - 3 * _S6) / 225],
  [(16 - _S6) / 36, (16 + _S6) / 36, 1 / 9],
];
const RADAU_C = [(4 - _S6) / 10, (4 + _S6) / 10, 1];
const RADAU_E = [(-13 - 7 * _S6) / 3, (-13 + 7 * _S6) / 3, -1 / 3];
const RADAU_MU_REAL = 3 + Math.pow(3, 2 / 3) - Math.pow(3, 1 / 3);

/** Hairer & Wanner IV.8 step-size predictor (scipy's `predict_factor`). */
function _radauPredictFactor(
  hAbs: number,
  hAbsOld: number | null,
  errNorm: number,
  errNormOld: number | null
): number {
  const mult =
    errNormOld === null || hAbsOld === null || errNorm === 0
      ? 1
      : (hAbs / hAbsOld) * Math.pow(errNormOld / errNorm, 0.25);
  return Math.min(1, mult) * Math.pow(errNorm, -0.25);
}

/**
 * Simplified-Newton solve of the 3-stage Radau IIA collocation system for the stage increments
 * `Z` (so `Y_i = y + Z_i`), with the Jacobian `J` frozen at `(t, y)`. The 3n×3n Newton matrix
 * `Mᵢₖ = δᵢₖ I − h·Aᵢₖ·J` is factored once and reused across iterations.
 */
function _radauNewton(
  f: ForcingFunction,
  t: number,
  y: number[],
  h: number,
  J: number[][],
  scale: number[],
  tol: number
): { converged: boolean; nIter: number; Z: number[][]; rate: number } {
  const n = y.length;
  const Z = [
    new Array<number>(n).fill(0),
    new Array<number>(n).fill(0),
    new Array<number>(n).fill(0),
  ];
  // Big[3n×3n]: block (i,k) = δᵢₖ·I − h·A[i][k]·J
  const big: number[][] = Array.from({ length: 3 * n }, () => new Array<number>(3 * n).fill(0));
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 3; k++) {
      const a = h * RADAU_A[i][k];
      for (let r = 0; r < n; r++) {
        for (let col = 0; col < n; col++) {
          big[i * n + r][k * n + col] = (i === k && r === col ? 1 : 0) - a * J[r][col];
        }
      }
    }
  }
  const solveBig = _factorSolver(big, 3 * n);

  let dWNormOld: number | null = null;
  let rate = 0;
  let converged = false;
  let k = 0;
  for (; k < RADAU_NEWTON_MAXITER; k++) {
    const F = [
      _fArr(
        f,
        t + RADAU_C[0] * h,
        y.map((yi, r) => yi + Z[0][r])
      ),
      _fArr(
        f,
        t + RADAU_C[1] * h,
        y.map((yi, r) => yi + Z[1][r])
      ),
      _fArr(
        f,
        t + RADAU_C[2] * h,
        y.map((yi, r) => yi + Z[2][r])
      ),
    ];
    if (!F.every((row) => row.every((v) => Number.isFinite(v)))) break;

    // rhs = −G,  Gᵢ = Zᵢ − h·Σⱼ Aᵢⱼ·Fⱼ
    const rhs = new Array<number>(3 * n).fill(0);
    for (let i = 0; i < 3; i++) {
      for (let r = 0; r < n; r++) {
        let acc = Z[i][r];
        for (let j = 0; j < 3; j++) acc -= h * RADAU_A[i][j] * F[j][r];
        rhs[i * n + r] = -acc;
      }
    }
    const dZ = solveBig(rhs);
    let sq = 0;
    for (let i = 0; i < 3; i++) for (let r = 0; r < n; r++) sq += (dZ[i * n + r] / scale[r]) ** 2;
    const dWNorm = Math.sqrt(sq / (3 * n));
    if (dWNormOld !== null) rate = dWNorm / dWNormOld;

    if (
      dWNormOld !== null &&
      (rate >= 1 || (Math.pow(rate, RADAU_NEWTON_MAXITER - k) / (1 - rate)) * dWNorm > tol)
    ) {
      break;
    }
    for (let i = 0; i < 3; i++) for (let r = 0; r < n; r++) Z[i][r] += dZ[i * n + r];
    if (dWNorm === 0 || (dWNormOld !== null && (rate / (1 - rate)) * dWNorm < tol)) {
      converged = true;
      k++;
      break;
    }
    dWNormOld = dWNorm;
  }
  return { converged, nIter: k, Z, rate };
}

/**
 * Radau IIA (order-5, L-stable) stiff solver — scipy's `method='Radau'`. Simplified-Newton on the
 * real 3n×3n collocation system per step (Jacobian analytic via `options.jac` or finite-differenced,
 * reused across the step's Newton iterations), third-order embedded error estimate for adaptive
 * stepping. Plain-number state only.
 *
 * Module-level for the same reason as `rosenbrockSolve`/`rodasSolve`/`bdfSolve`.
 */
export function radauSolve(
  f: ForcingFunction,
  tspan: unknown[],
  y0raw: unknown[],
  options: ODEOptions = {}
): { t: number[]; y: number[][] } {
  const t0 = tspan[0] as number;
  const tf = tspan[1] as number;
  if (!(typeof t0 === 'number' && typeof tf === 'number')) {
    throw new Error('The "Radau" stiff method requires numeric tspan');
  }
  if (!(y0raw as unknown[]).every((v) => typeof v === 'number')) {
    throw new Error('The "Radau" stiff method requires plain-number state (y0)');
  }
  const y0 = y0raw as number[];
  const n = y0.length;
  const dir = tf >= t0 ? 1 : -1;
  const rtol = options.tol ? (options.tol as number) : 1e-4;
  const atol = rtol * 1e-3;
  const maxIter = options.maxIter ? options.maxIter : 100_000;
  const maxStep = (options.maxStep as number | undefined) ?? Infinity;
  const newtonTol = _newtonTol(rtol);

  let t = t0;
  let y = y0.slice();
  let hAbs = options.firstStep
    ? Math.abs(options.firstStep as number)
    : _selectInitialStep(f, t0, y0, tf, maxStep, _fArr(f, t, y), dir, 3, rtol, atol);
  let hAbsOld: number | null = null;
  let errNormOld: number | null = null;

  const tOut: number[] = [t];
  const yOut: number[][] = [y.slice()];
  let iter = 0;

  while ((dir > 0 ? t < tf : t > tf) && iter < maxIter) {
    iter++;
    const minStep = _minStep(t);
    let hEntry: number;
    if (hAbs > maxStep) {
      hEntry = maxStep;
      hAbs = maxStep;
      hAbsOld = null;
      errNormOld = null;
    } else if (hAbs < minStep) {
      hEntry = minStep;
      hAbs = minStep;
      hAbsOld = null;
      errNormOld = null;
    } else {
      hEntry = hAbs;
    }

    const f0 = _fArr(f, t, y);
    const J = _jacobianAt(f, t, y, f0, options);

    let stepAccepted = false;
    let rejected = false;
    let yNew: number[] = y;
    let errNorm = 0;
    let nIter = 1;
    let tNew = t;

    while (!stepAccepted) {
      if (hAbs < minStep) {
        throw new Error('Required step size is less than spacing between numbers (Radau)');
      }
      let h = hAbs * dir;
      tNew = t + h;
      if (dir * (tNew - tf) > 0) tNew = tf;
      h = tNew - t;
      hAbs = Math.abs(h);

      const scale = y.map((yi) => atol + Math.abs(yi) * rtol);
      const res = _radauNewton(f, t, y, h, J, scale, newtonTol);
      if (!res.converged) {
        hAbs *= 0.5;
        continue;
      }
      nIter = res.nIter;
      const Z = res.Z;
      yNew = y.map((yi, r) => yi + Z[2][r]);
      // error = (MU_REAL/h·I − J)⁻¹ (f0 + Eᵀ·Z / h)
      const ze = new Array<number>(n).fill(0);
      for (let r = 0; r < n; r++) {
        ze[r] = f0[r] + (RADAU_E[0] * Z[0][r] + RADAU_E[1] * Z[1][r] + RADAU_E[2] * Z[2][r]) / h;
      }
      const Merr = J.map((rowv, i) => rowv.map((v, j) => (i === j ? RADAU_MU_REAL / h : 0) - v));
      const solveErr = _factorSolver(Merr, n);
      let error = solveErr(ze);
      const escale = y.map((yi, r) => atol + Math.max(Math.abs(yi), Math.abs(yNew[r])) * rtol);
      errNorm = _rms(error.map((v, r) => v / escale[r]));
      const safety = (0.9 * (2 * RADAU_NEWTON_MAXITER + 1)) / (2 * RADAU_NEWTON_MAXITER + nIter);

      if (rejected && errNorm > 1) {
        const yErr = y.map((yi, r) => yi + error[r]);
        const fErr = _fArr(f, t, yErr);
        error = solveErr(fErr.map((v, r) => v + ze[r] - f0[r]));
        errNorm = _rms(error.map((v, r) => v / escale[r]));
      }

      if (errNorm > 1) {
        const factor = _radauPredictFactor(hAbs, hAbsOld, errNorm, errNormOld);
        hAbs *= Math.max(RADAU_MIN_FACTOR, safety * factor);
        rejected = true;
      } else {
        stepAccepted = true;
      }
    }

    const safety = (0.9 * (2 * RADAU_NEWTON_MAXITER + 1)) / (2 * RADAU_NEWTON_MAXITER + nIter);
    let factor = _radauPredictFactor(hAbs, hAbsOld, errNorm, errNormOld);
    factor = Math.min(RADAU_MAX_FACTOR, safety * factor);
    if (factor < 1.2) factor = 1;

    hAbsOld = hEntry;
    errNormOld = errNorm;

    t = tNew;
    y = yNew;
    tOut.push(t);
    yOut.push(y.slice());
    hAbs *= factor;
  }

  if (iter >= maxIter) {
    throw new Error('Maximum number of iterations reached, try changing options');
  }
  return { t: tOut, y: yOut };
}

export const createSolveODE = /* #__PURE__ */ factory(
  name,
  dependencies as unknown as string[],
  ({
    typed,
    add,
    subtract,
    multiply,
    divide,
    max,
    map,
    abs,
    isPositive,
    isNegative,
    larger,
    smaller,
    matrix,
    bignumber,
    unaryMinus,
  }) => {
    /**
     * Numerical Integration of Ordinary Differential Equations
     *
     * Six adaptive-step methods are provided:
     * - "RK23": Bogacki–Shampine method (explicit)
     * - "RK45": Dormand-Prince method RK5(4)7M (explicit, default)
     * - "Rosenbrock": linearly-implicit ode23s (Shampine & Reichelt), 2nd order, L-stable — use for
     *   STIFF systems (chemical kinetics, circuits, control) where the explicit methods stall or
     *   blow up. Plain-number state only.
     * - "RODAS": Hairer & Wanner's 4th-order, 6-stage, L-stable Rosenbrock method — for STIFF
     *   systems at tight tolerances (rtol < 1e-6) where the 2nd-order ode23s takes too many steps.
     *   Plain-number state only.
     * - "BDF": variable-order (1–5) variable-step backward differentiation (scipy's default stiff
     *   method; NDF-enhanced) — the general-purpose workhorse for stiff systems, robust across a
     *   wide tolerance range. Plain-number state only.
     * - "Radau": 3-stage, 5th-order, L-stable Radau IIA implicit Runge-Kutta (scipy's `Radau`) —
     *   high-order accuracy on very stiff systems; simplified-Newton on the collocation system.
     *   Plain-number state only.
     *
     * All four stiff methods (Rosenbrock, RODAS, BDF, Radau) form a finite-difference Jacobian each
     * step unless an analytic Jacobian is supplied via the `jac` option, which they then use
     * instead (faster and more accurate).
     *
     * The arguments are expected as follows.
     *
     * - `func` should be the forcing function `f(t, y)`
     * - `tspan` should be a vector of two numbers or units `[tStart, tEnd]`
     * - `y0` the initial state values, should be a scalar or a flat array
     * - `options` should be an object with the following information:
     *   - `method` ('RK45'): ['RK23', 'RK45', 'Rosenbrock', 'RODAS', 'BDF', 'Radau']
     *   - `jac`: analytic Jacobian `(t, y) => number[][]` for the stiff methods ('Rosenbrock',
     *     'RODAS', 'BDF', 'Radau'); when omitted they finite-difference it (backward compatible)
     *   - `tol` (1e-3): Numeric tolerance of the method, the solver keeps the error estimates less than this value
     *   - `firstStep`: Initial step size
     *   - `minStep`: minimum step size of the method
     *   - `maxStep`: maximum step size of the method
     *   - `minDelta` (0.2): minimum ratio of change for the step (RK23/RK45 only)
     *   - `maxDelta` (5): maximum ratio of change for the step (RK23/RK45 only)
     *   - `maxIter`: maximum number of iterations (1e4 for RK23/RK45; 1e5 for Rosenbrock, which is
     *     2nd order and so takes more steps at tight tolerances)
     *   - `events`: event detection (scipy `solve_ivp`-style). One event function `g(t, y)` or an
     *     array of them; the solver locates each zero crossing between accepted steps (cubic-Hermite
     *     interpolation + bisection) and reports it in `tEvents`/`yEvents`. An event may carry (as
     *     properties, or via the `{ event, terminal, direction }` object form): `terminal` — `true`
     *     to stop at the first crossing, a positive integer to stop after that many, else record all;
     *     `direction` — `+1` to trigger only on `−`→`+` crossings, `−1` only `+`→`−`, `0` either.
     *     Requires plain-number state.
     *
     * The returned value is an object with `{t, y}` please note that even though `t` means time, it can represent any other independant variable like `x`:
     * - `t` an array of size `[n]`
     * - `y` the states array can be in two ways
     *   - **if `y0` is a scalar:** returns an array-like of size `[n]`
     *   - **if `y0` is a flat array-like of size [m]:** returns an array like of size `[n, m]`
     * - when the `events` option is given, also `tEvents` and `yEvents`: arrays with one entry per
     *   event function, holding the crossing times and states (states unwrapped to scalars when `y0`
     *   is scalar). A `terminal` event truncates `t`/`y` at its crossing.
     *
     * Syntax:
     *
     *     math.solveODE(func, tspan, y0)
     *     math.solveODE(func, tspan, y0, options)
     *
     * Examples:
     *
     *     function func(t, y) {return y}
     *     const tspan = [0, 4]
     *     const y0 = 1
     *     math.solveODE(func, tspan, y0)
     *     math.solveODE(func, tspan, [1, 2])
     *     math.solveODE(func, tspan, y0, { method:"RK23", maxStep:0.1 })
     *     // event detection: stop when the projectile height y[0] returns to 0
     *     math.solveODE(f, [0, 10], [0, 20], { events: { event: (t, y) => y[0], terminal: true, direction: -1 } })
     *
     * See also:
     *
     *     derivative, simplifyCore
     *
     * @param {function} func The forcing function f(t,y)
     * @param {Array | Matrix} tspan The time span
     * @param {number | BigNumber | Unit | Array | Matrix} y0 The initial value
     * @param {Object} [options] Optional configuration options
     * @return {Object} Return an object with t and y values as arrays
     */

    /**
     * Check if y0 is a plain number array suitable for WASM acceleration
     */
    function _isPlainNumberArray(y0: unknown[]): boolean {
      if (!Array.isArray(y0) || y0.length < WASM_ODE_THRESHOLD) return false;
      for (let i = 0; i < y0.length; i++) {
        if (typeof y0[i] !== 'number') return false;
      }
      return true;
    }

    // _rmsNorm, _luSolve, _fArr, _fdJacobian, and the Rosenbrock engine itself now live at module
    // scope as `rosenbrockSolve` (below) — they are pure numeric helpers with no factory-scope
    // dependency, and `stiffODESolver` (functions/src/typed/numeric.ts) needs to call the same
    // engine directly without depending on this factory instance.

    /**
     * WASM-accelerated Runge-Kutta inner loop for plain number vector ODEs.
     *
     * Accelerates the vector arithmetic (weighted sums for stage computation,
     * solution update, and error estimation) while still calling the JS
     * callback f(t, y) for each stage evaluation.
     *
     * Returns null if WASM is unavailable, signaling fallback to JS path.
     */
    function _rkWasmLoop(
      f: ForcingFunction,
      tspan: unknown[],
      y0: number[],
      options: ODEOptions,
      butcherTableau: ButcherTableau
    ): ODESolution | null {
      const wasm = wasmLoader.getModule();
      if (!wasm) return null;

      const dim = y0.length; // dimension of state vector
      const a = butcherTableau.a as number[][];
      const c = butcherTableau.c as (number | null)[];
      const b = butcherTableau.b as number[];
      const bp = butcherTableau.bp as number[];
      const numStages = c.length;

      const t0 = tspan[0] as number;
      const tf = tspan[1] as number;
      const isForwards = tf > t0;
      const tol = options.tol ? options.tol : 1e-4;
      const minDelta = options.minDelta ? options.minDelta : 0.2;
      const maxDelta = options.maxDelta ? options.maxDelta : 5;
      const maxIter = options.maxIter ? options.maxIter : 10_000;

      let h;
      if (options.firstStep) {
        h = isForwards ? (options.firstStep as number) : -(options.firstStep as number);
      } else {
        // Same Hairer initial-step heuristic as the JS path (h₀ ≈ 0.01·‖y0‖/‖f(t0,y0)‖) — a
        // whole-interval first step can slip past the embedded error test and accept a crude result.
        const f0 = f(t0, y0) as number[];
        const d0 = _rmsNorm(y0);
        const d1 = _rmsNorm(Array.isArray(f0) ? f0 : [f0 as unknown as number]);
        const h0 = d0 < 1e-5 || d1 < 1e-5 ? 1e-6 : 0.01 * (d0 / d1);
        const hMag = Math.min(h0, Math.abs(tf - t0));
        h = isForwards ? hMag : -hMag;
      }

      const maxStepVal = options.maxStep as number | undefined;
      const minStepVal = options.minStep as number | undefined;

      // Compute deltaB = b - bp
      const deltaB = new Float64Array(numStages);
      for (let i = 0; i < numStages; i++) {
        deltaB[i] = b[i] - bp[i];
      }

      // Allocate WASM buffers:
      // - yPtr: current state (dim)
      // - yNewPtr: next state (dim)
      // - errorPtr: error vector (dim)
      // - tempPtr: temporary for weighted sums (dim)
      // - stagePtr: k values for all stages (numStages * dim)
      const yAlloc = wasmLoader.allocateFloat64Array(y0);
      const yNewAlloc = wasmLoader.allocateFloat64ArrayEmpty(dim);
      const errorAlloc = wasmLoader.allocateFloat64ArrayEmpty(dim);
      const tempAlloc = wasmLoader.allocateFloat64ArrayEmpty(dim);
      const stageAlloc = wasmLoader.allocateFloat64ArrayEmpty(numStages * dim);

      try {
        const t: number[] = [t0];
        const y: number[][] = [y0.slice()];

        let n = 0;
        let iter = 0;

        // Helper to read back a vector from WASM memory
        function readVec(alloc: { ptr: number; array: Float64Array }): number[] {
          // Re-create view in case memory grew
          const arr = new Float64Array(wasm!.memory.buffer, alloc.ptr, dim);
          const result: number[] = new Array(dim);
          for (let i = 0; i < dim; i++) {
            result[i] = arr[i];
          }
          return result;
        }

        // Helper to write a JS array into a WASM allocation
        function writeVec(alloc: { ptr: number; array: Float64Array }, data: number[]): void {
          const arr = new Float64Array(wasm!.memory.buffer, alloc.ptr, dim);
          for (let i = 0; i < dim; i++) {
            arr[i] = data[i];
          }
        }

        // Helper to write k[stageIdx] into the stage buffer
        function writeStage(stageIdx: number, data: number[]): void {
          const offset = stageIdx * dim;
          const arr = new Float64Array(wasm!.memory.buffer, stageAlloc.ptr, numStages * dim);
          for (let i = 0; i < dim; i++) {
            arr[offset + i] = data[i];
          }
        }

        // Trim step to not overshoot
        function trimStepNum(tn: number, tfn: number, hn: number): number {
          const next = tn + hn;
          if (isForwards ? next > tfn : next < tfn) {
            return tfn - tn;
          }
          return hn;
        }

        // Ongoing check
        function ongoing(tn: number, tfn: number): boolean {
          return isForwards ? tn < tfn : tn > tfn;
        }

        while (ongoing(t[n], tf)) {
          // Trim step
          h = trimStepNum(t[n], tf, h);

          // Write current y[n] into WASM
          writeVec(yAlloc, y[n]);

          // Stage 0: k[0] = f(t[n], y[n])
          const k0 = f(t[n], y[n]) as number[];
          writeStage(0, k0);

          // Stages 1..numStages-1
          for (let s = 1; s < numStages; s++) {
            // Compute y_stage = y[n] + h * sum(a[s][j] * k[j], j=0..s-1)
            // Start with a copy of y[n]
            wasm.vectorCopy(yAlloc.ptr, dim, tempAlloc.ptr);

            // Accumulate weighted k contributions using WASM vectorScale + vectorAdd
            for (let j = 0; j < a[s].length; j++) {
              const aCoeff = a[s][j];
              if (aCoeff === 0) continue;

              // Get pointer to k[j] within stageAlloc (offset j*dim)
              const kjPtr = stageAlloc.ptr + j * dim * 8;

              // temp = temp + h * a[s][j] * k[j]
              // Use yNewAlloc as scratch for scaled k
              wasm.vectorScale(kjPtr, h * aCoeff, dim, yNewAlloc.ptr);
              wasm.vectorAdd(tempAlloc.ptr, yNewAlloc.ptr, dim, tempAlloc.ptr);
            }

            // Call JS callback with the computed stage state
            const tStage = t[n] + (c[s] as number) * h;
            const yStage = readVec(tempAlloc);
            const ks = f(tStage, yStage) as number[];
            writeStage(s, ks);
          }

          // Compute yNew = y[n] + h * sum(b[i] * k[i])
          // and error = sum(deltaB[i] * k[i]) (then take abs max)
          wasm.vectorCopy(yAlloc.ptr, dim, yNewAlloc.ptr);

          // Zero out errorAlloc (create fresh view each iteration since WASM memory growth can detach)
          new Float64Array(wasm.memory.buffer, errorAlloc.ptr, dim).fill(0);

          for (let s = 0; s < numStages; s++) {
            const ksPtr = stageAlloc.ptr + s * dim * 8;

            if (b[s] !== 0) {
              // yNew += h * b[s] * k[s]
              wasm.vectorScale(ksPtr, h * b[s], dim, tempAlloc.ptr);
              wasm.vectorAdd(yNewAlloc.ptr, tempAlloc.ptr, dim, yNewAlloc.ptr);
            }

            if (deltaB[s] !== 0) {
              // error += deltaB[s] * k[s]  (will take max(abs()) after)
              wasm.vectorScale(ksPtr, deltaB[s], dim, tempAlloc.ptr);
              wasm.vectorAdd(errorAlloc.ptr, tempAlloc.ptr, dim, errorAlloc.ptr);
            }
          }

          // Compute max absolute error using WASM
          // First scale error by h (since multiply(deltaB, k) in JS path is then
          // used as-is, but the JS path computes multiply(deltaB, k) which is
          // the raw difference, not multiplied by h — let's match JS behavior)
          // Looking at the JS code: TE = max(abs(map(multiply(deltaB, k), ...)))
          // multiply(deltaB, k) is a matrix multiply of [numStages] x [numStages, dim]
          // which gives a [dim] vector. This is exactly what we accumulated above.
          // So we take abs-max of errorAlloc directly.

          // But we need abs values. Compute maxError via WASM.
          const TE = wasm.maxError(errorAlloc.ptr, dim);

          if (TE < tol && tol / TE > 1 / 4) {
            // Accept step
            t.push(t[n] + h);
            y.push(readVec(yNewAlloc));
            n++;
          }

          // Step size adjustment
          const delta = wasm.computeStepAdjustment(TE, tol, 5, minDelta, maxDelta);

          h = h * delta;

          if (maxStepVal !== undefined && Math.abs(h) > maxStepVal) {
            h = isForwards ? maxStepVal : -maxStepVal;
          } else if (minStepVal !== undefined && Math.abs(h) < minStepVal) {
            h = isForwards ? minStepVal : -minStepVal;
          }

          iter++;
          if (iter > maxIter) {
            throw new Error('Maximum number of iterations reached, try changing options');
          }
        }

        return { t, y };
      } finally {
        wasmLoader.free(yAlloc.ptr);
        wasmLoader.free(yNewAlloc.ptr);
        wasmLoader.free(errorAlloc.ptr);
        wasmLoader.free(tempAlloc.ptr);
        wasmLoader.free(stageAlloc.ptr);
      }
    }

    function _rk(butcherTableau: ButcherTableau) {
      // generates an adaptive runge kutta method from it's butcher tableau

      return function (
        f: ForcingFunction,
        tspan: unknown[],
        y0: unknown[],
        options: ODEOptions
      ): ODESolution {
        // adaptive runge kutta methods
        const wrongTSpan = !(
          tspan.length === 2 &&
          (tspan.every(isNumOrBig) || tspan.every(isUnit))
        );
        if (wrongTSpan) {
          throw new Error(
            '"tspan" must be an Array of two numeric values or two units [tStart, tEnd]'
          );
        }
        const t0 = tspan[0]; // initial time
        const tf = tspan[1]; // final time
        const isForwards = larger(tf, t0);
        const firstStep = options.firstStep;
        if (firstStep !== undefined && !isPositive(firstStep)) {
          throw new Error('"firstStep" must be positive');
        }
        const maxStep = options.maxStep;
        if (maxStep !== undefined && !isPositive(maxStep)) {
          throw new Error('"maxStep" must be positive');
        }
        const minStep = options.minStep;
        if (minStep && isNegative(minStep)) {
          throw new Error('"minStep" must be positive or zero');
        }
        const timeVars = [t0, tf, firstStep, minStep, maxStep].filter((x) => x !== undefined);
        if (!(timeVars.every(isNumOrBig) || timeVars.every(isUnit))) {
          throw new Error('Inconsistent type of "t" dependant variables');
        }

        // Try WASM-accelerated path for plain number arrays above threshold
        const hasBigNumbers = [t0, tf, ...y0, maxStep, minStep].some(isBigNumber);
        if (!hasBigNumbers && !tspan.some(isUnit) && _isPlainNumberArray(y0)) {
          try {
            const wasmResult = _rkWasmLoop(f, tspan, y0 as number[], options, butcherTableau);
            if (wasmResult !== null) return wasmResult;
          } catch {
            // Fall through to JS implementation
          }
        }

        // --- JS fallback path (original implementation) ---
        const steps = 1; // divide time in this number of steps
        const tol = options.tol ? options.tol : 1e-4; // define a tolerance (must be an option)
        const minDelta = options.minDelta ? options.minDelta : 0.2;
        const maxDelta = options.maxDelta ? options.maxDelta : 5;
        const maxIter = options.maxIter ? options.maxIter : 10_000; // stop inifite evaluation if something goes wrong
        const [a, c, b, bp] = hasBigNumbers
          ? [
              bignumber(butcherTableau.a),
              bignumber(butcherTableau.c),
              bignumber(butcherTableau.b),
              bignumber(butcherTableau.bp),
            ]
          : [butcherTableau.a, butcherTableau.c, butcherTableau.b, butcherTableau.bp];

        let h;
        if (firstStep) {
          h = isForwards ? firstStep : unaryMinus(firstStep);
        } else if (
          !hasBigNumbers &&
          !tspan.some(isUnit) &&
          (y0 as unknown[]).every((v) => typeof v === 'number')
        ) {
          // Choose a sensible first step (Hairer's heuristic h₀ ≈ 0.01·‖y0‖/‖f(t0,y0)‖) rather than
          // spanning the whole interval. A whole-interval first step can slip past an embedded error
          // test — e.g. BS23/RK23 on y'=-y, whose 3rd-2nd-order estimate vanishes exactly at h=span —
          // and silently accept a crude low-order result (y(1)=1/3 instead of e⁻¹). Gated on plain
          // numeric state — `_rmsNorm` would produce NaN on Unit/Complex/BigNumber elements — so those
          // fall through to the whole-interval step below.
          const f0 = f(t0 as MathNumericType, y0 as MathNumericType | MathArray);
          const f0arr = (Array.isArray(f0) ? f0 : [f0]) as number[];
          const d0 = _rmsNorm(y0 as number[]);
          const d1 = _rmsNorm(f0arr);
          const h0 = d0 < 1e-5 || d1 < 1e-5 ? 1e-6 : 0.01 * (d0 / d1);
          const hMag = Math.min(h0, Math.abs((tf as number) - (t0 as number)));
          h = isForwards ? hMag : -hMag;
        } else {
          h = divide(subtract(tf, t0), steps); // fallback first step size
        }
        const t: unknown[] = [t0]; // start the time array
        const y: unknown[] = [y0]; // start the solution array

        const deltaB = subtract(b, bp); // b - bp

        // Weighted sum of Runge-Kutta stages: Σⱼ coeffs[j]·k[j]. Each k[j] is the state's shape —
        // a scalar (number/BigNumber/Unit) for a scalar ODE, or a vector for a system. Done term by
        // term through the injected scalar-broadcasting `multiply`/`add` (multiply(scalar, vector)
        // scales; add is element-wise). The old mathjs form `multiply(h, a[i], k)` relied on
        // vector·matrix / vector·vector multiply semantics, which MathTS's typed `multiply` rejects
        // for 1-D operands (it routes those to `dot`) — so solveODE threw on EVERY call.
        function stageCombo(coeffs: unknown[], stages: unknown[]): unknown {
          const m = Math.min(coeffs.length, stages.length);
          let acc = multiply(coeffs[0], stages[0]);
          for (let j = 1; j < m; j++) {
            acc = add(acc, multiply(coeffs[j], stages[j]));
          }
          return acc;
        }

        let n = 0;
        let iter = 0;
        const ongoing = _createOngoing(isForwards);
        const trimStep = _createTrimStep(isForwards);
        // iterate unitil it reaches either the final time or maximum iterations
        while (ongoing(t[n], tf)) {
          const k: unknown[] = [];

          // trim the time step so that it doesn't overshoot
          h = trimStep(t[n], tf, h);

          // calculate the first value of k
          k.push(f(t[n] as MathNumericType, y[n] as MathNumericType | MathArray));

          // calculate the rest of the values of k
          for (let i = 1; i < (c as unknown[]).length; ++i) {
            k.push(f(add(t[n], multiply(c[i], h)), add(y[n], multiply(h, stageCombo(a[i], k)))));
          }

          // estimate the error by comparing solutions of different orders
          const errComb = stageCombo(deltaB, k);
          const errArr = Array.isArray(errComb) ? errComb : [errComb];
          const TE = max(abs(map(errArr, (X: unknown) => (isUnit(X) ? (X as Unit).value : X))));

          if (TE < tol && tol / TE > 1 / 4) {
            // push solution if within tol
            t.push(add(t[n], h));
            y.push(add(y[n], multiply(h, stageCombo(b, k))));
            n++;
          }

          // estimate the delta value that will affect the step size
          let delta = 0.84 * (tol / TE) ** (1 / 5);

          if (smaller(delta, minDelta)) {
            delta = minDelta;
          } else if (larger(delta, maxDelta)) {
            delta = maxDelta;
          }

          delta = hasBigNumbers ? bignumber(delta) : delta;
          h = multiply(h, delta);

          if (maxStep && larger(abs(h), maxStep)) {
            h = isForwards ? maxStep : unaryMinus(maxStep);
          } else if (minStep && smaller(abs(h), minStep)) {
            h = isForwards ? minStep : unaryMinus(minStep);
          }
          iter++;
          if (iter > maxIter) {
            throw new Error('Maximum number of iterations reached, try changing options');
          }
        }
        return { t, y };
      };
    }

    function _rk23(
      f: ForcingFunction,
      tspan: unknown[],
      y0: unknown[],
      options: ODEOptions
    ): ODESolution {
      // Bogacki–Shampine method

      // Define the butcher table
      const a: number[][] = [[], [1 / 2], [0, 3 / 4], [2 / 9, 1 / 3, 4 / 9]];

      const c: (number | null)[] = [null, 1 / 2, 3 / 4, 1];
      const b: number[] = [2 / 9, 1 / 3, 4 / 9, 0];
      const bp: number[] = [7 / 24, 1 / 4, 1 / 3, 1 / 8];

      const butcherTableau: ButcherTableau = { a, c, b, bp };

      // Solve an adaptive step size rk method
      return _rk(butcherTableau)(f, tspan, y0, options);
    }

    function _rk45(
      f: ForcingFunction,
      tspan: unknown[],
      y0: unknown[],
      options: ODEOptions
    ): ODESolution {
      // Dormand Prince method

      // Define the butcher tableau
      const a: number[][] = [
        [],
        [1 / 5],
        [3 / 40, 9 / 40],
        [44 / 45, -56 / 15, 32 / 9],
        [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
        [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
        [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
      ];

      const c: (number | null)[] = [null, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
      const b: number[] = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
      const bp: number[] = [
        5179 / 57600,
        0,
        7571 / 16695,
        393 / 640,
        -92097 / 339200,
        187 / 2100,
        1 / 40,
      ];

      const butcherTableau: ButcherTableau = { a, c, b, bp };

      // Solve an adaptive step size rk method
      return _rk(butcherTableau)(f, tspan, y0, options);
    }

    function _solveODE(
      f: ForcingFunction,
      tspan: unknown[],
      y0: unknown[],
      opt: ODEOptions
    ): ODESolution {
      const method = opt.method ? opt.method : 'RK45';
      const methods: Record<
        string,
        | typeof _rk23
        | typeof _rk45
        | typeof rosenbrockSolve
        | typeof rodasSolve
        | typeof bdfSolve
        | typeof radauSolve
      > = {
        RK23: _rk23,
        RK45: _rk45,
        ROSENBROCK: rosenbrockSolve,
        RODAS: rodasSolve,
        BDF: bdfSolve,
        RADAU: radauSolve,
      };
      if (method.toUpperCase() in methods) {
        const methodOptions = { ...opt }; // clone the options object
        delete methodOptions.method; // delete the method as it won't be needed
        const sol = methods[method.toUpperCase() as keyof typeof methods](
          f,
          tspan,
          y0,
          methodOptions
        );
        // Event detection runs as a post-pass over the accepted-step trajectory, so it is
        // method-agnostic (explicit RK and stiff paths alike). Only engaged when requested.
        if (opt.events !== undefined) {
          const dir = (tspan[1] as number) >= (tspan[0] as number) ? 1 : -1;
          return _applyEvents(f, sol as { t: unknown[]; y: unknown[] }, opt.events, dir);
        }
        return sol;
      } else {
        // throw an error indicating there is no such method
        const methodsWithQuotes = Object.keys(methods).map((x) => `"${x}"`);
        // generates a string of methods like: "BDF", "RK23" and "RK45"
        const availableMethodsString = `${methodsWithQuotes.slice(0, -1).join(', ')} and ${methodsWithQuotes.slice(-1)}`;
        throw new Error(
          `Unavailable method "${method}". Available methods are ${availableMethodsString}`
        );
      }
    }

    function _createOngoing(isForwards: unknown): typeof smaller | typeof larger {
      // returns the correct function to test if it's still iterating
      return isForwards ? smaller : larger;
    }

    function _createTrimStep(isForwards: unknown) {
      const outOfBounds = isForwards ? larger : smaller;
      return function (t: unknown, tf: unknown, h: unknown): unknown {
        const next = add(t, h);
        return outOfBounds(next, tf) ? subtract(tf, t) : h;
      };
    }

    function isNumOrBig(x: unknown): boolean {
      // checks if it's a number or bignumber
      return isBigNumber(x) || isNumber(x);
    }

    function _matrixSolveODE(
      f: ForcingFunction,
      T: Matrix,
      y0: Matrix,
      options: ODEOptions
    ): { t: Matrix; y: Matrix; tEvents?: number[][]; yEvents?: unknown[][] } {
      // receives matrices and returns matrices; event lists (ragged, one per event fn) stay plain.
      const sol = _solveODE(f, T.toArray(), y0.toArray(), options);
      const out: { t: Matrix; y: Matrix; tEvents?: number[][]; yEvents?: unknown[][] } = {
        t: matrix(sol.t),
        y: matrix(sol.y),
      };
      if (sol.tEvents) {
        out.tEvents = sol.tEvents;
        out.yEvents = sol.yEvents;
      }
      return out;
    }

    /** Unwrap a scalar-ODE solution (internal state `[v]` → `v`) for both `y` and `yEvents`. */
    function _unwrapScalarSol(sol: ODESolution): ODESolution {
      const out: ODESolution = { t: sol.t, y: sol.y.map((Y: unknown) => (Y as unknown[])[0]) };
      if (sol.tEvents) {
        out.tEvents = sol.tEvents;
        out.yEvents = sol.yEvents?.map((list) => list.map((Y: unknown) => (Y as unknown[])[0]));
      }
      return out;
    }

    return typed('solveODE', {
      'function, Array, Array, Object': _solveODE,
      'function, Matrix, Matrix, Object': _matrixSolveODE,
      'function, Array, Array': (f: ForcingFunction, T: unknown[], y0: unknown[]) =>
        _solveODE(f, T, y0, {}),
      'function, Matrix, Matrix': (f: ForcingFunction, T: Matrix, y0: Matrix) =>
        _matrixSolveODE(f, T, y0, {}),
      'function, Array, number | BigNumber | Unit': (
        f: ForcingFunction,
        T: unknown[],
        y0: number | BigNumber | Unit
      ) => _unwrapScalarSol(_solveODE(f, T, [y0], {})),
      'function, Matrix, number | BigNumber | Unit': (
        f: ForcingFunction,
        T: Matrix,
        y0: number | BigNumber | Unit
      ) => {
        const sol = _solveODE(f, T.toArray(), [y0], {});
        return { t: matrix(sol.t), y: matrix(sol.y.map((Y: unknown) => (Y as unknown[])[0])) };
      },
      'function, Array, number | BigNumber | Unit, Object': (
        f: ForcingFunction,
        T: unknown[],
        y0: number | BigNumber | Unit,
        options: ODEOptions
      ) => _unwrapScalarSol(_solveODE(f, T, [y0], options)),
      'function, Matrix, number | BigNumber | Unit, Object': (
        f: ForcingFunction,
        T: Matrix,
        y0: number | BigNumber | Unit,
        options: ODEOptions
      ) => {
        const sol = _solveODE(f, T.toArray(), [y0], options);
        const out: { t: Matrix; y: Matrix; tEvents?: number[][]; yEvents?: unknown[][] } = {
          t: matrix(sol.t),
          y: matrix(sol.y.map((Y: unknown) => (Y as unknown[])[0])),
        };
        if (sol.tEvents) {
          out.tEvents = sol.tEvents;
          out.yEvents = sol.yEvents?.map((list) => list.map((Y: unknown) => (Y as unknown[])[0]));
        }
        return out;
      },
    });
  }
);
