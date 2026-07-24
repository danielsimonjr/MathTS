import { describe, it, expect } from 'vitest';
import { dirichletSample, dirichletPdf, wishartSample } from '../src/index.js';

/**
 * Dirichlet + Wishart sampling and the Dirichlet density.
 *
 * Because the samplers are RANDOM, correctness is pinned by
 * implementation-independent statistical invariants + seeded determinism, NOT
 * by raw random draws (per feedback-oracle-tests-implementation-independent):
 *   - Dirichlet draws lie on the simplex; sample mean → αᵢ/Σα and sample
 *     covariance → the Dirichlet closed-form covariance.
 *   - Wishart draws are SPD; sample mean → df·scale and E[tr] → df·tr(scale).
 * `dirichletPdf` IS deterministic and is pinned tightly to
 * scipy.stats.dirichlet.pdf.
 */

function mean(cols: number[]): number {
  return cols.reduce((a, b) => a + b, 0) / cols.length;
}

describe('dirichletPdf vs scipy.stats.dirichlet.pdf (deterministic)', () => {
  it('matches scipy on fixed simplex points', () => {
    expect(dirichletPdf([0.2, 0.3, 0.5], [2, 3, 4])).toBeCloseTo(7.560000000000013, 9);
    expect(dirichletPdf([0.1, 0.1, 0.8], [1, 1, 1])).toBeCloseTo(2.0, 10);
    expect(dirichletPdf([0.25, 0.25, 0.25, 0.25], [5, 5, 5, 5])).toBeCloseTo(85.366955492645729, 7);
    expect(dirichletPdf([0.5, 0.3, 0.2], [0.5, 0.5, 0.5])).toBeCloseTo(0.918881492369654, 9);
  });
  it('rejects off-simplex or mismatched inputs', () => {
    expect(() => dirichletPdf([0.5, 0.6], [1, 1])).toThrow(/sum to 1/);
    expect(() => dirichletPdf([0.5, 0.5], [1, 1, 1])).toThrow(/must match/);
  });
});

describe('dirichletSample — simplex membership + moment convergence', () => {
  const alpha = [2, 3, 5];
  const a0 = 10;
  const N = 200000;
  const samples = dirichletSample(alpha, N, { seed: 'dirichlet-oracle' });

  it('every draw lies on the probability simplex', () => {
    for (let s = 0; s < 1000; s++) {
      const row = samples[s];
      let sum = 0;
      for (const v of row) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        sum += v;
      }
      expect(sum).toBeCloseTo(1, 12);
    }
  });

  it('sample mean → αᵢ/Σα', () => {
    const meanTheory = alpha.map((a) => a / a0); // [0.2, 0.3, 0.5]
    for (let i = 0; i < 3; i++) {
      const empirical = mean(samples.map((r) => r[i]));
      // SE(mean_i) = sqrt(Var_i/N) ≈ 3e-4; a few SE ⇒ tolerance 3e-3.
      expect(empirical).toBeCloseTo(meanTheory[i], 2);
    }
  });

  it('sample covariance → Dirichlet closed-form covariance', () => {
    // Cov_ij = -αᵢαⱼ / (α₀²(α₀+1)); Var_i = αᵢ(α₀-αᵢ)/(α₀²(α₀+1)).
    const denom = a0 * a0 * (a0 + 1);
    const covTheory = [
      [
        (alpha[0] * (a0 - alpha[0])) / denom,
        (-alpha[0] * alpha[1]) / denom,
        (-alpha[0] * alpha[2]) / denom,
      ],
      [
        (-alpha[1] * alpha[0]) / denom,
        (alpha[1] * (a0 - alpha[1])) / denom,
        (-alpha[1] * alpha[2]) / denom,
      ],
      [
        (-alpha[2] * alpha[0]) / denom,
        (-alpha[2] * alpha[1]) / denom,
        (alpha[2] * (a0 - alpha[2])) / denom,
      ],
    ];
    const mu = [0, 1, 2].map((i) => mean(samples.map((r) => r[i])));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let c = 0;
        for (const r of samples) c += (r[i] - mu[i]) * (r[j] - mu[j]);
        c /= N;
        expect(c).toBeCloseTo(covTheory[i][j], 2);
      }
    }
  });

  it('is reproducible under a fixed seed and differs across seeds', () => {
    const a = dirichletSample(alpha, 3, { seed: 1 });
    const b = dirichletSample(alpha, 3, { seed: 1 });
    const c = dirichletSample(alpha, 3, { seed: 2 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe('wishartSample — SPD + moment convergence', () => {
  const df = 6;
  const scale = [
    [2, 0.5],
    [0.5, 1],
  ];
  const N = 200000;
  const samples = wishartSample(df, scale, N, { seed: 'wishart-oracle' });

  it('every draw is symmetric positive-definite', () => {
    for (let s = 0; s < 1000; s++) {
      const W = samples[s];
      expect(W[0][1]).toBeCloseTo(W[1][0], 12); // symmetric
      // 2×2 SPD ⇔ leading principal minors > 0.
      expect(W[0][0]).toBeGreaterThan(0);
      expect(W[0][0] * W[1][1] - W[0][1] * W[1][0]).toBeGreaterThan(0);
    }
  });

  it('sample mean → df·scale', () => {
    const meanTheory = [
      [df * scale[0][0], df * scale[0][1]],
      [df * scale[1][0], df * scale[1][1]],
    ]; // [[12,3],[3,6]]
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const empirical = mean(samples.map((W) => W[i][j]));
        // SE(W_00) = sqrt(2·df·V_00²/N) ≈ 0.016; a few SE ⇒ tolerance ~0.15.
        expect(empirical).toBeCloseTo(meanTheory[i][j], 1);
      }
    }
  });

  it('E[tr(W)] → df·tr(scale)', () => {
    const trTheory = df * (scale[0][0] + scale[1][1]); // 18
    const trEmpirical = mean(samples.map((W) => W[0][0] + W[1][1]));
    expect(trEmpirical).toBeCloseTo(trTheory, 1);
  });

  it('reproducible under a fixed seed', () => {
    expect(wishartSample(df, scale, 2, { seed: 9 })).toEqual(
      wishartSample(df, scale, 2, { seed: 9 })
    );
  });

  it('rejects df ≤ p−1', () => {
    expect(() => wishartSample(1, scale)).toThrow(/df must be greater/);
  });
});
