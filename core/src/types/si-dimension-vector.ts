/**
 * Convert between the length-10 unit exponent vector and the 7 SI base
 * dimensions.
 *
 * `Unit` stores exponents in this order (see `BASE_DIMENSIONS` in
 * `types/unit/Unit.ts`):
 *
 *   0 MASS, 1 LENGTH, 2 TIME, 3 CURRENT, 4 TEMPERATURE,
 *   5 LUMINOUS_INTENSITY, 6 AMOUNT_OF_SUBSTANCE,
 *   7 ANGLE, 8 BIT, 9 SOLID_ANGLE
 *
 * The 7-vector used by dimensional analysis (BIPM base quantities, and the
 * order UPT's Buckingham routine uses) is
 *
 *   [L, M, T, I, Θ, N, J]
 *
 * Angle, bit, and solid angle have no place in that vector. Conversion
 * throws when any of those three exponents is nonzero, unless
 * `ignoreExtra` is set.
 *
 * @packageDocumentation
 */

import type { Dimensions } from './unit-definitions.js';
import { Fraction, isFraction } from './fraction.js';

/** Length of a `Unit` exponent vector. */
export const UNIT_DIMENSION_LENGTH = 10;

/** Length of the SI base-dimension tuple `[L, M, T, I, Θ, N, J]`. */
export const SI_DIMENSION_LENGTH = 7;

/**
 * SI base-dimension tuple in BIPM order `[L, M, T, I, Θ, N, J]`, with exact
 * rational exponents.
 *
 * @example
 * ```ts
 * import { Unit, toSiDimensionVector } from '@danielsimonjr/mathts-core';
 * const [L, M, T] = toSiDimensionVector(new Unit(1, 'N').dimensions);
 * // L.equals(new Fraction(1, 1n)), M.equals(new Fraction(1, 1n)), T.equals(new Fraction(-2, 1n))
 * ```
 */
export type SiDimensionVector = readonly [
  Fraction,
  Fraction,
  Fraction,
  Fraction,
  Fraction,
  Fraction,
  Fraction,
];

/** A single exponent accepted by {@link fromSiDimensionVector}. */
export type SiDimensionExponent = number | Fraction;

/** Options for {@link toSiDimensions} and {@link toSiDimensionVector}. */
export interface SiDimensionOptions {
  /**
   * Drop nonzero angle, bit, and solid-angle exponents instead of throwing.
   * They are not represented in the 7-vector.
   */
  ignoreExtra?: boolean;
}

const EXTRA_INDEXES = [7, 8, 9] as const;

function assertFinite(label: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
}

/**
 * Build an exact {@link Fraction} exponent from a finite unit-vector component.
 *
 * Integers use `new Fraction(n, 1n)`. Non-integers use
 * {@link Fraction.fromNumber} (continued-fraction convergents, default
 * `maxDenominator` `1000000n`).
 */
function numberToFractionExponent(value: number): Fraction {
  assertFinite('exponent', value);
  if (Number.isInteger(value)) {
    return new Fraction(BigInt(value), 1n);
  }
  return Fraction.fromNumber(value);
}

/**
 * Normalize a {@link SiDimensionExponent} to a {@link Fraction} for conversion.
 */
function siExponentToFraction(value: SiDimensionExponent): Fraction {
  if (isFraction(value)) {
    return value;
  }
  return numberToFractionExponent(value);
}

function assertUnitVector(vector: readonly number[]): void {
  if (vector.length !== UNIT_DIMENSION_LENGTH) {
    throw new TypeError(`dimension vector must have length ${UNIT_DIMENSION_LENGTH}`);
  }
  for (let i = 0; i < vector.length; i++) {
    assertFinite(`dimension vector[${i}]`, vector[i]);
  }
}

function rejectExtra(vector: readonly number[], options?: SiDimensionOptions): void {
  if (options?.ignoreExtra) return;
  for (const index of EXTRA_INDEXES) {
    if (vector[index] !== 0) {
      throw new RangeError(
        `dimension vector has a nonzero angle, bit, or solid-angle exponent at index ${index}; pass { ignoreExtra: true } to drop it`
      );
    }
  }
}

/**
 * Map a length-10 unit exponent vector onto the {@link Dimensions} record.
 */
export function toSiDimensions(
  vector: readonly number[],
  options?: SiDimensionOptions
): Dimensions {
  assertUnitVector(vector);
  rejectExtra(vector, options);
  return {
    length: vector[1],
    mass: vector[0],
    time: vector[2],
    current: vector[3],
    temperature: vector[4],
    amount: vector[6],
    luminosity: vector[5],
  };
}

/**
 * Map a length-10 unit exponent vector onto exact `[L, M, T, I, Θ, N, J]`.
 *
 * Non-integer components use {@link Fraction.fromNumber} with default
 * `maxDenominator` `1000000n` (last continued-fraction convergent at or below
 * that denominator). `NaN` and `Infinity` throw (same contract as
 * `Fraction.fromNumber`).
 *
 * @example
 * ```ts
 * import { toSiDimensionVector, Fraction } from '@danielsimonjr/mathts-core';
 * const vec = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
 * vec[2] = 0.5; // time exponent 1/2 (e.g. sqrt Hz style)
 * const [, , T] = toSiDimensionVector(vec);
 * T.equals(new Fraction(1n, 2n)); // true
 * ```
 */
export function toSiDimensionVector(
  vector: readonly number[],
  options?: SiDimensionOptions
): SiDimensionVector {
  const d = toSiDimensions(vector, options);
  return [
    numberToFractionExponent(d.length),
    numberToFractionExponent(d.mass),
    numberToFractionExponent(d.time),
    numberToFractionExponent(d.current),
    numberToFractionExponent(d.temperature),
    numberToFractionExponent(d.amount),
    numberToFractionExponent(d.luminosity),
  ];
}

/**
 * Map a {@link Dimensions} record onto a length-10 unit exponent vector.
 * Angle, bit, and solid angle are zero.
 */
export function fromSiDimensions(dimensions: Dimensions): number[] {
  const fields = [
    ['mass', dimensions.mass],
    ['length', dimensions.length],
    ['time', dimensions.time],
    ['current', dimensions.current],
    ['temperature', dimensions.temperature],
    ['luminosity', dimensions.luminosity],
    ['amount', dimensions.amount],
  ] as const;
  for (const [name, value] of fields) {
    assertFinite(`dimensions.${name}`, value);
  }
  return [
    dimensions.mass,
    dimensions.length,
    dimensions.time,
    dimensions.current,
    dimensions.temperature,
    dimensions.luminosity,
    dimensions.amount,
    0,
    0,
    0,
  ];
}

/**
 * Map `[L, M, T, I, Θ, N, J]` onto a length-10 unit exponent vector.
 *
 * Each exponent may be a `number` or {@link Fraction}; values are converted
 * with {@link Fraction.toNumber} for `Unit`'s `number[]` storage.
 *
 * @example
 * ```ts
 * import { fromSiDimensionVector, toSiDimensionVector, Fraction } from '@danielsimonjr/mathts-core';
 * const ten = fromSiDimensionVector([1, 1, -2, 0, 0, 0, 0]);
 * const rational = toSiDimensionVector(ten);
 * // Need numeric components for arithmetic? rational.map((f) => f.toNumber())
 * ```
 */
export function fromSiDimensionVector(vector: readonly SiDimensionExponent[]): number[] {
  if (vector.length !== SI_DIMENSION_LENGTH) {
    throw new TypeError(
      `SI dimension vector must have length ${SI_DIMENSION_LENGTH} [L, M, T, I, Θ, N, J]`
    );
  }
  const nums = vector.map((component, i) => {
    try {
      return siExponentToFraction(component).toNumber();
    } catch (err) {
      if (err instanceof Error && err.message.includes('non-finite')) {
        throw new TypeError(`SI dimension vector[${i}] must be a finite number`);
      }
      throw err;
    }
  });
  for (let i = 0; i < nums.length; i++) {
    assertFinite(`SI dimension vector[${i}]`, nums[i]);
  }
  return fromSiDimensions({
    length: nums[0],
    mass: nums[1],
    time: nums[2],
    current: nums[3],
    temperature: nums[4],
    amount: nums[5],
    luminosity: nums[6],
  });
}
