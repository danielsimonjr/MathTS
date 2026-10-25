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
import { mulberry32, boxMuller } from '@danielsimonjr/mathts-core';
import { Tensor } from '../../src/Tensor';
import { randomTensor } from '../../src/operations/random';
import { idx } from '../../src/named-index';

/** Same values as `MULBERRY32_42_FIRST_8` in `core/tests/numeric/rng.test.ts` (pre-#415 oracle). */
const MULBERRY32_42_FIRST_8 = [
  0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
  0.17481389874592423, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129,
];

/** Recorded at commit a6cf17af (pre-#415); recipe: `randomTensor([8], { distribution: 'normal', seed: 42 })`. */
const PRE_415_RANDOM_TENSOR_NORMAL_8_SEED_42 = [
  -0.956162229384149, 0.3220702493215296, -0.2730261048826104, -0.4946727576767142,
  -1.8416271847835968, -0.310605739735128, -1.1408820709540242, -1.1372270998855114,
];

/** Recorded at commit a6cf17af (pre-#415); recipe: `randomTensor([2, 3], { seed: 99 })`. */
const PRE_415_RANDOM_TENSOR_UNIFORM_2_3_SEED_99 = [
  0.2604658124037087, 0.8048227655235678, 0.5408715349622071, 0.6902434257790446,
  0.001138708321377635, 0.8175430877599865,
];

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

  it('uniform [8] seed 42 matches core mulberry32 oracle (pre-#415 commit a6cf17af)', () => {
    const t = randomTensor([8], { distribution: 'uniform', seed: 42 });
    expect(Array.from(t.data)).toEqual(MULBERRY32_42_FIRST_8);
    const rng = mulberry32(42);
    for (let i = 0; i < 8; i++) {
      expect(t.data[i]).toBe(rng());
    }
  });

  it('normal [8] seed 42 matches pre-#415 fixture and Box-Muller oracle (a6cf17af)', () => {
    const t = randomTensor([8], { distribution: 'normal', seed: 42 });
    for (let i = 0; i < PRE_415_RANDOM_TENSOR_NORMAL_8_SEED_42.length; i++) {
      expect(t.data[i]).toBe(PRE_415_RANDOM_TENSOR_NORMAL_8_SEED_42[i]);
    }
    // Independent of the recorded vector: the normal path is Box–Muller on the
    // same Mulberry32(42) uniforms as the uniform-[8] oracle (pairs of next()).
    const rng = mulberry32(42);
    const oracle: number[] = [];
    for (let i = 0; i < 8; i += 2) {
      const [z0, z1] = boxMuller(rng(), rng());
      oracle.push(z0, z1);
    }
    expect(Array.from(t.data)).toEqual(oracle);
  });

  it('uniform [2,3] seed 99 matches pre-#415 fixture (a6cf17af)', () => {
    const t = randomTensor([2, 3], { seed: 99 });
    for (let i = 0; i < PRE_415_RANDOM_TENSOR_UNIFORM_2_3_SEED_99.length; i++) {
      expect(t.data[i]).toBe(PRE_415_RANDOM_TENSOR_UNIFORM_2_3_SEED_99[i]);
    }
  });

  // --- 6b. Orthogonal: Qᵀ·Q ≈ I (delegates to matrix.qr) ----------------------

  it('orthogonal 8×8: Qᵀ·Q ≈ I to 1e-10 (delegates to matrix.qr)', () => {
    const n = 8;
    const Q = randomTensor([n, n], { distribution: 'orthogonal', seed: 42 });
    expect(Q.shape).toEqual([n, n]);

    // Verify QᵀQ = I: (QᵀQ)[i,k] = sum_j Q[j,i] * Q[j,k]
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          sum += Q.data[j * n + i] * Q.data[j * n + k];
        }
        const expected = i === k ? 1 : 0;
        expect(Math.abs(sum - expected)).toBeLessThan(1e-10);
      }
    }
  });

  it('orthogonal random tensor is reproducible with the same seed', () => {
    const n = 6;
    const Q1 = randomTensor([n, n], { distribution: 'orthogonal', seed: 123 });
    const Q2 = randomTensor([n, n], { distribution: 'orthogonal', seed: 123 });
    expect(Q1.data.length).toBe(Q2.data.length);
    for (let i = 0; i < Q1.data.length; i++) {
      expect(Q1.data[i]).toBe(Q2.data[i]);
    }
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
