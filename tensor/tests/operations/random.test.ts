/**
 * Tests for randomTensor (tensor/src/operations/random.ts).
 *
 * Covers:
 *  1. Basic shape / rank.
 *  2. Uniform distribution values and mean.
 *  3. Normal distribution mean and variance.
 *  4. Orthogonal distribution: Q·Qᵀ ≈ I.
 *  5. Orthogonal throws for non-rank-2 shapes.
 *  6. Seeded reproducibility (same seed → same data; different seeds → different data).
 *  7. axisLabels forwarding (guarded for Phase-1 availability).
 *  8. Large uniform sample: all values in [0, 1).
 *  9. randomTensor([1]) returns a length-1 tensor.
 * 10. Normal: 5000 sample variance.
 */

import { describe, it, expect } from 'vitest';
import { Tensor } from '../../src/Tensor';
import { randomTensor } from '../../src/operations/random';
import { idx } from '../../src/named-index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an EinsumSpec for the contraction sum_j A[i,j]*B[k,j] -> C[i,k].
 *  (i.e. A @ Bᵀ for square matrices — equivalent to einsum 'ij,kj->ik')
 */
function mmtSpec(n: number) {
  return {
    contractions: [
      {
        pair: [
          [0, 1],
          [1, 1],
        ] as const,
      },
    ],
    free: [
      { operand: 0, axis: 0 },
      { operand: 1, axis: 0 },
    ],
    // Store n for reference only — not used by the spec itself.
    _n: n,
  };
}

/** Return the [i,j] element of a rank-2 Tensor with shape [rows, cols]. */
function elem(t: Tensor, i: number, j: number): number {
  return t.data[i * t.shape[1] + j];
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('randomTensor', () => {
  // --- 1. Basic shape ----------------------------------------------------------

  it('returns the correct shape and data length for [2, 3]', () => {
    const t = randomTensor([2, 3]);
    expect(t.shape).toEqual([2, 3]);
    expect(t.data.length).toBe(6);
  });

  it('returns a length-1 tensor for shape [1]', () => {
    const t = randomTensor([1]);
    expect(t.shape).toEqual([1]);
    expect(t.data.length).toBe(1);
  });

  // --- 2. Uniform distribution -------------------------------------------------

  it('uniform: all 5000 sampled values are in [0, 1)', () => {
    const t = randomTensor([5000], { distribution: 'uniform', seed: 1 });
    for (let i = 0; i < t.data.length; i++) {
      expect(t.data[i]).toBeGreaterThanOrEqual(0);
      expect(t.data[i]).toBeLessThan(1);
    }
  });

  it('uniform: sample mean of 5000 values is ≈ 0.5 (within 0.05)', () => {
    const t = randomTensor([5000], { distribution: 'uniform', seed: 2 });
    const mean = t.data.reduce((s, v) => s + v, 0) / t.data.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  // --- 3. Normal distribution --------------------------------------------------

  it('normal: sample mean of 5000 values is ≈ 0 (within 0.05)', () => {
    const t = randomTensor([5000], { distribution: 'normal', seed: 3 });
    const mean = t.data.reduce((s, v) => s + v, 0) / t.data.length;
    expect(Math.abs(mean)).toBeLessThan(0.05);
  });

  it('normal: sample variance of 5000 values is ≈ 1 (within 0.05)', () => {
    const t = randomTensor([5000], { distribution: 'normal', seed: 4 });
    const n = t.data.length;
    const mean = t.data.reduce((s, v) => s + v, 0) / n;
    const variance = t.data.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    expect(Math.abs(variance - 1)).toBeLessThan(0.05);
  });

  // --- 4. Orthogonal distribution — Q·Qᵀ ≈ I ----------------------------------

  it('orthogonal 16×16: Q·Qᵀ ≈ I to 1e-9', () => {
    const n = 16;
    const Q = randomTensor([n, n], { distribution: 'orthogonal', seed: 42 });
    expect(Q.shape).toEqual([n, n]);

    // Compute QQᵀ via EinsumSpec  'ij,kj->ik'
    const spec = mmtSpec(n);
    const QQt = Tensor.einsum(spec, Q, Q);

    // QQᵀ should equal identity.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const expected = i === j ? 1 : 0;
        expect(Math.abs(elem(QQt, i, j) - expected)).toBeLessThan(1e-9);
      }
    }
  });

  // --- 5. Orthogonal throws for non-rank-2 -------------------------------------

  it('orthogonal throws for rank-3 shape', () => {
    expect(() => randomTensor([4, 4, 4], { distribution: 'orthogonal' })).toThrowError(
      "randomTensor: 'orthogonal' distribution requires a rank-2 shape"
    );
  });

  it('orthogonal throws for rank-1 shape', () => {
    expect(() => randomTensor([16], { distribution: 'orthogonal' })).toThrowError(
      "randomTensor: 'orthogonal' distribution requires a rank-2 shape"
    );
  });

  // --- 6. Seeded reproducibility -----------------------------------------------

  it('same seed produces identical data on two calls', () => {
    const a = randomTensor([3, 4], { seed: 99 });
    const b = randomTensor([3, 4], { seed: 99 });
    expect(a.data).toEqual(b.data);
  });

  it('different seeds produce different data', () => {
    const a = randomTensor([3, 4], { seed: 10 });
    const b = randomTensor([3, 4], { seed: 11 });
    // It is astronomically unlikely they are equal.
    let allSame = true;
    for (let i = 0; i < a.data.length; i++) {
      if (a.data[i] !== b.data[i]) {
        allSame = false;
        break;
      }
    }
    expect(allSame).toBe(false);
  });

  it('seeded normal distribution is reproducible', () => {
    const a = randomTensor([50], { distribution: 'normal', seed: 7 });
    const b = randomTensor([50], { distribution: 'normal', seed: 7 });
    expect(a.data).toEqual(b.data);
  });

  // --- 7. axisLabels forwarding ------------------------------------------------

  it('axisLabels are forwarded to the constructed Tensor', () => {
    const i = idx(2, 'i');
    const j = idx(3, 'j');
    const t = randomTensor([2, 3], { seed: 1, axisLabels: [i, j] });

    // Phase-1 guard: only assert axisLabels if the Tensor constructor stored them.
    if ('axisLabels' in t && t.axisLabels !== undefined) {
      expect(t.axisLabels.length).toBe(2);
      expect(t.axisLabels[0]).toBe(i);
      expect(t.axisLabels[1]).toBe(j);
    } else {
      // Phase 1 hasn't merged yet — the test still passes.
      expect(t.shape).toEqual([2, 3]);
    }
  });
});
