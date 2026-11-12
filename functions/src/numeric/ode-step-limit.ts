/** Context when an ODE driver exhausts its step budget. */
export interface ODEStepLimitContext {
  method: string;
  maxIter: number;
  acceptedSteps: number;
  attempts: number;
  tStart: number;
  tCurrent: number;
  tFinal: number;
  /** Last attempted step magnitude (absolute), when known. */
  lastStepMag?: number;
}

function _stiffnessHint(ctx: ODEStepLimitContext): string {
  const explicit = ctx.method === 'RK23' || ctx.method === 'RK45';
  if (!explicit) return '';
  const span = Math.abs(ctx.tFinal - ctx.tStart);
  const remaining = Math.abs(ctx.tFinal - ctx.tCurrent);
  if (span > 0 && remaining > span * 0.05) {
    return ' Explicit RK stopped before tFinal — this often indicates a stiff system; try solveODE(..., { method: "BDF" | "Radau" | "Rosenbrock" }).';
  }
  const rejectRatio = ctx.attempts > 0 ? 1 - ctx.acceptedSteps / Math.max(1, ctx.attempts) : 0;
  if (rejectRatio > 0.85 && ctx.acceptedSteps < ctx.attempts * 0.2) {
    return ' The integration rejected most steps — this often indicates a stiff system; try solveODE(..., { method: "BDF" | "Radau" | "Rosenbrock" }).';
  }
  if (
    ctx.lastStepMag !== undefined &&
    span > 0 &&
    ctx.lastStepMag < span * 1e-10 &&
    ctx.attempts > ctx.acceptedSteps * 5
  ) {
    return ' Step size collapsed while error control failed — try an implicit stiff solver (BDF, Radau, or Rosenbrock).';
  }
  return '';
}

/** Human-readable error when `maxIter` accepted steps is exhausted before `tFinal`. */
export function odeMaxStepsError(ctx: ODEStepLimitContext): Error {
  const hint = _stiffnessHint(ctx);
  return new Error(
    `solveODE ${ctx.method}: exceeded maxIter=${ctx.maxIter} accepted steps (${ctx.acceptedSteps} accepted of ${ctx.attempts} attempts, last t=${ctx.tCurrent}, target t=${ctx.tFinal}).${hint} Raise options.maxIter or relax options.tol.`
  );
}

/** Safety cap on rejected-step attempts so explicit RK cannot spin forever. */
export function odeMaxAttempts(maxAccepted: number): number {
  return Math.max(maxAccepted * 250, 1_000_000);
}
