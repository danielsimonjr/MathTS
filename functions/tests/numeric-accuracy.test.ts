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
import {
  sum,
  mean,
  norm,
  fsum,
  dot,
  distance,
  cumsum,
  parallelStatDistance,
  parallelStatCumsum,
} from '../src/index.js';

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

describe('dot / distance / cumsum accuracy (NumPy/SciPy audit follow-ups)', () => {
  it('dot accumulates pairwise, not naively (both Array and Float64Array paths)', async () => {
    const n = 500_000;
    const a = new Array<number>(n);
    const b = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      a[i] = 1e6 + Math.sin(i);
      b[i] = 1.0 + 1e-3 * Math.cos(i);
    }
    const want = exactSum(a.map((ai, i) => ai * b[i]));

    // Array path (synchronous typed-function branch).
    const gotArr = dot(a, b) as number;
    const relArr = Math.abs(gotArr - want) / Math.abs(want);

    // Float64Array path (routes through computePool.dot's sequential fallback).
    const gotF64 = (await dot(new Float64Array(a), new Float64Array(b))) as number;
    const relF64 = Math.abs(gotF64 - want) / Math.abs(want);

    console.log(`[acc] dot relErr Array=${relArr.toExponential(2)} F64=${relF64.toExponential(2)}`);
    // Naive lands ~6.6e-15 here; pairwise is well below 1e-15.
    expect(relArr).toBeLessThan(1e-15);
    expect(relF64).toBeLessThan(1e-15);
  });

  it('distance does not overflow where naive squaring gives inf', async () => {
    const a = new Float64Array([1e200, 1e200, 1e200, 1e200]);
    const b = new Float64Array([0, 0, 0, 0]);
    const got = (await parallelStatDistance(a, b)) as number;
    console.log(`[acc] distance([1e200 x4], 0) = ${got}  (exact 2e200; naive gives inf)`);
    expect(Number.isFinite(got)).toBe(true);
    expect(Math.abs(got - 2e200) / 2e200).toBeLessThan(1e-15);
  });

  it('distance does not underflow to zero where naive squaring flushes to 0', async () => {
    const a = new Float64Array([1e-200, 1e-200, 1e-200, 1e-200]);
    const b = new Float64Array([0, 0, 0, 0]);
    const got = (await parallelStatDistance(a, b)) as number;
    console.log(`[acc] distance([1e-200 x4], 0) = ${got}  (exact 2e-200; naive gives 0)`);
    expect(got).toBeGreaterThan(0);
    expect(Math.abs(got - 2e-200) / 2e-200).toBeLessThan(1e-15);
  });

  it('cumsum prefix totals stay exact where np.cumsum drifts O(n)*eps', () => {
    const n = 1_000_000;
    const xs = new Float64Array(n).fill(0.1);
    const out = parallelStatCumsum(xs) as Float64Array;
    const relErr = Math.abs(out[n - 1] - 100_000) / 100_000;
    console.log(`[acc] cumsum last relErr = ${relErr.toExponential(2)} (np.cumsum: 1.3e-11)`);
    // Naive prefix scan lands ~1.3e-11; Neumaier compensation is exact.
    expect(relErr).toBeLessThan(1e-14);
  });
});

// The symbols a CONSUMER imports (`distance`, `cumsum`) resolve to the mathjs FACTORY
// implementations, which are separate code paths from the typed ones above. These were still
// naive after the typed fix — the same "wrong layer" trap that bit `sum`. Pin them directly.
describe('public factory paths carry the fix (not just the typed layer)', () => {
  it('public distance does not overflow (was Infinity) or underflow (was 0)', () => {
    const big = distance([1e200, 1e200, 1e200, 1e200], [0, 0, 0, 0]) as number;
    const small = distance([1e-200, 1e-200, 1e-200, 1e-200], [0, 0, 0, 0]) as number;
    console.log(`[acc] public distance big=${big} small=${small} (exact 2e200 / 2e-200)`);
    expect(Number.isFinite(big)).toBe(true);
    expect(Math.abs(big - 2e200) / 2e200).toBeLessThan(1e-15);
    expect(small).toBeGreaterThan(0);
    expect(Math.abs(small - 2e-200) / 2e-200).toBeLessThan(1e-15);
  });

  it('public distance still agrees with the plain answer in the safe range', () => {
    expect(distance([0, 0], [3, 4])).toBe(5);
  });

  it('public cumsum prefix totals stay exact where np.cumsum drifts', () => {
    const n = 1_000_000;
    const xs = new Array<number>(n).fill(0.1);
    const out = cumsum(xs) as number[];
    const relErr = Math.abs(out[n - 1] - 100_000) / 100_000;
    console.log(
      `[acc] public cumsum last relErr = ${relErr.toExponential(2)} (np.cumsum: 1.3e-11)`
    );
    expect(relErr).toBeLessThan(1e-14);
  });

  it('public cumsum still returns correct small flat sums (fast-path exactness)', () => {
    expect(cumsum([1, 2, 3, 4])).toEqual([1, 3, 6, 10]);
    expect(cumsum([0.5, -0.25, 0.25])).toEqual([0.5, 0.25, 0.5]);
  });
});
