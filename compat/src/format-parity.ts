/**
 * mathjs 15.3.0 Fraction formatting quirk (#1579 / G04 F5): integral fractions render as
 * `n/1`, not bare `n`. Compare of unit-valued Fractions returns `1/1`, not `1`.
 */
import { isFraction, type Fraction } from '@danielsimonjr/mathts-core';

type FormatFn = (value: unknown, options?: Record<string, unknown>) => string | string[];

/**
 * Wrap a `format` implementation so integral {@link Fraction}s render as `n/1` (mathjs 15.3.0).
 */
export function wrapFractionFormatParity(native: FormatFn): FormatFn {
  return (value: unknown, options?: Record<string, unknown>) => {
    const out = native(value, options);
    if (!isFraction(value) || typeof out !== 'string' || out.includes('/')) {
      return out;
    }
    const den = (value as Fraction).denominator;
    if (den === 1n) {
      return `${(value as Fraction).numerator}/1`;
    }
    return out;
  };
}
