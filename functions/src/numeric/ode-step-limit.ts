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
  /** The function that throws, as the caller knows it. Default `solveODE`. */
  caller?: string;
  /** The option that holds the budget. Default `maxIter`. */
  budgetOption?: string;
}

function _stiffnessHint(ctx: ODEStepLimitContext): string {
  const explicit = ctx.method === 'RK23' || ctx.method === 'RK45';
  if (!explicit) return '';
  const span = Math.abs(ctx.tFinal - ctx.tStart);
  const remaining = Math.abs(ctx.tFinal - ctx.tCurrent);
  if (!(span > 0) || remaining <= span * 0.05) return '';
  // A non-stiff problem that only ran out of accepted steps (SHO with a small
  // maxIter, or tight tol) rejects nothing. Robertson and other stiff explicit
  // runs keep rejecting ~6–12% of attempts while the step stays tiny.
  const rejectRatio = ctx.attempts > 0 ? (ctx.attempts - ctx.acceptedSteps) / ctx.attempts : 0;
  const stepFrac = ctx.lastStepMag / span;
  if (rejectRatio >= 0.05 && stepFrac < 1e-3) {
    return ' Explicit RK stopped before tFinal. If the system is stiff, try solveODE(..., { method: "BDF" | "Radau" | "Rosenbrock" | "RODAS" }).';
  }
  return '';
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
