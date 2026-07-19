/**
 * Constant-delay delay differential equation (DDE) solver via the method of steps.
 *
 * Solves
 *
 *     y'(t) = f(t, y(t), [y(t−τ₁), y(t−τ₂), …])      on t ∈ [t0, T]
 *
 * with a **history function** `φ(t)` giving `y(t)` for `t ≤ t0` (the initial state
 * is `y(t0) = φ(t0)`). The `τ_k` are fixed positive **constant delays**.
 *
 * ## Method — method of steps + continuous extension (Bellen–Zennaro)
 *
 * The system is integrated with the adaptive **BS23** (Bogacki–Shampine 3(2))
 * embedded Runge–Kutta pair — the same explicit pair MATLAB's `dde23` uses. At each
 * RK stage the delayed argument `y(t − τ_k)` is obtained from
 *
 *  - the **history function** `φ` when `t − τ_k ≤ t0`, or
 *  - a **cubic-Hermite dense-output interpolant** of the already-computed solution
 *    otherwise (a C¹, O(h⁴) continuous extension built from the stored per-step
 *    `(t, y, y')` data — consistent with BS23's order).
 *
 * ### The step cap (standard MOS constraint)
 *
 * Each step is **capped at `h ≤ min(τ)`**. With that cap every delayed argument
 * `t_stage − τ_k` lies in `[t0, t_n]` (already-accepted history), so the delayed
 * value is always available and the method stays fully **explicit** — no implicit
 * coupling of the current step to itself. Adaptive error control still chooses `h`
 * freely within that cap.
 *
 * ### Discontinuity propagation
 *
 * `y'` is generically discontinuous at `t0` (the history need not satisfy the DDE),
 * and that low-order discontinuity propagates to `t0 + τ_k`, `t0 + 2τ_k`, …. The
 * integrator **lands exactly on each `t0 + m·τ_k` breakpoint** (the step is trimmed
 * so it never *crosses* one), so no dense-output interval straddles a derivative
 * jump and the smoothing order increases past each breakpoint as it should.
 *
 * Plain-number state only (the interpolation and error norms are numeric).
 *
 * @packageDocumentation
 */

/**
 * Forcing function `y'(t) = f(t, y, yDelayed)`.
 * - `y` is the current state (`number[]`; a length-1 array for a scalar DDE).
 * - `yDelayed[k]` is `y(t − τ_k)` in the same shape as `y`, one entry per delay.
 * Returns the derivative vector (a bare number is accepted for a scalar DDE).
 */
export type DDEForcing = (t: number, y: number[], yDelayed: number[][]) => number[] | number;

/**
 * History `φ(t)` giving `y(t)` for `t ≤ t0`. Either a function `(t) => state`
 * (state as `number[]` or scalar `number`), or a constant (`number` / `number[]`)
 * used for all `t ≤ t0`. The initial state is `φ(t0)`.
 */
export type DDEHistory = ((t: number) => number[] | number) | number | number[];

/** Options for {@link solveDDE} (mirrors the `solveODE` option shape). */
export interface SolveDDEOptions {
  /** Relative tolerance for the adaptive local-error control (default `1e-6`). */
  tol?: number;
  /** Absolute tolerance (default `tol · 1e-3`). */
  atol?: number;
  /** Initial step size (default: Hairer heuristic, capped to `min(τ)`). */
  firstStep?: number;
  /** Minimum step size (a hard floor; below it a step is force-accepted). */
  minStep?: number;
  /** Maximum step size (further capped by `min(τ)` and the next breakpoint). */
  maxStep?: number;
  /** Maximum number of accepted steps (default `1e5`). */
  maxIter?: number;
}

/**
 * Solution returned by {@link solveDDE}.
 *
 * `y` is `number[][]` (one state vector per accepted time) when the history/initial
 * state is a vector, and unwrapped to `number[]` when it is a scalar.
 */
export interface DDESolution {
  /** Accepted output times, `t[0] = t0`, last entry `= T`. */
  t: number[];
  /** State at each accepted time (`number[]` for a scalar DDE, else `number[][]`). */
  y: number[][] | number[];
  /**
   * Dense-output evaluator: the cubic-Hermite continuous extension `y(t)` for any
   * `t ∈ [t0, T]` (clamped to that range). Returns the state in the same shape as
   * `y` (scalar for a scalar DDE). C¹ and O(h⁴) between accepted steps.
   */
  yInterp: (t: number) => number[] | number;
}

/** Coerce a `number | number[]` into a fresh `number[]`. */
function _arr(v: number | number[]): number[] {
  return Array.isArray(v) ? v.slice() : [v];
}

/**
 * Cubic-Hermite interpolation of the state on `[ta, tb]` from endpoint states
 * `ya`, `yb` and endpoint derivatives `fa`, `fb`. C¹ and O(h⁴) accurate.
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

/** Weighted-RMS norm `‖v/scale‖₂ / √n`. */
function _wrms(v: number[], scale: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const q = v[i] / scale[i];
    s += q * q;
  }
  return Math.sqrt(s / v.length);
}

// BS23 (Bogacki–Shampine 3(2)) tableau — 3rd-order solution `b`, 2nd-order embedded `bp`.
// FSAL: the 4th stage is f at the new point, reused as the next step's first stage and as
// the right endpoint derivative for the Hermite interpolant.
const _BS23_B = [2 / 9, 1 / 3, 4 / 9, 0];
const _BS23_BP = [7 / 24, 1 / 4, 1 / 3, 1 / 8];
const _BS23_DB = _BS23_B.map((b, i) => b - _BS23_BP[i]); // error weights b − bp

/**
 * Solve the constant-delay DDE `y'(t) = f(t, y(t), [y(t−τ₁), …])` on `[tspan[0],
 * tspan[1]]` with a history `φ` and delays `τ_k`, by the method of steps (adaptive
 * BS23 + cubic-Hermite continuous extension, step capped at `min(τ)`).
 *
 * @param f        Forcing `f(t, y, yDelayed) → y'`. `yDelayed[k] = y(t − τ_k)`.
 * @param tspan    `[t0, T]` (forward integration; `T > t0`).
 * @param history  `φ(t)` for `t ≤ t0` — a function or a constant. `y(t0) = φ(t0)`.
 * @param delays   Positive constant delays `τ_k` (at least one).
 * @param options  See {@link SolveDDEOptions}.
 * @returns `{ t, y, yInterp }` — `y` unwrapped to `number[]` for a scalar DDE.
 *
 * @example
 * // y'(t) = −y(t−1), history φ ≡ 1 on t ≤ 0. Method-of-steps solution:
 * //   [0,1]: 1 − t,  [1,2]: t²/2 − 2t + 3/2, …
 * const sol = solveDDE((t, y, yd) => [-yd[0][0]], [0, 3], 1, [1]);
 * sol.yInterp(2.5); // dense output at t = 2.5
 */
export function solveDDE(
  f: DDEForcing,
  tspan: [number, number] | number[],
  history: DDEHistory,
  delays: number[],
  options: SolveDDEOptions = {}
): DDESolution {
  const t0 = tspan[0];
  const tf = tspan[1];
  if (!(typeof t0 === 'number' && typeof tf === 'number')) {
    throw new Error('solveDDE: tspan must be [t0, T] numbers');
  }
  if (!(tf > t0)) {
    throw new Error('solveDDE: require T > t0 (forward integration)');
  }
  if (!Array.isArray(delays) || delays.length === 0) {
    throw new Error('solveDDE: at least one delay τ must be given');
  }
  if (!delays.every((d) => typeof d === 'number' && d > 0)) {
    throw new Error('solveDDE: every delay τ must be a positive number');
  }

  // Normalise the history to a `(s) => number[]` and detect scalar vs. vector state.
  const histFn: (s: number) => number[] =
    typeof history === 'function' ? (s: number) => _arr(history(s)) : () => _arr(history);
  const y0raw = typeof history === 'function' ? history(t0) : history;
  const yScalar = !Array.isArray(y0raw);
  const y0 = _arr(y0raw);
  const n = y0.length;

  const minTau = Math.min(...delays);
  const rtol = options.tol ?? 1e-6;
  const atol = options.atol ?? rtol * 1e-3;
  const maxIter = options.maxIter ?? 100_000;
  const maxStep = options.maxStep ?? Infinity;
  const minStepOpt = options.minStep ?? 0;

  // Accepted-step history: times (ascending), states, and derivatives (for Hermite).
  const Ts: number[] = [t0];
  const Ys: number[][] = [y0.slice()];
  const Fs: number[][] = [];

  /** Locate `i` with `Ts[i] ≤ s ≤ Ts[i+1]` (s within [t0, last accepted]). */
  function _locate(s: number): number {
    let lo = 0;
    let hi = Ts.length - 1;
    if (s <= Ts[0]) return 0;
    if (s >= Ts[hi]) return hi - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (Ts[mid] <= s) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  /** Delayed state `y(s)`: history for `s ≤ t0`, else Hermite dense output. */
  function delayedState(s: number): number[] {
    if (s <= t0) return histFn(s);
    const i = _locate(s);
    return _hermite(Ts[i], Ts[i + 1], Ys[i], Ys[i + 1], Fs[i], Fs[i + 1], s);
  }

  /** Evaluate the forcing at `(t, y)`, gathering the delayed states, coerced to `number[]`. */
  function fEval(t: number, y: number[]): number[] {
    const yd = delays.map((tau) => delayedState(t - tau));
    const r = f(t, y, yd);
    const out = Array.isArray(r) ? r : [r];
    if (out.length !== n) {
      throw new Error(
        `solveDDE: f must return ${n} value(s) (matching the state); got ${out.length}`
      );
    }
    return out;
  }

  /** Next breakpoint `t0 + m·τ_k` strictly greater than `t` (∞ if none ≤ T region). */
  function nextBreakpoint(t: number): number {
    let best = Infinity;
    for (const tau of delays) {
      let m = Math.floor((t - t0) / tau) + 1;
      let cand = t0 + m * tau;
      // Guard floating point: ensure strictly greater than t.
      while (cand <= t + 1e-12 * Math.max(1, Math.abs(t))) {
        m += 1;
        cand = t0 + m * tau;
      }
      if (cand < best) best = cand;
    }
    return best;
  }

  // First-stage derivative at t0 (delayed args are all ≤ t0 → history).
  Fs[0] = fEval(t0, y0);

  // Initial step: Hairer heuristic h₀ ≈ 0.01·‖y0‖/‖f0‖, capped to min(τ) and the span.
  const rms = (v: number[]): number =>
    Math.sqrt(v.reduce((a, x) => a + x * x, 0) / Math.max(1, v.length));
  let h: number;
  if (options.firstStep !== undefined) {
    h = Math.abs(options.firstStep);
  } else {
    const d0 = rms(y0);
    const d1 = rms(Fs[0]);
    h = d0 < 1e-5 || d1 < 1e-5 ? 1e-6 : 0.01 * (d0 / d1);
  }
  h = Math.min(h, minTau, maxStep, tf - t0);

  let t = t0;
  let y = y0.slice();
  let f0 = Fs[0];
  let iter = 0;

  while (t < tf && iter < maxIter) {
    iter += 1;
    // Cap the step: never exceed min(τ), maxStep, the remaining span, or the next breakpoint.
    const nb = nextBreakpoint(t);
    let hmax = Math.min(minTau, maxStep, tf - t);
    if (nb < tf) hmax = Math.min(hmax, nb - t);
    if (h > hmax) h = hmax;
    const minStep = Math.max(minStepOpt, 1e-13 * Math.max(1, Math.abs(t)));
    if (h < minStep) h = Math.min(minStep, hmax);

    // BS23 stages. f0 is the FSAL first stage (f at the current (t, y)).
    const k1 = f0;
    const k2 = fEval(
      t + 0.5 * h,
      y.map((yi, i) => yi + 0.5 * h * k1[i])
    );
    const k3 = fEval(
      t + 0.75 * h,
      y.map((yi, i) => yi + 0.75 * h * k2[i])
    );
    const yNew = y.map(
      (yi, i) => yi + h * (_BS23_B[0] * k1[i] + _BS23_B[1] * k2[i] + _BS23_B[2] * k3[i])
    );
    const k4 = fEval(t + h, yNew); // FSAL: f at the new point

    // Embedded error estimate = h · Σ (b − bp)·k, scaled-RMS normalised.
    const scale = y.map((yi, i) => atol + rtol * Math.max(Math.abs(yi), Math.abs(yNew[i])));
    const err = yNew.map(
      (_, i) =>
        h * (_BS23_DB[0] * k1[i] + _BS23_DB[1] * k2[i] + _BS23_DB[2] * k3[i] + _BS23_DB[3] * k4[i])
    );
    const errNorm = _wrms(err, scale);

    if (errNorm <= 1 || h <= minStep) {
      // Accept: advance, push onto the (ascending) history and reuse k4 as the next f0.
      t += h;
      y = yNew;
      f0 = k4;
      Ts.push(t);
      Ys.push(y.slice());
      Fs.push(f0);
    }

    // Step-size control (BS23 error is O(h³) ⇒ exponent 1/3), clamped.
    const factor = errNorm === 0 ? 5 : 0.9 * Math.pow(errNorm, -1 / 3);
    h *= Math.min(5, Math.max(0.2, factor));
  }

  if (iter >= maxIter) {
    throw new Error(
      'solveDDE: maximum number of steps reached — try loosening tol or raising maxIter'
    );
  }

  // Dense-output evaluator over [t0, T] (clamped), scalar-unwrapped to match `y`.
  const yInterp = (tq: number): number[] | number => {
    const s = tq <= t0 ? t0 : tq >= t ? t : tq;
    const i = _locate(s);
    const val = _hermite(Ts[i], Ts[i + 1], Ys[i], Ys[i + 1], Fs[i], Fs[i + 1], s);
    return yScalar ? val[0] : val;
  };

  return {
    t: Ts,
    y: yScalar ? Ys.map((v) => v[0]) : Ys,
    yInterp,
  };
}
