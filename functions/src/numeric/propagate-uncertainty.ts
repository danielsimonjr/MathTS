/**
 * First-order (linear) uncertainty propagation for scalar expressions.
 *
 * For `f` and inputs `x` with covariance `Σ`,
 *
 *   σ² = ∇f(x)ᵀ Σ ∇f(x)
 *
 * Partials come from the symbolic {@link derivative}, then are evaluated at
 * `values`. Independent inputs are the shorthand `Σ = diag(σᵢ²)`; pass
 * `options.covariance` for a full matrix, in `Object.keys(values)` order.
 * Supplying both `sigmas` and `covariance` is rejected.
 *
 * This is the linear (delta-method) term only. It does not add a curvature
 * correction, and it does not depend on the autograd package.
 *
 * @packageDocumentation
 */

import { derivative } from '../factories/index.js';
import { evaluate } from '../factories/evaluate.js';

/** Result of {@link propagateUncertainty}. */
export interface UncertaintyPropagationResult {
  /** `f` evaluated at `values`. */
  readonly value: number;
  /** First-order standard deviation `√(∇fᵀ Σ ∇f)`. */
  readonly sigma: number;
  /** `∂f/∂xᵢ` at `values`, keyed by the names in `values`. */
  readonly partials: Readonly<Record<string, number>>;
}

/** Options for {@link propagateUncertainty}. */
export interface UncertaintyPropagationOptions {
  /**
   * Covariance of the inputs, row/column order matching `Object.keys(values)`.
   * When this is set, `sigmas` must be omitted.
   */
  covariance?: ReadonlyArray<ReadonlyArray<number>>;
}

interface EvaluableDerivative {
  evaluate(scope?: Record<string, number>): unknown;
}

function asFiniteNumber(label: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} is not a finite number`);
  }
  return value;
}

function partialDerivative(expr: string, name: string, values: Record<string, number>): number {
  const node = derivative(expr, name) as EvaluableDerivative;
  return asFiniteNumber(`partial of "${expr}" with respect to "${name}"`, node.evaluate(values));
}

/**
 * Propagate input uncertainty through a scalar expression to first order.
 *
 * @param expr - Expression in the names of `values` (for example `'x * y'`).
 * @param values - Point at which `f` and `∇f` are evaluated.
 * @param sigmas - Independent 1σ uncertainties, keyed like `values`. Omitted
 *   keys contribute no variance. Do not pass this together with
 *   `options.covariance`.
 * @param options - Full covariance, in place of `sigmas`.
 */
export function propagateUncertainty(
  expr: string,
  values: Readonly<Record<string, number>>,
  sigmas?: Readonly<Record<string, number>>,
  options?: UncertaintyPropagationOptions
): UncertaintyPropagationResult {
  if (typeof expr !== 'string' || expr.length === 0) {
    throw new TypeError('expr must be a non-empty string');
  }
  if (values === null || typeof values !== 'object') {
    throw new TypeError('values must be an object of finite numbers');
  }

  const names = Object.keys(values);
  const point: Record<string, number> = {};
  for (const name of names) {
    point[name] = asFiniteNumber(`values.${name}`, values[name]);
  }

  const covariance = options?.covariance;
  if (covariance !== undefined && sigmas !== undefined) {
    throw new TypeError('pass either sigmas or covariance, not both');
  }
  if (sigmas !== undefined && (sigmas === null || typeof sigmas !== 'object')) {
    throw new TypeError('sigmas must be an object of finite numbers');
  }

  const partials: Record<string, number> = {};
  const gradient: number[] = [];
  for (const name of names) {
    const d = partialDerivative(expr, name, point);
    partials[name] = d;
    gradient.push(d);
  }

  const value = asFiniteNumber(`value of "${expr}"`, evaluate(expr, point));

  let variance: number;
  if (covariance !== undefined) {
    const n = names.length;
    if (covariance.length !== n) {
      throw new TypeError(`covariance must be ${n}×${n} to match values`);
    }
    variance = 0;
    for (let i = 0; i < n; i++) {
      const row = covariance[i];
      if (row === undefined || row.length !== n) {
        throw new TypeError(`covariance must be ${n}×${n} to match values`);
      }
      let acc = 0;
      for (let j = 0; j < n; j++) {
        const sij = asFiniteNumber(`covariance[${i}][${j}]`, row[j]);
        acc += sij * gradient[j];
      }
      variance += gradient[i] * acc;
    }
  } else {
    variance = 0;
    if (sigmas !== undefined) {
      for (const key of Object.keys(sigmas)) {
        if (!Object.prototype.hasOwnProperty.call(point, key)) {
          throw new TypeError(`sigmas.${key} has no matching value`);
        }
      }
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (!Object.prototype.hasOwnProperty.call(sigmas, name)) continue;
        const sigma = asFiniteNumber(`sigmas.${name}`, sigmas[name]);
        if (sigma < 0) {
          throw new RangeError(`sigmas.${name} must be >= 0`);
        }
        variance += (gradient[i] * sigma) ** 2;
      }
    }
  }

  if (variance < 0) {
    // A non-PSD covariance makes the quadratic form negative.
    if (variance > -1e-12) variance = 0;
    else throw new RangeError('covariance produced a negative variance');
  }

  return { value, sigma: Math.sqrt(variance), partials };
}
