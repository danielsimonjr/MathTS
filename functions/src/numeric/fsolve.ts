/**
 * Nonlinear system solver: `fsolve` (damped Newton with a backtracking line
 * search) for `F: R^n -> R^n`. Complements the scalar open root-finders
 * (`./open-root-finders.ts`) and reuses the two Phase 1 foundations:
 * `numericJacobian` (Task 1, central-difference Jacobian) and `linsolve`
 * (`../typed/numeric.ts`, LU with partial pivoting) for the Newton step.
 *
 * @packageDocumentation
 */

import { norm2 } from '@danielsimonjr/mathts-core';
import { numericJacobian, type VectorField } from './numeric-jacobian.js';
import { linsolve } from '../typed/numeric.js';

/** Residual map for `fsolve` — vector form, or scalar in 1-D when `x0` is a number. */
export type FsolveField = ((x: number[]) => number | number[]) | ((x: number) => number);

function coerceResidual(r: number | number[], n: number): number[] {
  if (typeof r === 'number') {
    if (n !== 1) {
      throw new TypeError(`fsolve: F(x0) must be a number[] of length ${n}`);
    }
    return [r];
  }
  if (!Array.isArray(r) || r.length !== n) {
    throw new TypeError(`fsolve: F(x0) must be a number[] of length ${n}`);
  }
  return r.slice();
}

/**
 * Bind `F` and initial `x` for damped Newton. A numeric `x0` selects the SciPy-style
 * scalar call `F(x[0])`; an array `x0` always calls `F(x)`.
 */
function prepareFsolve(
  F: FsolveField,
  x0: number | readonly number[]
): { x: number[]; evalF: VectorField } {
  if (typeof x0 === 'number') {
    const x = [x0];
    const scalarF = F as (x: number) => number;
    return {
      x,
      evalF: (v) => coerceResidual(scalarF(v[0]), v.length),
    };
  }
  if (!Array.isArray(x0) && !ArrayBuffer.isView(x0)) {
    throw new TypeError(
      'fsolve: x0 must be a finite number or a non-empty array of finite numbers'
    );
  }
  const x = Array.from(x0 as ArrayLike<number>);
  const vecF = F as (x: number[]) => number | number[];
  return {
    x,
    evalF: (v) => coerceResidual(vecF(v), v.length),
  };
}

function assertFiniteGuess(x: readonly number[]): void {
  if (x.length === 0 || x.some((xi) => !Number.isFinite(xi))) {
    throw new TypeError(
      'fsolve: x0 must be a finite number or a non-empty array of finite numbers'
    );
  }
}

function residualIsFinite(v: readonly number[]): boolean {
  return v.every((vi) => Number.isFinite(vi));
}

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
 * @param F - Residual map `F(x) = 0`. For `x0` as a number, `F` is called as
 *   `F(x[0])` (SciPy-style 1-D). For array `x0`, `F(x)` must return a length-`n`
 *   residual vector (or a scalar when `n === 1`).
 * @param x0 - Initial guess: a number for 1-D, or a length-`n` vector.
 * @param opts - Options (tol, maxIter)
 * @returns Approximate solution vector x with F(x) ~ 0
 * @throws {TypeError} If `x0` is empty or non-finite, or `F(x)` is not a length-`n` residual vector.
 * @throws If the residual is non-finite, the Jacobian is singular (`linsolve` fails),
 *   or Newton fails to converge within `maxIter` iterations. The convergence error
 *   includes the iteration count and the final `max |F_i|`.
 *
 * @example
 * fsolve((v) => [v[0] ** 2 - v[1], v[0] + v[1] - 2], [0.5, 0.5]) // => ~[1, 1]
 * fsolve((x) => x * x - 2, 1) // => ~[√2] (scalar 1-D)
 */
export function fsolve(
  F: FsolveField,
  x0: number | readonly number[],
  opts: FsolveOptions = {}
): number[] {
  const tol = opts.tol ?? 1e-10;
  const maxIter = opts.maxIter ?? 100;

  const { x: xInit, evalF } = prepareFsolve(F, x0);
  let x = xInit;
  assertFiniteGuess(x);
  let Fx = evalF(x);
  if (!residualIsFinite(Fx)) {
    throw new Error('fsolve: non-finite residual at the initial guess');
  }

  for (let iter = 0; iter < maxIter; iter++) {
    if (maxNorm(Fx) < tol) return x;

    const J = numericJacobian(evalF, x);
    const rhs = Fx.map((v) => -v);

    let delta: number[];
    try {
      delta = linsolve(J, rhs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`fsolve: singular Jacobian at iteration ${iter} (${msg})`, { cause: err });
    }

    const residualNorm = norm2(Fx);

    // Backtracking line search: largest lambda in {1, 1/2, 1/4, ...} that
    // improves the residual norm; fall back to a full Newton step (lambda=1).
    // Full Newton step (lambda = 1) — also the fallback if no halving below improves it.
    let xNext = x.map((xi, i) => xi + delta[i]);
    let FxNext = evalF(xNext);
    let nextNorm = norm2(FxNext);

    // A NaN/Inf trial norm must not count as an improvement: `NaN >= r` is false,
    // which used to accept a non-finite Newton step and then burn `maxIter`.
    if (!Number.isFinite(nextNorm) || nextNorm >= residualNorm) {
      let trialLambda = 1;
      for (let halving = 0; halving < 20; halving++) {
        trialLambda /= 2;
        const xTrial = x.map((xi, i) => xi + trialLambda * delta[i]);
        const FxTrial = evalF(xTrial);
        const trialNorm = norm2(FxTrial);
        if (Number.isFinite(trialNorm) && trialNorm < residualNorm) {
          xNext = xTrial;
          FxNext = FxTrial;
          break;
        }
      }
    }

    if (!residualIsFinite(FxNext)) {
      throw new Error(`fsolve: non-finite residual at iteration ${iter}`);
    }

    x = xNext;
    Fx = FxNext;
  }

  if (maxNorm(Fx) < tol) return x;
  const resid = maxNorm(Fx);
  const iters = `${maxIter} iteration${maxIter === 1 ? '' : 's'}`;
  throw new Error(`fsolve: failed to converge within ${iters} (max |F| = ${resid})`);
}

/** Alias for `fsolve` — `root(F, x0)` solves `F(x) = 0`. */
export const root = fsolve;
