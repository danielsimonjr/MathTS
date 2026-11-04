/**
 * VA / VAR classification for complex-valued units.
 * @module @danielsimonjr/mathts-core/types/unit/va-var
 */

/**
 * Whether a complex value counts as purely imaginary, so that `VA` (volt-ampere) should read as
 * `VAR` (reactive volt-ampere).
 *
 * The test is relative: the real part must be negligible next to the imaginary part (at most
 * 1e-14 of it). An absolute cutoff called every value smaller than 1e-14 imaginary, including a
 * purely real 1e-20 VA. `0 + 0i` still counts as imaginary, as it did under the absolute test;
 * NaN in either part does not.
 */
export function isEffectivelyImaginary(re: number, im: number): boolean {
  return Math.abs(re) <= 1e-14 * Math.abs(im);
}
