/**
 * @danielsimonjr/mathts-arithmetic
 *
 * Standalone arithmetic functions for MathTS. Re-exports the `arithmetic` typed-function domain
 * from {@link @danielsimonjr/mathts-functions} as a focused package. The
 * implementation lives in functions; this is an entry point, not a copy.
 *
 * @packageDocumentation
 */

export {
  add,
  subtract,
  multiply,
  divide,
  unaryMinus,
  unaryPlus,
  abs,
  sign,
  pow,
  sqrt,
  square,
  cube,
  cbrt,
  nthRoot,
  exp,
  log,
  log10,
  log2,
  log1p,
  expm1,
  round,
  floor,
  ceil,
  fix,
  mod,
  gcd,
  lcm,
  xgcd,
  norm,
  sinh,
  cosh,
  tanh,
  equal,
  smaller,
  larger,
  smallerEq,
  largerEq,
  compare,
  min,
  max,
  sum,
  mean,
  variance,
  std,
  dot,
  typedArithmetic,
} from '@danielsimonjr/mathts-functions';
