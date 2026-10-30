/**
 * Problems for the P6-3 pins on the shared linearly-implicit driver. The test runs every case
 * through `rosenbrockSolve` / `rodasSolve` and through `stiff-legacy-reference.ts` (the bodies
 * from before `_linearlyImplicitDriver`) in one process and requires identical output. Each case
 * counts its `f` calls, which pins the order of the evaluations.
 */

export interface StiffCaseOptions {
  tol?: number;
  firstStep?: number;
  maxStep?: number;
  minStep?: number;
  maxIter?: number;
  jac?: (t: number, y: number[]) => number[][];
}

export interface StiffCase {
  name: string;
  f: (t: number, y: number[]) => number[];
  tspan: [number, number];
  y0: number[];
  options: StiffCaseOptions;
}

const robertson = (_t: number, y: number[]): number[] => [
  -0.04 * y[0] + 1e4 * y[1] * y[2],
  0.04 * y[0] - 1e4 * y[1] * y[2] - 3e7 * y[1] * y[1],
  3e7 * y[1] * y[1],
];

const vanDerPol = (_t: number, y: number[]): number[] => [
  y[1],
  50 * (1 - y[0] * y[0]) * y[1] - y[0],
];

export const STIFF_CASES: StiffCase[] = [
  {
    name: 'robertson, Hairer initial step',
    f: robertson,
    tspan: [0, 0.5],
    y0: [1, 0, 0],
    options: { tol: 1e-6 },
  },
  {
    name: 'van der Pol mu=50 with an analytic Jacobian',
    f: vanDerPol,
    tspan: [0, 3],
    y0: [2, 0],
    options: {
      tol: 1e-5,
      jac: (_t, y) => [
        [0, 1],
        [-100 * y[0] * y[1] - 1, 50 * (1 - y[0] * y[0])],
      ],
    },
  },
  {
    name: 'forced scalar, time-dependent f',
    f: (t, y) => [-200 * (y[0] - Math.cos(t))],
    tspan: [0, 0.1],
    y0: [0],
    options: { tol: 1e-4 },
  },
  {
    name: 'reverse time, firstStep',
    f: (t, y) => [-100 * (y[0] - Math.cos(t))],
    tspan: [0.1, 0],
    y0: [0.9],
    options: { tol: 1e-4, firstStep: 1e-3 },
  },
  {
    name: 'overshoot clamp: firstStep larger than the span',
    f: (_t, y) => [-1000 * y[0]],
    tspan: [0, 1e-5],
    y0: [1],
    options: { tol: 1e-6, firstStep: 1e-3 },
  },
  {
    name: 'maxStep clamp',
    f: (_t, y) => [-1000 * y[0]],
    tspan: [0, 2e-3],
    y0: [1],
    options: { tol: 1e-6, firstStep: 1e-4, maxStep: 5e-5 },
  },
  {
    name: 'minStep clamp',
    f: (_t, y) => [-1000 * y[0]],
    tspan: [0, 2e-3],
    y0: [1],
    options: { tol: 1e-3, firstStep: 1e-6, minStep: 1e-4 },
  },
  {
    name: 'zero initial state takes the 1e-6 initial step',
    f: (_t, y) => [-50 * y[0] + 1, -y[1]],
    tspan: [0, 0.05],
    y0: [0, 0],
    options: { tol: 1e-6 },
  },
];

export const STIFF_MAXITER_CASE: StiffCase = {
  name: 'maxIter reached',
  f: (_t, y) => [-1000 * y[0]],
  tspan: [0, 1],
  y0: [1],
  options: { tol: 1e-6, firstStep: 1e-6, maxIter: 5 },
};
