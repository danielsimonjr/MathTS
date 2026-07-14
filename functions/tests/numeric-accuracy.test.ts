/**
 * Accuracy of the reduction primitives, pinned against exact references.
 *
 * These are the classic instability probes every numerical library is judged on. `sum` is the
 * one that matters most, because `mean`, `std`, `norm` and every statistic inherit its error.
 *
 * Reference points (NumPy 2.3.4, same inputs):
 *
 *   np.sum(1e6 x 0.1)            relErr 2.9e-16   <- pairwise summation
 *   naive accumulation           relErr 1.3e-11   <- what we used to do (~46,000x worse)
 *   np.linalg.norm([1e200] x 4)  inf              <- NumPy OVERFLOWS here; we should not
 */
import { describe, it, expect } from 'vitest';
import { sum, mean, norm, fsum } from '../src/index.js';

/** Neumaier compensated summation — the exact oracle, independent of the implementation. */
function exactSum(xs: readonly number[]): number {
  let s = 0;
  let c = 0;
  for (const x of xs) {
    const t = s + x;
    c += Math.abs(s) >= Math.abs(x) ? s - t + x : x - t + s;
    s = t;
  }
  return s + c;
}

describe('reduction accuracy', () => {
  it('sum of 1e6 x 0.1 is accurate to ~machine epsilon, not O(n)*eps', () => {
    const n = 1_000_000;
    const xs = new Array<number>(n).fill(0.1);
    const got = sum(xs) as number;
    const relErr = Math.abs(got - 100_000) / 100_000;

    console.log(`[acc] sum(1e6 x 0.1) relErr = ${relErr.toExponential(2)} (NumPy: 2.9e-16)`);

    // Naive accumulation lands at ~1.3e-11. Pairwise summation lands at ~1e-16. A bar at 1e-14
    // is two orders of magnitude below the naive result and two above the pairwise one, so it
    // cannot be met by accident and is not tight enough to flake.
    expect(
      relErr,
      'sum is accumulating naively — error is growing as O(n), not O(log n)'
    ).toBeLessThan(1e-14);
  });

  it('mean inherits the accurate sum', () => {
    const n = 1_000_000;
    const xs = new Array<number>(n).fill(0.1);
    const got = mean(xs) as number;
    const relErr = Math.abs(got - 0.1) / 0.1;
    console.log(`[acc] mean(1e6 x 0.1) relErr = ${relErr.toExponential(2)}`);
    expect(relErr).toBeLessThan(1e-14);
  });

  it('sum stays accurate on a hard alternating-magnitude series', () => {
    // Mixed magnitudes with cancellation: naive accumulation drifts badly here.
    const xs: number[] = [];
    for (let i = 0; i < 200_000; i++) {
      xs.push(1e8, 1.0, -1e8, -0.5);
    }
    const want = exactSum(xs); // = 200_000 * 0.5
    const got = sum(xs) as number;
    const relErr = Math.abs(got - want) / Math.abs(want);
    console.log(
      `[acc] alternating-magnitude sum: got ${got}, exact ${want}, relErr ${relErr.toExponential(2)}`
    );
    expect(relErr).toBeLessThan(1e-12);
  });

  it('sum matches the exact oracle on random data', () => {
    const n = 500_000;
    const xs = new Array<number>(n);
    let seed = 12345;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      xs[i] = (seed / 0x7fffffff - 0.5) * 1000;
    }
    const want = exactSum(xs);
    const got = sum(xs) as number;
    const relErr = Math.abs(got - want) / Math.max(1, Math.abs(want));
    console.log(`[acc] random 5e5 sum relErr vs Neumaier = ${relErr.toExponential(2)}`);
    expect(relErr).toBeLessThan(1e-12);
  });

  it('2-norm does not overflow on large-magnitude vectors (NumPy returns inf here)', () => {
    const xs = [1e200, 1e200, 1e200, 1e200];
    const got = norm(xs, 2) as number;
    console.log(`[acc] norm([1e200 x4], 2) = ${got}  (exact 2e200; NumPy gives inf)`);
    expect(Number.isFinite(got), '2-norm overflowed — square-and-sum without scaling').toBe(true);
    expect(Math.abs(got - 2e200) / 2e200).toBeLessThan(1e-15);
  });

  it('2-norm does not underflow to zero on tiny-magnitude vectors', () => {
    const xs = [1e-200, 1e-200, 1e-200, 1e-200];
    const got = norm(xs, 2) as number;
    console.log(`[acc] norm([1e-200 x4], 2) = ${got}  (exact 2e-200)`);
    expect(got, '2-norm underflowed to 0 — squaring flushed to zero').toBeGreaterThan(0);
    expect(Math.abs(got - 2e-200) / 2e-200).toBeLessThan(1e-15);
  });
});

describe('fsum — exact summation (math.fsum equivalent)', () => {
  it('recovers a value that sum, np.sum, and naive all annihilate', () => {
    // np.sum([1e16, 1, -1e16]) === 0.0 ; math.fsum === 1.0
    expect(sum([1e16, 1, -1e16])).toBe(0);
    expect(fsum([1e16, 1, -1e16])).toBe(1);
  });

  it('is exact where pairwise is merely very good', () => {
    const xs = new Array<number>(1_000_000).fill(0.1);
    expect(fsum(xs)).toBe(100_000); // exactly, not 100000.00000000003
  });

  it('accepts Float64Array', () => {
    expect(fsum(Float64Array.from([1e16, 1, -1e16]))).toBe(1);
  });
});
