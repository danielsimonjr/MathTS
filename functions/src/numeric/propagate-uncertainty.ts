/**
 * First-order (linear) uncertainty propagation for scalar expressions.
 *
 * For `f` and inputs `x` with covariance `Σ`,
 *
 *   σ² = ∇f(x)ᵀ Σ ∇f(x)
 *
 * A string expression takes partials from the symbolic {@link derivative}.
 * A function takes central differences
 * `h = relativeStep · max(|xᵢ|, 1e-30)` (default `relativeStep` is `1e-6`).
 * Independent inputs are the shorthand `Σ = diag(σᵢ²)`; pass
 * `options.covariance` for a full matrix, in `Object.keys(values)` order.
 * Supplying both `sigmas` and `covariance` is rejected.
 *
 * `options.curvatureOffsets` reports the second-difference ratio
 * `|f(x+u) + f(x−u) − 2f(x)| / 2 / |∂f/∂x · u|` and does not fold it into
 * `sigma`. This is the linear (delta-method) term only. It does not depend
 * on the autograd package.
 *
 * @packageDocumentation
 */

import { derivative } from '../factories/index.js';
import { evaluate } from '../factories/evaluate.js';

/** A scalar expression, or a black-box map of the same names. */
export type UncertaintyExpression = string | ((values: Record<string, number>) => number);

/** Result of {@link propagateUncertainty}. */
export interface UncertaintyPropagationResult {
  /** `f` evaluated at `values`. */
  readonly value: number;
  /** First-order standard deviation `√(∇fᵀ Σ ∇f)`. */
  readonly sigma: number;
  /** `∂f/∂xᵢ` at `values`, keyed by the names in `values`. */
  readonly partials: Readonly<Record<string, number>>;
  /**
   * Present only when `curvatureOffsets` was passed. `null` means the probe
   * left the domain or the linear term was zero.
   */
  readonly curvature?: Readonly<Record<string, number | null>>;
}

/** Options for {@link propagateUncertainty}. */
export interface UncertaintyPropagationOptions {
  /**
   * Covariance of the inputs, row/column order matching `Object.keys(values)`.
   * When this is set, `sigmas` must be omitted.
   */
  covariance?: ReadonlyArray<ReadonlyArray<number>>;
  /**
   * Relative central-difference step for a function:
   * `h = relativeStep * max(|x|, 1e-30)`. Default `1e-6`.
   * A string expression uses the symbolic derivative and rejects this option.
   */
  relativeStep?: number;
  /**
   * Offsets `uᵢ` for the second-difference ratio, keyed like `values`.
   * The ratio is reported on {@link UncertaintyPropagationResult.curvature}
   * and is not added into `sigma`.
   */
  curvatureOffsets?: Readonly<Record<string, number>>;
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

function centralPartial(
  f: (values: Record<string, number>) => number,
  name: string,
  point: Record<string, number>,
  relativeStep: number
): number {
  const x = point[name];
  const h = relativeStep * Math.max(Math.abs(x), 1e-30);
  const plus = asFiniteNumber(
    `partial of function with respect to "${name}"`,
    f({ ...point, [name]: x + h })
  );
  const minus = asFiniteNumber(
    `partial of function with respect to "${name}"`,
    f({ ...point, [name]: x - h })
  );
  return (plus - minus) / (2 * h);
}

function curvatureRatio(
  evaluateAt: (point: Record<string, number>) => number,
  name: string,
  point: Record<string, number>,
  partial: number,
  offset: number,
  value: number
): number | null {
  if (!Number.isFinite(offset)) {
    throw new TypeError(`curvatureOffsets.${name} is not a finite number`);
  }
  const linear = partial * offset;
  if (linear === 0) return null;
  let up: number;
  let down: number;
  try {
    up = evaluateAt({ ...point, [name]: point[name] + offset });
    down = evaluateAt({ ...point, [name]: point[name] - offset });
  } catch {
    return null;
  }
  if (!Number.isFinite(up) || !Number.isFinite(down)) return null;
  return Math.abs(up + down - 2 * value) / 2 / Math.abs(linear);
}

/**
 * Propagate input uncertainty through a scalar expression to first order.
 *
 * @param expr - Expression in the names of `values` (for example `'x * y'`),
 *   or a function of that same record.
 * @param values - Point at which `f` and `∇f` are evaluated.
 * @param sigmas - Independent 1σ uncertainties, keyed like `values`. Omitted
 *   keys contribute no variance. Do not pass this together with
 *   `options.covariance`.
 * @param options - Full covariance, a finite-difference step, or curvature probes.
 */
export function propagateUncertainty(
  expr: UncertaintyExpression,
  values: Readonly<Record<string, number>>,
  sigmas?: Readonly<Record<string, number>>,
  options?: UncertaintyPropagationOptions
): UncertaintyPropagationResult {
  const isFunction = typeof expr === 'function';
  if (!isFunction && (typeof expr !== 'string' || expr.length === 0)) {
    throw new TypeError('expr must be a non-empty string or a function');
  }
  if (options?.relativeStep !== undefined && !isFunction) {
    throw new TypeError(
      'relativeStep applies only to a function; a string uses the symbolic derivative'
    );
  }
  const relativeStep = options?.relativeStep ?? 1e-6;
  if (isFunction && (!(relativeStep > 0) || !Number.isFinite(relativeStep))) {
    throw new TypeError('relativeStep must be a positive finite number');
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
  const call = isFunction ? (expr as (values: Record<string, number>) => number) : undefined;
  for (const name of names) {
    const d = call
      ? centralPartial(call, name, point, relativeStep)
      : partialDerivative(expr as string, name, point);
    partials[name] = d;
    gradient.push(d);
  }

  const value = asFiniteNumber('value', call ? call(point) : evaluate(expr as string, point));

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

  const sigma = Math.sqrt(variance);
  const offsets = options?.curvatureOffsets;
  if (offsets === undefined) return { value, sigma, partials };
  if (offsets === null || typeof offsets !== 'object') {
    throw new TypeError('curvatureOffsets must be an object of finite numbers');
  }
  const evaluateAt = (at: Record<string, number>): number => {
    if (call) return call(at);
    return asFiniteNumber('curvature probe', evaluate(expr as string, at));
  };
  const curvature: Record<string, number | null> = {};
  for (const name of Object.keys(offsets)) {
    if (!Object.prototype.hasOwnProperty.call(point, name)) {
      throw new TypeError(`curvatureOffsets.${name} has no matching value`);
    }
    curvature[name] = curvatureRatio(evaluateAt, name, point, partials[name], offsets[name], value);
  }
  return { value, sigma, partials, curvature };
}
