/**
 * Nonlinear system solver: `fsolve` (damped Newton with a backtracking line
 * search) for `F: R^n -> R^n`. Complements the scalar open root-finders
 * (`./open-root-finders.ts`) and reuses the two Phase 1 foundations:
 * `numericJacobian` (Task 1, central-difference Jacobian) and `linsolve`
 * (`../typed/numeric.ts`, LU with partial pivoting) for the Newton step.
 *
 * @packageDocumentation
 */

import { numericJacobian, type VectorField } from './numeric-jacobian.js';
import { linsolve } from '../typed/numeric.js';

type f64 = number;
type i32 = number;

/** Options for `fsolve` / `root`. */
export interface FsolveOptions {
  /** Absolute tolerance on max|F_i(x)| for convergence (default 1e-10). */
  tol?: f64;
  /** Maximum Newton iterations (default 100). */
  maxIter?: i32;
}

/** Max-norm of a vector: `max_i |v_i|`. */
function maxNorm(v: readonly number[]): number {
  let m = 0;
  for (const vi of v) m = Math.max(m, Math.abs(vi));
  return m;
}

/** Euclidean norm, used only to compare residual magnitude during line search. */
function norm2(v: readonly number[]): number {
  let s = 0;
  for (const vi of v) s += vi * vi;
  return Math.sqrt(s);
}

/**
 * Solve `F(x) = 0` for `F: R^n -> R^n` via damped Newton's method.
 *
 * At each iterate: compute `J = numericJacobian(F, x)`, solve the Newton
 * step `J * delta = -F(x)` via `linsolve`, then backtrack — try
 * `lambda = 1, 1/2, 1/4, ...` (up to ~20 halvings) and take the largest
 * `lambda` for which `||F(x + lambda*delta)||_2 < ||F(x)||_2`, falling back
 * to `lambda = 1` (a plain Newton step) if no halving improves the residual.
 * Update `x <- x + lambda*delta` and repeat until
 * `max_i |F_i(x)| < tol` (converged) or `maxIter` is exhausted.
 *
 * @param F - Vector field whose root is sought (`F(x) = 0`)
 * @param x0 - Initial guess (length n)
 * @param opts - Options (tol, maxIter)
 * @returns Approximate solution vector x with F(x) ~ 0
 * @throws If the Jacobian is singular (`linsolve` fails) or Newton fails to
 *   converge within `maxIter` iterations.
 *
 * @example
 * fsolve((v) => [v[0] ** 2 - v[1], v[0] + v[1] - 2], [0.5, 0.5]) // => ~[1, 1]
 */
export function fsolve(F: VectorField, x0: readonly number[], opts: FsolveOptions = {}): number[] {
  const tol = opts.tol ?? 1e-10;
  const maxIter = opts.maxIter ?? 100;

  let x = Array.from(x0);
  let Fx = F(x);

  for (let iter = 0; iter < maxIter; iter++) {
    if (maxNorm(Fx) < tol) return x;

    const J = numericJacobian(F, x);
    const rhs = Fx.map((v) => -v);

    let delta: number[];
    try {
      delta = linsolve(J, rhs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`fsolve: singular Jacobian at iteration ${iter} (${msg})`);
    }

    const residualNorm = norm2(Fx);

    // Backtracking line search: largest lambda in {1, 1/2, 1/4, ...} that
    // improves the residual norm; fall back to a full Newton step (lambda=1).
    // Full Newton step (lambda = 1) — also the fallback if no halving below improves it.
    let xNext = x.map((xi, i) => xi + delta[i]);
    let FxNext = F(xNext);

    if (norm2(FxNext) >= residualNorm) {
      let trialLambda = 1;
      for (let halving = 0; halving < 20; halving++) {
        trialLambda /= 2;
        const xTrial = x.map((xi, i) => xi + trialLambda * delta[i]);
        const FxTrial = F(xTrial);
        if (norm2(FxTrial) < residualNorm) {
          xNext = xTrial;
          FxNext = FxTrial;
          break;
        }
      }
    }

    x = xNext;
    Fx = FxNext;
  }

  if (maxNorm(Fx) < tol) return x;
  throw new Error(`fsolve: failed to converge within ${maxIter} iterations`);
}

/** Alias for `fsolve` — `root(F, x0)` solves `F(x) = 0`. */
export const root = fsolve;
