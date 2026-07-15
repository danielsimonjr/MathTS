/**
 * The stable reduction primitives, against exact references.
 * Reference: NumPy 2.3.4 gives relErr 2.9e-16 on sum(1e6 x 0.1); naive gives 1.3e-11.
 */
import { describe, it, expect } from 'vitest';
import {
  pairwiseSum,
  neumaierSum,
  norm2,
  pairwiseDot,
  scaledDistance,
  neumaierCumsum,
  sumSquaredDeviations,
} from '../src/numeric/stable.js';

const naive = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe('pairwiseSum', () => {
  it('beats naive accumulation by orders of magnitude on 1e6 x 0.1', () => {
    const xs = new Array<number>(1_000_000).fill(0.1);
    const errPair = Math.abs(pairwiseSum(xs) - 100_000) / 100_000;
    const errNaive = Math.abs(naive(xs) - 100_000) / 100_000;
    console.log(
      `[stable] pairwise ${errPair.toExponential(2)} vs naive ${errNaive.toExponential(2)}`
    );
    expect(errPair).toBeLessThan(1e-14);
    expect(errPair).toBeLessThan(errNaive / 100); // decisively better, not marginally
  });

  it('is exact on small inputs and handles every length (block boundaries)', () => {
    expect(pairwiseSum([])).toBe(0);
    expect(pairwiseSum([1.5])).toBe(1.5);
    // Lengths straddling the 128-block boundary and the 8-wide unroll tail.
    for (const n of [7, 8, 9, 127, 128, 129, 255, 256, 257, 1000]) {
      const xs = Array.from({ length: n }, (_, i) => i + 1);
      expect(pairwiseSum(xs), `n=${n}`).toBe((n * (n + 1)) / 2);
    }
  });

  it('respects start/end bounds', () => {
    const xs = [100, 1, 2, 3, 100];
    expect(pairwiseSum(xs, 1, 4)).toBe(6);
  });
});

describe('neumaierSum', () => {
  it('recovers a value that naive AND pairwise AND np.sum all annihilate', () => {
    // np.sum([1e16, 1, -1e16]) === 0.0; math.fsum === 1.0
    expect(neumaierSum([1e16, 1, -1e16])).toBe(1);
    expect(pairwiseSum([1e16, 1, -1e16])).toBe(0); // documents the limit of pairwise
  });

  it('is exact on 1e6 x 0.1', () => {
    expect(neumaierSum(new Array<number>(1_000_000).fill(0.1))).toBe(100_000);
  });
});

describe('norm2', () => {
  it('does not overflow where NumPy does (np.linalg.norm([1e200]*4) === inf)', () => {
    expect(norm2([1e200, 1e200, 1e200, 1e200])).toBe(2e200);
  });

  it('does not underflow to zero', () => {
    expect(norm2([1e-200, 1e-200, 1e-200, 1e-200])).toBe(2e-200);
  });

  it('agrees with sqrt(sum of squares) in the safe range', () => {
    const xs = [3, 4];
    expect(norm2(xs)).toBe(5);
    const ys = [1, 2, 3, 4, 5];
    expect(norm2(ys)).toBeCloseTo(Math.sqrt(55), 12);
  });

  it('handles zeros, empties, and NaN', () => {
    expect(norm2([])).toBe(0);
    expect(norm2([0, 0])).toBe(0);
    expect(norm2([0, 3, 0, 4])).toBe(5);
    expect(Number.isNaN(norm2([1, NaN]))).toBe(true);
  });
});

describe('pairwiseDot', () => {
  it('beats naive accumulation on an ill-conditioned dot (large mean × small factor)', () => {
    const n = 1_000_000;
    const a = new Float64Array(n);
    const b = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      a[i] = 1e6 + Math.sin(i);
      b[i] = 1.0 + 1e-3 * Math.cos(i);
    }
    // Neumaier over the products is the exact reference.
    const prods = new Float64Array(n);
    for (let i = 0; i < n; i++) prods[i] = a[i] * b[i];
    const truth = neumaierSum(prods);

    const pd = pairwiseDot(a, b);
    let naive = 0;
    for (let i = 0; i < n; i++) naive += a[i] * b[i];

    const errPair = Math.abs(pd - truth) / Math.abs(truth);
    const errNaive = Math.abs(naive - truth) / Math.abs(truth);
    console.log(
      `[stable] dot pairwise ${errPair.toExponential(2)} vs naive ${errNaive.toExponential(2)}`
    );
    expect(errPair).toBeLessThan(errNaive / 5); // decisively better
  });

  it('is exact on small inputs and every length (block boundaries)', () => {
    expect(pairwiseDot([], [])).toBe(0);
    expect(pairwiseDot([3], [4])).toBe(12);
    for (const len of [7, 8, 9, 127, 128, 129, 255, 256, 257, 1000]) {
      const a = Array.from({ length: len }, (_, i) => i + 1);
      const b = Array.from({ length: len }, () => 1);
      // Σ (i+1)·1 = n(n+1)/2
      expect(pairwiseDot(a, b), `len=${len}`).toBe((len * (len + 1)) / 2);
    }
  });

  it('respects start/end bounds', () => {
    const a = [100, 2, 3, 4, 100];
    const b = [100, 1, 1, 1, 100];
    expect(pairwiseDot(a, b, 1, 4)).toBe(9); // 2+3+4
  });
});

describe('scaledDistance', () => {
  it('does not overflow where NumPy does (np.linalg.norm([1e200]*4-0) === inf)', () => {
    expect(scaledDistance([1e200, 1e200, 1e200, 1e200], [0, 0, 0, 0])).toBe(2e200);
  });

  it('does not underflow to zero where naive squaring silently does', () => {
    expect(scaledDistance([1e-200, 1e-200, 1e-200, 1e-200], [0, 0, 0, 0])).toBe(2e-200);
  });

  it('agrees with sqrt(sum of squared diffs) in the safe range', () => {
    expect(scaledDistance([3, 0], [0, 4])).toBe(5);
    expect(scaledDistance([1, 2, 3], [0, 0, 0])).toBeCloseTo(Math.sqrt(14), 12);
  });

  it('is zero for identical vectors and propagates NaN', () => {
    expect(scaledDistance([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(Number.isNaN(scaledDistance([1, NaN], [0, 0]))).toBe(true);
  });
});

describe('sumSquaredDeviations', () => {
  it('is near-exact on large-mean data where naive two-pass loses ~7 digits', () => {
    // x ~ 1e9 + U(0,1): the deviations are O(1) but sit on a 1e9 pedestal, so a mean computed
    // by naive accumulation (and an uncorrected two-pass) carries the error into every (x-mean).
    const n = 5000;
    const xs = new Float64Array(n);
    let s = 987654321;
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      xs[i] = 1e9 + s / 0x7fffffff;
    }
    // Exact reference: shift by an integer (variance is shift-invariant) so the deviations are
    // representable, then compute the textbook sum of squared deviations in that shifted frame.
    const shifted = Array.from(xs, (v) => v - 1e9);
    const meanShift = shifted.reduce((a, b) => a + b, 0) / n;
    let ref = 0;
    for (const v of shifted) ref += (v - meanShift) * (v - meanShift);

    const got = sumSquaredDeviations(xs);
    const relErr = Math.abs(got - ref) / ref;
    console.log(`[stable] SSD large-mean relErr = ${relErr.toExponential(2)}`);
    expect(relErr).toBeLessThan(1e-10); // corrected two-pass lands ~1e-16; naive was ~1e-7
  });

  it('matches the definition exactly on small integer inputs', () => {
    // variance([2,4,6,8]) uncorrected = 5 → SSD = 20
    expect(sumSquaredDeviations([2, 4, 6, 8])).toBeCloseTo(20, 12);
    // all-equal → 0
    expect(sumSquaredDeviations([7, 7, 7, 7])).toBe(0);
    expect(sumSquaredDeviations([])).toBe(0);
    expect(sumSquaredDeviations([42])).toBe(0);
  });

  it('propagates NaN and Infinity (the round-off clamp must not swallow them)', () => {
    // variance of data containing NaN is NaN (NumPy/mathjs semantics) — the clamp is `< 0`, not
    // `> 0 ? … : 0`, precisely so these do not collapse to 0.
    expect(Number.isNaN(sumSquaredDeviations([1, 2, NaN]))).toBe(true);
    expect(Number.isNaN(sumSquaredDeviations([1, 2, Infinity]))).toBe(true);
    expect(Number.isNaN(sumSquaredDeviations([Infinity, Infinity]))).toBe(true);
  });
});

describe('neumaierCumsum', () => {
  it('produces exact prefix sums where naive cumsum drifts (matches np.cumsum limit)', () => {
    const n = 1_000_000;
    const xs = new Array<number>(n).fill(0.1);
    const out = new Array<number>(n);
    neumaierCumsum(xs, out);
    // np.cumsum's last element carries relErr ~1.3e-11; Neumaier is exact.
    expect(out[n - 1]).toBe(100_000);
  });

  it('writes into a Float64Array target as well as a number[]', () => {
    const xs = new Float64Array([1, 2, 3, 4]);
    const out = new Float64Array(4);
    neumaierCumsum(xs, out);
    expect(Array.from(out)).toEqual([1, 3, 6, 10]);
  });

  it('handles empty and single-element inputs', () => {
    const empty: number[] = [];
    neumaierCumsum([], empty);
    expect(empty).toEqual([]);
    const one = new Array<number>(1);
    neumaierCumsum([5], one);
    expect(one).toEqual([5]);
  });
});
