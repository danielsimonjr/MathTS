/**
 * First-order (linear) uncertainty propagation for scalar expressions.
 *
 * For `f` and inputs `x` with covariance `Σ`,
 *
 *   σ² = ∇f(x)ᵀ Σ ∇f(x)
 *
 * A string expression takes partials from the symbolic {@link derivative}.
 * A function takes central differences. It receives ONE record of the inputs, so write
 * `({ m, c }) => m * c * c` and not `(m, c) => m * c * c`.
 *
 * The step starts at `h = relativeStep · s` (default `relativeStep` is `1e-6`), where `s` is
 * the scale of the input: `max(|xᵢ|, σᵢ)`, or 1 when both are 0. The uncertainty is part of
 * the scale because it says how far the function is probed, and `xᵢ` alone is the wrong
 * scale at 0 or at a tiny constant. The step then adapts to `f`:
 *   - `f` is not finite at `x ± h`: `h` shrinks by 10 until it is;
 *   - the difference `f(x+h) − f(x−h)` is within 1e6 roundings of `f`: `h` grows by 10, up
 *     to `s`, until `f` resolves it.
 * A partial that is still within rounding of 0 at `h = s` is returned as computed and its
 * name is listed in `result.flat`: `f` does not depend on that input, or is symmetric about it.
 *
 * Independent inputs are the shorthand `Σ = diag(σᵢ²)`; pass
 * `options.covariance` for a full matrix, in `Object.keys(values)` order.
 * Supplying both `sigmas` and `covariance` is rejected.
 *
 * A value may be a CODATA constant (`electronMass`, `fineStructure`, ...) in place of a
 * number. The callback and the expression read its SI magnitude, and its absolute
 * `.uncertainty`, converted to the same SI scale, is the input sigma. A `sigmas` entry
 * for the same name wins. `options.covariance` replaces every constant uncertainty, so
 * its diagonal must state a positive variance for each constant that has one; pass the bare
 * number for an input that is exact. A `Unit` that has no `.uncertainty` adds no variance
 * by itself. All arithmetic is in doubles: a `Decimal` constant (`number: 'BigNumber'`) is
 * read as the nearest double, so its extra digits do not reach the result.
 *
 * `options.curvatureOffsets` reports the second-difference ratio
 * `|f(x+u) + f(x−u) − 2f(x)| / 2 / |∂f/∂x · u|` and does not fold it into
 * `sigma`. This is the linear (delta-method) term only. It does not depend
 * on the autograd package.
 *
 * @packageDocumentation
 */

import { isUnit, type UnitInstance } from '@danielsimonjr/mathts-core';
import { derivative } from '../factories/index.js';
import { evaluate } from '../factories/evaluate.js';
import type { createFineStructure } from '../type/unit/physicalConstants.js';

/** A scalar expression, or a black-box map of the same names. */
export type UncertaintyExpression = string | ((values: Record<string, number>) => number);

/**
 * A dimensionless CODATA scalar (`fineStructure`, `weakMixingAngle`, ...): a number by
 * `valueOf()` with an absolute `.uncertainty`.
 */
export interface UncertainScalar {
  valueOf(): number;
  readonly uncertainty: number;
}

/**
 * The declared type of a dimensionless CODATA constant such as `fineStructure`
 * (`number | Decimal`, the result type of its factory). The constant of the default
 * configuration is an {@link UncertainScalar} at run time; with `number: 'BigNumber'` it is a
 * `Decimal` that carries the same `.uncertainty`.
 */
type DeclaredScalarConstant = ReturnType<typeof createFineStructure>;

/**
 * One entry of `values`: a number, a `Unit` (read as its SI magnitude; a CODATA constant
 * also carries its `.uncertainty`) or a dimensionless CODATA scalar.
 */
export type UncertaintyInput = number | UnitInstance | UncertainScalar | DeclaredScalarConstant;

/** Result of {@link propagateUncertainty}. */
export interface UncertaintyPropagationResult {
  /** `f` evaluated at `values`. */
  readonly value: number;
  /** First-order standard deviation `√(∇fᵀ Σ ∇f)`. */
  readonly sigma: number;
  /** `∂f/∂xᵢ` at `values`, keyed by the names in `values`. */
  readonly partials: Readonly<Record<string, number>>;
  /**
   * Present only for a function, and only when it is not empty: the inputs whose central
   * difference stayed within rounding of 0 at every step up to the scale of the input. Their
   * partial is 0 (or rounding noise): `f` does not depend on the input, or is symmetric about it.
   */
  readonly flat?: ReadonlyArray<string>;
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
   * First relative central-difference step for a function: `h = relativeStep * s`, where
   * `s = max(|x|, sigma)` (1 when both are 0). Default `1e-6`. The step then shrinks or grows
   * to suit `f` (see the module header).
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

/** One entry of `values` as the SI number the expression reads, and its own sigma if it has one. */
interface Reading {
  readonly value: number;
  readonly sigma?: number;
}

/**
 * The reading of one entry of `values`.
 *
 * A `Unit` is read as its SI magnitude (`Unit.value`). Its `.uncertainty` is stated in the
 * unit the constant is written in (`GeV^-2` for `fermiCoupling`), so it is scaled by
 * SI magnitude / written magnitude to give an SI sigma. A dimensionless scalar is read
 * through `valueOf()`.
 */
function readInput(name: string, entry: unknown): Reading {
  const label = `values.${name}`;
  if (typeof entry === 'number') return { value: asFiniteNumber(label, entry) };
  if (typeof entry !== 'object' || entry === null) {
    return { value: asFiniteNumber(label, entry) };
  }
  const stated = (entry as { uncertainty?: unknown }).uncertainty;
  if (stated !== undefined && (typeof stated !== 'number' || !(stated >= 0))) {
    throw new RangeError(`${label}.uncertainty must be a finite number >= 0`);
  }
  if (isUnit(entry)) {
    const unit = entry as UnitInstance;
    if (unit.value === null) throw new TypeError(`${label} is a unit with no value`);
    const value = asFiniteNumber(label, Number(unit.value));
    if (stated === undefined) return { value };
    const written = Number(unit.toNumeric());
    const scale = written === 0 || !Number.isFinite(written) ? 1 : value / written;
    return { value, sigma: stated * scale };
  }
  // A dimensionless constant: a number by valueOf (a `Decimal` converts through its string).
  const value = asFiniteNumber(label, Number(entry));
  return stated === undefined ? { value } : { value, sigma: stated };
}

function partialDerivative(expr: string, name: string, values: Record<string, number>): number {
  const node = derivative(expr, name) as EvaluableDerivative;
  return asFiniteNumber(`partial of "${expr}" with respect to "${name}"`, node.evaluate(values));
}

/** A step shrinks or grows by this factor while the search looks for one that `f` resolves. */
const STEP_FACTOR = 10;
/** The most times the step shrinks: `f` is not finite at `x ± h`, or the slope has not settled. */
const MAX_STEP_SHRINKS = 24;
/** Two steps that differ by a factor of 10 agree when their slopes differ by at most this fraction. */
const SLOPE_AGREEMENT = 1e-4;
/**
 * A central difference counts as resolved when it exceeds this many roundings of `f`
 * (`ε · max(|f(x+h)|, |f(x−h)|)`): its own rounding error is then at most 1e-6 of it.
 */
const RESOLVED_ROUNDINGS = 1e6;

/**
 * A negative variance down to this fraction of the summed absolute terms of the quadratic form
 * is rounding, not a covariance that is not positive semidefinite. The partials of a function
 * carry a relative error of about ε / relativeStep (2e-10 by default), so the tolerance is
 * above that and far below the size of a real violation.
 */
const NEGATIVE_VARIANCE_ROUNDING = 1e-9;

/** The scale of an input: how far `f` is probed. It is never 0, so a step is never 0. */
function inputScale(x: number, sigma: number): number {
  const scale = Math.max(Math.abs(x), sigma);
  return scale === 0 ? 1 : scale;
}

interface PartialEstimate {
  readonly partial: number;
  /** The difference stayed within rounding of 0 at every step up to the scale. */
  readonly flat: boolean;
}

function centralPartial(
  f: (values: Record<string, number>) => number,
  name: string,
  point: Record<string, number>,
  scale: number,
  relativeStep: number
): PartialEstimate {
  const x = point[name];
  const label = `partial of function with respect to "${name}"`;
  // `half` is the realized half-width (x+h) - (x-h) over 2, which rounding of x can change.
  const probe = (h: number): { plus: number; minus: number; half: number } => {
    const up = x + h;
    const down = x - h;
    return {
      plus: f({ ...point, [name]: up }),
      minus: f({ ...point, [name]: down }),
      half: (up - down) / 2,
    };
  };
  const finite = (p: { plus: number; minus: number }): boolean =>
    Number.isFinite(p.plus) && Number.isFinite(p.minus);
  const resolved = (p: { plus: number; minus: number }): boolean =>
    Math.abs(p.plus - p.minus) >
    RESOLVED_ROUNDINGS * Number.EPSILON * Math.max(Math.abs(p.plus), Math.abs(p.minus));

  const slope = (p: { plus: number; minus: number; half: number }): number =>
    (p.plus - p.minus) / (2 * p.half);

  // The step cannot be 0: an input of 5e-324 has relativeStep * scale = 0.
  let h = Math.max(relativeStep * scale, Number.MIN_VALUE);
  let current = probe(h);
  let shrinks = 0;
  // Shrink while f overflows (or is undefined) at x ± h.
  while (!finite(current) && shrinks < MAX_STEP_SHRINKS && h / STEP_FACTOR > 0) {
    h /= STEP_FACTOR;
    shrinks++;
    current = probe(h);
  }
  asFiniteNumber(label, current.plus);
  asFiniteNumber(label, current.minus);
  if (shrinks > 0) {
    // f overflowed at the first step, so that step is wide against the scale of f and the
    // first finite one may still be: shrink until two steps agree on the slope.
    while (shrinks < MAX_STEP_SHRINKS && h / STEP_FACTOR > 0) {
      const next = probe(h / STEP_FACTOR);
      if (!finite(next) || !resolved(next)) break;
      const agreed =
        Math.abs(slope(next) - slope(current)) <= SLOPE_AGREEMENT * Math.abs(slope(next));
      h /= STEP_FACTOR;
      shrinks++;
      current = next;
      if (agreed) break;
    }
  } else {
    // Grow while the difference is within rounding of f, but never past the scale of the input.
    while (!resolved(current) && h * STEP_FACTOR <= scale) {
      const next = probe(h * STEP_FACTOR);
      if (!finite(next)) break;
      h *= STEP_FACTOR;
      current = next;
    }
  }
  if (!(current.half > 0)) {
    throw new RangeError(`${label}: the step is below the resolution of ${x}`);
  }
  return { partial: asFiniteNumber(label, slope(current)), flat: !resolved(current) };
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
 * @param values - Point at which `f` and `∇f` are evaluated, keyed by input name. An entry
 *   is a number or a CODATA constant (see the header). The function and the expression
 *   receive the SI magnitude of each constant.
 * @param sigmas - Independent 1σ uncertainties, keyed like `values`. Omitted
 *   keys contribute no variance. Do not pass this together with
 *   `options.covariance`.
 * @param options - Full covariance, a finite-difference step, or curvature probes.
 */
export function propagateUncertainty(
  expr: UncertaintyExpression,
  values: Readonly<Record<string, UncertaintyInput>>,
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
  if (values === null || typeof values !== 'object' || Array.isArray(values) || isUnit(values)) {
    throw new TypeError(
      'values must be an object that maps each input name to a number or a constant, ' +
        'for example { m: electronMass }; the function receives that object as its argument'
    );
  }

  const names = Object.keys(values);
  const point: Record<string, number> = {};
  const ownSigma: Record<string, number> = {};
  for (const name of names) {
    const reading = readInput(name, values[name]);
    point[name] = reading.value;
    if (reading.sigma !== undefined) ownSigma[name] = reading.sigma;
  }

  const covariance = options?.covariance;
  if (covariance !== undefined && sigmas !== undefined) {
    throw new TypeError('pass either sigmas or covariance, not both');
  }
  if (sigmas !== undefined && (sigmas === null || typeof sigmas !== 'object')) {
    throw new TypeError('sigmas must be an object of finite numbers');
  }

  const has = (record: object | undefined, key: string): boolean =>
    record !== undefined && Object.prototype.hasOwnProperty.call(record, key);
  // The sigma that sets the scale of the first step: the explicit one, the constant's own,
  // or the square root of the covariance diagonal. An invalid one is rejected below.
  const sigmaForStep = (name: string, i: number): number => {
    let sigma = 0;
    if (has(sigmas, name)) sigma = Math.abs(Number(sigmas![name]));
    else if (has(ownSigma, name)) sigma = ownSigma[name];
    else if (covariance !== undefined) sigma = Math.sqrt(Math.max(Number(covariance[i]?.[i]), 0));
    return Number.isFinite(sigma) ? sigma : 0;
  };

  const partials: Record<string, number> = {};
  const gradient: number[] = [];
  const flat: string[] = [];
  const call = isFunction ? (expr as (values: Record<string, number>) => number) : undefined;
  // A function is evaluated first: a positional callback `(m, c) => ...` gets the record as
  // `m` and returns NaN, and that is the cause to report, not a partial.
  const fAtPoint = call ? call(point) : undefined;
  if (call && Number.isNaN(fAtPoint)) {
    throw new TypeError(
      'the function returned NaN at the input values. It receives ONE record of the inputs, ' +
        `so write ({${names.join(', ')}}) => ... and not (${names.join(', ')}) => ...`
    );
  }
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (call) {
      const scale = inputScale(point[name], sigmaForStep(name, i));
      const estimate = centralPartial(call, name, point, scale, relativeStep);
      partials[name] = estimate.partial;
      if (estimate.flat) flat.push(name);
    } else {
      partials[name] = partialDerivative(expr as string, name, point);
    }
    gradient.push(partials[name]);
  }

  const value = asFiniteNumber('value', call ? fAtPoint : evaluate(expr as string, point));

  let variance: number;
  if (covariance !== undefined) {
    const n = names.length;
    if (covariance.length !== n) {
      throw new TypeError(`covariance must be ${n}×${n} to match values`);
    }
    variance = 0;
    // The sum of the absolute terms of the quadratic form: the scale of its rounding error.
    let varianceScale = 0;
    for (let i = 0; i < n; i++) {
      const row = covariance[i];
      if (row === undefined || row.length !== n) {
        throw new TypeError(`covariance must be ${n}×${n} to match values`);
      }
      let acc = 0;
      for (let j = 0; j < n; j++) {
        const sij = asFiniteNumber(`covariance[${i}][${j}]`, row[j]);
        acc += sij * gradient[j];
        varianceScale += Math.abs(gradient[i] * sij * gradient[j]);
      }
      variance += gradient[i] * acc;
    }
    // A constant has its own uncertainty, and the covariance replaces it. A zero variance for
    // it is a left-out entry, not a statement that the constant is exact (that is a number).
    for (let i = 0; i < n; i++) {
      const name = names[i];
      if (has(ownSigma, name) && ownSigma[name] > 0 && !(covariance[i][i] > 0)) {
        throw new RangeError(
          `values.${name} is a constant with uncertainty ${ownSigma[name]}, but ` +
            `covariance[${i}][${i}] is ${covariance[i][i]}. The covariance replaces the constant ` +
            `uncertainty: put its variance on the diagonal, or pass the bare number for an exact input`
        );
      }
    }
    // Rounding makes the exact-zero variance of a singular covariance slightly negative; it is
    // rounding when the size is small against the terms that were summed.
    if (variance < 0 && variance >= -NEGATIVE_VARIANCE_ROUNDING * varianceScale) variance = 0;
  } else {
    variance = 0;
    if (sigmas !== undefined) {
      for (const key of Object.keys(sigmas)) {
        if (!Object.prototype.hasOwnProperty.call(point, key)) {
          throw new TypeError(`sigmas.${key} has no matching value`);
        }
      }
    }
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      let sigma: number;
      if (sigmas !== undefined && Object.prototype.hasOwnProperty.call(sigmas, name)) {
        sigma = asFiniteNumber(`sigmas.${name}`, sigmas[name]);
        if (sigma < 0) {
          throw new RangeError(`sigmas.${name} must be >= 0`);
        }
      } else if (Object.prototype.hasOwnProperty.call(ownSigma, name)) {
        sigma = ownSigma[name];
      } else {
        continue;
      }
      variance += (gradient[i] * sigma) ** 2;
    }
  }

  if (variance < 0) {
    // A non-PSD covariance makes the quadratic form negative.
    throw new RangeError('covariance produced a negative variance');
  }

  const sigma = Math.sqrt(variance);
  if (!Number.isFinite(sigma)) {
    throw new RangeError(
      'the propagated sigma is not finite: a partial times its sigma overflows a double'
    );
  }
  const found = flat.length > 0 ? { flat } : {};
  const offsets = options?.curvatureOffsets;
  if (offsets === undefined) return { value, sigma, partials, ...found };
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
  return { value, sigma, partials, ...found, curvature };
}
