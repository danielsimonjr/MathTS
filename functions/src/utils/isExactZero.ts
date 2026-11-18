/**
 * Tells if a scalar is exactly zero. A number uses `=== 0`. A Complex, Fraction or BigNumber
 * uses its own exact `isZero()`. The tolerance of the `isZero` function does not apply, so a
 * small but nonzero value does not count as zero (#1040, #1188).
 *
 * @param x - The scalar.
 * @returns `true` when the scalar is exactly zero.
 */
export function isExactZero(x: unknown): boolean {
  if (typeof x === 'number') return x === 0;
  const zero = (x as { isZero?: () => boolean } | null)?.isZero;
  return typeof zero === 'function' ? zero.call(x) : x === 0;
}
