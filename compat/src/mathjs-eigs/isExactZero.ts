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

/**
 * Tells if a stored scalar entry is exactly zero. An absolute tolerance can erase
 * a regular system whose coefficients or right-hand side are uniformly small (#1308),
 * so the test stays exact instead of routing through the factory `isZero`.
 * @param x - The entry.
 * @returns `true` when the entry is zero.
 */
export function isZeroEntry(x: unknown): boolean {
  return isExactZero(x);
}
