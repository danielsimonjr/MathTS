/**
 * Convert a complex array to interleaved Float64Array [re0, im0, re1, im1, ...].
 * Returns null when an element is not a number or `{re, im}` pair.
 * @internal
 */
export function complexToInterleaved(
  arr: unknown[],
  _complex: (re: number, im?: number) => unknown
): Float64Array | null {
  const n = arr.length;
  const result = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const val = arr[i];
    if (typeof val === 'number') {
      result[i * 2] = val;
      result[i * 2 + 1] = 0;
    } else if (
      val &&
      typeof (val as { re?: unknown }).re === 'number' &&
      typeof (val as { im?: unknown }).im === 'number'
    ) {
      const cval = val as { re: number; im: number };
      result[i * 2] = cval.re;
      result[i * 2 + 1] = cval.im;
    } else {
      return null;
    }
  }
  return result;
}
