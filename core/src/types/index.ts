/**
 * MathTS Core Types
 * @module @mathts/core/types
 */

// Interfaces and type definitions
export type {
  MathTSValue,
  Scalar,
  BackendType,
  NumericType,
  MatrixBackend,
  IMatrix,
  IComplex,
  IFraction,
  IBigNumber,
  MatrixDimensions
} from './interfaces';

// Complex numbers
export { Complex, isComplex, I, COMPLEX_ZERO, COMPLEX_ONE, COMPLEX_NEG_ONE } from './complex';

// Fractions (exact rationals)
export {
  Fraction,
  isFraction,
  FRACTION_ZERO,
  FRACTION_ONE,
  FRACTION_NEG_ONE,
  FRACTION_HALF,
  FRACTION_THIRD,
  FRACTION_QUARTER
} from './fraction';

// BigNumber (arbitrary precision decimals)
export {
  BigNumber,
  isBigNumber,
  BIGNUMBER_ZERO,
  BIGNUMBER_ONE,
  BIGNUMBER_NEG_ONE,
  BIGNUMBER_TEN,
  BIGNUMBER_PI,
  BIGNUMBER_E,
  BIGNUMBER_LN2,
  BIGNUMBER_LN10
} from './bignumber';
export type { BigNumberConfig, RoundingMode } from './bignumber';
