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

/** Length of a `Unit` exponent vector. */
export const UNIT_DIMENSION_LENGTH = 10;

/** Length of the SI base-dimension tuple `[L, M, T, I, Θ, N, J]`. */
export const SI_DIMENSION_LENGTH = 7;

/**
 * SI base-dimension tuple in the order length, mass, time, current,
 * temperature, amount, luminosity.
 */
export type SiDimensionVector = readonly [number, number, number, number, number, number, number];

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
 * Map a length-10 unit exponent vector onto `[L, M, T, I, Θ, N, J]`.
 */
export function toSiDimensionVector(
  vector: readonly number[],
  options?: SiDimensionOptions
): SiDimensionVector {
  const d = toSiDimensions(vector, options);
  return [d.length, d.mass, d.time, d.current, d.temperature, d.amount, d.luminosity];
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
 */
export function fromSiDimensionVector(vector: readonly number[]): number[] {
  if (vector.length !== SI_DIMENSION_LENGTH) {
    throw new TypeError(
      `SI dimension vector must have length ${SI_DIMENSION_LENGTH} [L, M, T, I, Θ, N, J]`
    );
  }
  return fromSiDimensions({
    length: vector[0],
    mass: vector[1],
    time: vector[2],
    current: vector[3],
    temperature: vector[4],
    amount: vector[5],
    luminosity: vector[6],
  });
}
