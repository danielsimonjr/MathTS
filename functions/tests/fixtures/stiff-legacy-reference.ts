/**
 * Verbatim `rosenbrockSolve` and `rodasSolve` (and the private helpers they call) from
 * `functions/src/numeric/solveODE.ts` at commit 0ec71dc0, before `_linearlyImplicitDriver`
 * existed. P6-3 pins the driver against these bodies in one process: a golden file would hold the
 * last bits of one engine's `Math.pow`, and Node (V8) and Bun (JavaScriptCore) differ there.
 */
import { numericJacobian } from '../../src/numeric/numeric-jacobian.js';
import { _factorSolver } from '../../src/numeric/solveODE.js';

type MathNumericType = number;
type MathArray = number[];
type ForcingFunction = (
  t: MathNumericType,
  y: MathNumericType | MathArray
) => MathNumericType | MathArray;

interface ODEOptions {
  tol?: number;
  firstStep?: number;
  minStep?: number;
  maxStep?: number;
  maxIter?: number;
  jac?: (t: number, y: number[]) => number[][];
}

/** Root-mean-square norm of a plain-number state vector, used for initial-step selection. */
function _rmsNorm(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s / v.length);
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
  return numericJacobian((yj) => _fArr(f, t, yj), y, {
    scheme: 'forward',
    step: { rel: 1e-7, floor: 1e-8 },
    f0,
  });
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
export function legacyRosenbrockSolve(
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
export function legacyRodasSolve(
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
