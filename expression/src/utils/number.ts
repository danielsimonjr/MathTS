/**
 * Number formatting, parsing, and Math polyfills.
 *
 * Consolidated onto core: the implementations live once in
 * `@danielsimonjr/mathts-core/internal` (see the `project-all-libraries-build-on-core`
 * principle). Thin re-export so existing `../utils/number.js` imports keep working
 * while the single source of truth lives in core.
 */
export {
  acosh,
  asinh,
  atanh,
  cbrt,
  copysign,
  cosh,
  digits,
  expm1,
  format,
  isInteger,
  log10,
  log1p,
  log2,
  nearlyEqual,
  normalizeFormatOptions,
  roundDigits,
  safeNumberType,
  sign,
  sinh,
  splitNumber,
  tanh,
  toEngineering,
  toExponential,
  toFixed,
  toPrecision,
} from '@danielsimonjr/mathts-core/internal';
export type {
  FormatOptions,
  NormalizedFormatOptions,
  NumberTypeConfig,
  SplitValue,
} from '@danielsimonjr/mathts-core/internal';
