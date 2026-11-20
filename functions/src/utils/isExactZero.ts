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
 * Tells if a stored entry is zero: a number only when it equals 0, any other type by the
 * tolerance of `equalScalar`. The tolerance of `equalScalar` is absolute, so it reads every
 * value of a matrix near 1e-100 as zero (#1169, #1287). A BigNumber, Fraction or Complex keeps
 * the tolerance rule.
 *
 * @param x - The entry.
 * @param equalScalar - The `equalScalar` function of the factory.
 * @returns `true` when the entry is zero.
 */
export function isZeroEntry(x: unknown, equalScalar: (a: unknown, b: unknown) => unknown): boolean {
  return typeof x === 'number' ? x === 0 : Boolean(equalScalar(x, 0));
}
