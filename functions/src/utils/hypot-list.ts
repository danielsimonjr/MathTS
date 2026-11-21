/** The longest list that `hypotList` spreads into one `Math.hypot` call. */
const HYPOT_SPREAD_MAX = 32768;

/**
 * `sqrt(Σ x²)` of numbers with the rule of `Math.hypot` (IEEE 754): an infinite argument gives
 * Infinity, also with a NaN; else a NaN gives NaN (#1259). A list longer than `HYPOT_SPREAD_MAX`
 * does not go through a spread, because a spread of a long list overflows the call stack. It
 * takes the algorithm of V8's `Math.hypot`: the largest magnitude scales each value, and the
 * squares are added with Kahan compensation.
 * @param xs - the numbers
 */
export function hypotList(xs: readonly number[]): number {
  if (xs.length <= HYPOT_SPREAD_MAX) return Math.hypot(...xs);
  let max = 0;
  let nan = false;
  for (const x of xs) {
    const a = Math.abs(x);
    if (a === Infinity) return Infinity;
    if (a !== a) nan = true;
    else if (a > max) max = a;
  }
  if (nan) return NaN;
  if (max === 0) return 0;
  let sum = 0;
  let compensation = 0;
  for (const x of xs) {
    const r = x / max;
    const term = r * r - compensation;
    const next = sum + term;
    compensation = next - sum - term;
    sum = next;
  }
  return Math.sqrt(sum) * max;
}
