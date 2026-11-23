import { eigvals } from '@danielsimonjr/mathts-matrix';
import { numericJacobian } from './numeric-jacobian.js';

/** Context when an ODE driver exhausts its step budget. */
export interface ODEStepLimitContext {
  method: string;
  /** The budget of accepted steps (the value of the option that `budgetOption` names). */
  maxIter: number;
  acceptedSteps: number;
  attempts: number;
  tStart: number;
  tCurrent: number;
  tFinal: number;
  /** The magnitude (absolute) of the step that the driver would take next. */
  lastStepMag: number;
  /**
   * The fastest decay rate of the linearised problem at the last accepted point, from
   * `odeFastestDecayRate`: the largest value of -Re(eigenvalue) of the Jacobian, or 0. A caller
   * of an explicit method sets it only when it builds the error. A missing value gives no hint.
   */
  fastestDecayRate?: number;
  /** The function that throws, as the caller knows it. Default `solveODE`. */
  caller?: string;
  /** The option that holds the budget. Default `maxIter`. */
  budgetOption?: string;
}

/**
 * Length of the real stability interval of an explicit method, rounded down: Dormand-Prince 5
 * (RK45) 3.3065, Bogacki-Shampine 3 (RK23) 2.5127. A step h is stable for a decay rate mu only
 * when mu * h is below this length.
 */
const RK45_STABILITY_LENGTH = 3.3;
const RK23_STABILITY_LENGTH = 2.5;

/**
 * The step budget message names stiffness only when stability, and not accuracy, limits the step.
 * An explicit method with a decay rate mu needs at least mu * |tFinal - t| / beta more accepted
 * steps (beta is the stability length above), whatever the tolerance is. When that count reaches
 * the budget, the method cannot finish inside the budget, and an implicit method is the remedy.
 * An oscillation has mu = 0, so a smooth problem that only ran out of steps (a long span, or a
 * tight tolerance) gets no hint. The rule has no tuned threshold.
 */
function _stiffnessHint(ctx: ODEStepLimitContext): string {
  const explicit = ctx.method === 'RK23' || ctx.method === 'RK45';
  if (!explicit) return '';
  const span = Math.abs(ctx.tFinal - ctx.tStart);
  const remaining = Math.abs(ctx.tFinal - ctx.tCurrent);
  if (!(span > 0) || remaining <= span * 0.05) return '';
  const mu = ctx.fastestDecayRate;
  if (mu === undefined || !(mu > 0)) return '';
  const beta = ctx.method === 'RK23' ? RK23_STABILITY_LENGTH : RK45_STABILITY_LENGTH;
  if ((mu * remaining) / beta >= ctx.maxIter) {
    return ' Explicit RK stopped before tFinal. If the system is stiff, try solveODE(..., { method: "BDF" | "Radau" | "Rosenbrock" | "RODAS" }).';
  }
  return '';
}

/**
 * The largest state dimension for which the budget error computes the decay rate. The rate costs
 * n + 1 calls of f and one eigenvalue solve, and the solve took 0.35 s at n = 100, 0.94 s at
 * n = 200 and 4.9 s at n = 400 (measured). A larger system gets the budget error with no hint.
 */
export const ODE_HINT_MAX_DIMENSION = 200;

/**
 * The forward-difference Jacobian of a vector field with the step rule of the stiff solvers
 * (relative 1e-7, floor 1e-8). `f0` is `fy(y)`; passing it saves one call.
 */
export function odeForwardJacobian(
  fy: (y: number[]) => number[],
  y: number[],
  f0: number[]
): number[][] {
  return numericJacobian(fy, y, { scheme: 'forward', step: { rel: 1e-7, floor: 1e-8 }, f0 });
}

/**
 * The fastest decay rate mu = max(0, max_i(-Re lambda_i)) of the linearised problem y' = fy(y) at
 * `y`, with the lambda_i the eigenvalues of the forward-difference Jacobian. It is 0 when the
 * system is larger than `ODE_HINT_MAX_DIMENSION`, when a Jacobian entry or an eigenvalue is not
 * finite, when a growing mode gains more than one e-fold over the remaining interval, and when
 * `fy` or the eigenvalue solve throws. Reversing integration reverses growth and decay.
 *
 * The hint is optional information on an error that is thrown anyway. An error of the user's `fy`
 * at a perturbed point must never replace the budget error, so every failure here gives 0. This
 * catch hides no error: the caller throws the budget error in every case.
 */
export function odeFastestDecayRate(
  field: (y: number[]) => number[] | number,
  y: number[],
  remainingTime: number
): number {
  if (y.length === 0 || y.length > ODE_HINT_MAX_DIMENSION) return 0;
  // A scalar equation may return a number: every call is normalised to an Array.
  const fy = (v: number[]): number[] => {
    const r = field(v);
    return Array.isArray(r) ? r : [r];
  };
  try {
    const jacobian = odeForwardJacobian(fy, y, fy(y));
    if (!jacobian.every((row) => row.every(Number.isFinite))) return 0;
    let mu = 0;
    for (const lambda of eigvals(jacobian)) {
      if (!Number.isFinite(lambda.re) || !Number.isFinite(lambda.im)) return 0;
      const growth = lambda.re * Math.sign(remainingTime);
      if (growth * Math.abs(remainingTime) > 1) return 0;
      mu = Math.max(mu, -growth);
    }
    return mu;
  } catch {
    return 0;
  }
}

/**
 * Default cap on **accepted** steps for every ODE driver.
 *
 * Rejected attempts used to consume `maxIter`. After the counter ignores them,
 * RK45 on `x'' = -4x` over `[0, 100]` at `tol = 1e-10` still takes 17086
 * accepted steps and no rejections, so the old explicit-RK default of 1e4
 * stops that problem short of `tFinal`. 1e5 covers it. A span of `1e4` at
 * `tol = 1e-8` takes about 5e5 accepted steps and still needs an explicit
 * `maxIter`.
 */
export const ODE_DEFAULT_MAX_ACCEPTED_STEPS = 100_000;

/** Accepted-step budget. A missing or zero `maxIter` uses the default above. */
export function odeAcceptedBudget(maxIter: number | undefined): number {
  return maxIter ? maxIter : ODE_DEFAULT_MAX_ACCEPTED_STEPS;
}

/** Human-readable error when `maxIter` accepted steps is exhausted before `tFinal`. */
export function odeMaxStepsError(ctx: ODEStepLimitContext): Error {
  const hint = _stiffnessHint(ctx);
  const caller = ctx.caller ?? 'solveODE';
  const option = ctx.budgetOption ?? 'maxIter';
  return new Error(
    `${caller} ${ctx.method}: exceeded ${option}=${ctx.maxIter} accepted steps (${ctx.acceptedSteps} accepted of ${ctx.attempts} attempts, last t=${ctx.tCurrent}, target t=${ctx.tFinal}).${hint} Raise options.${option} or relax options.tol.`
  );
}

/** Safety cap on rejected-step attempts so explicit RK cannot spin forever. */
export function odeMaxAttempts(maxAccepted: number): number {
  return Math.max(maxAccepted * 250, 1_000_000);
}
