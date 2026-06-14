/**
 * @danielsimonjr/mathts-numbers
 *
 * Standalone numeric types for MathTS. Re-exports `Complex`, `Fraction`, and
 * `BigNumber` (with their type guards and constants) from
 * {@link @danielsimonjr/mathts-core} as a focused package. The implementation
 * lives in core; this is an entry point, not a copy.
 *
 * @packageDocumentation
 */

export {
  // Complex numbers
  Complex,
  isComplex,
  I,
  COMPLEX_ZERO,
  COMPLEX_ONE,
  COMPLEX_NEG_ONE,

  // Fractions (exact rationals)
  Fraction,
  isFraction,
  FRACTION_ZERO,
  FRACTION_ONE,
  FRACTION_NEG_ONE,
  FRACTION_HALF,
  FRACTION_THIRD,
  FRACTION_QUARTER,

  // BigNumber (arbitrary-precision decimals)
  BigNumber,
  isBigNumber,
  BIGNUMBER_ZERO,
  BIGNUMBER_ONE,
  BIGNUMBER_NEG_ONE,
  BIGNUMBER_TEN,
  BIGNUMBER_PI,
  BIGNUMBER_E,
  BIGNUMBER_LN2,
  BIGNUMBER_LN10,
} from '@danielsimonjr/mathts-core';

export type {
  IComplex,
  IFraction,
  IBigNumber,
  BigNumberConfig,
  RoundingMode,
} from '@danielsimonjr/mathts-core';
