/**
 * Forward-mode automatic differentiation over the plain functions surface.
 *
 * The elementary typed functions (`add`/`subtract`/`multiply`/`divide`/`pow`/
 * `sin`/`cos`/`tan`/`exp`/`log`/`sqrt`/`square`/`cbrt`/`cube`/`abs`) carry `Dual`
 * signatures, so a function written with them differentiates exactly when
 * evaluated on a seed `Dual`:
 *
 *   import { multiply, sin, derivativeAt } from '@danielsimonjr/mathts-functions';
 *   derivativeAt((x) => multiply(sin(x), x), 2)   // sin(2) + 2·cos(2)
 *
 * This complements the symbolic `derivative` (which returns an expression) and
 * the autograd package's tensor `grad`: `derivativeAt` evaluates the exact
 * scalar derivative of an ordinary numeric function at a point, with no finite
 * differences and no manual tape.
 */
import { Dual } from '@danielsimonjr/mathts-core';

export type DualFn = (x: Dual) => Dual;

/** Exact derivative of `fn: ℝ → ℝ` at `x0` (forward-mode AD). */
export function derivativeAt(fn: DualFn, x0: number): number {
  return fn(Dual.variable(x0)).deriv;
}

/** Both the value and the exact derivative of `fn` at `x0`. */
export function valueAndDerivativeAt(fn: DualFn, x0: number): { value: number; deriv: number } {
  const r = fn(Dual.variable(x0));
  return { value: r.value, deriv: r.deriv };
}

/**
 * Gradient of `fn: ℝⁿ → ℝ` at `x` by n forward passes (seed one coordinate at a
 * time). `fn` receives an array of `Dual`s and must return a scalar `Dual`.
 */
export function gradientAt(fn: (x: Dual[]) => Dual, x: readonly number[]): number[] {
  const grad = new Array<number>(x.length);
  for (let k = 0; k < x.length; k++) {
    const duals = x.map((xi, i) => (i === k ? Dual.variable(xi) : Dual.constant(xi)));
    grad[k] = fn(duals).deriv;
  }
  return grad;
}
