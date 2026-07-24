import { describe, it, expect } from 'vitest';
import { multipleComparison, multipleTest } from '../src/index.js';

/**
 * `multipleComparison` (`typed/hypothesis.ts`) and `multipleTest`
 * (`stats/inference-extra.ts`) were two independent implementations of the
 * identical Bonferroni/Holm/Benjamini-Hochberg p-value correction. They now
 * share one algorithm (`multipleComparison` delegates to `multipleTest`); this
 * test locks that the two public names stay in lockstep and pins a known
 * statsmodels-style result.
 */
describe('multipleComparison / multipleTest consolidation', () => {
  const methods = ['bonferroni', 'holm', 'bh'] as const;

  const vectors: number[][] = [
    [0.01, 0.02, 0.03, 0.04, 0.05],
    [0.001, 0.008, 0.039, 0.041, 0.9],
    [0.5, 0.02, 0.9, 0.001, 0.3, 0.049],
    [0.2],
    [0.01, 0.01, 0.01, 0.01],
    [0.9999, 0.5, 0.0001, 0.25, 0.75, 0.1, 0.6],
  ];

  it('multipleComparison(p, m) deep-equals multipleTest(p, m) for every method/vector', () => {
    for (const p of vectors) {
      for (const method of methods) {
        const a = multipleComparison([...p], method);
        const b = multipleTest([...p], method);
        expect(a).toEqual(b);
      }
    }
  });

  it('BH on [0.01,0.02,0.03,0.04,0.05] matches the known statsmodels result (all ties at 0.05)', () => {
    // p_(i)/i is constant (0.01) for every rank i=1..5, so BH's q_(i) = p_(i)*n/i
    // is uniformly n*0.01 = 0.05 across all five entries — a known closed-form
    // multipletests(method='fdr_bh') result, not implementation-dependent.
    const p = [0.01, 0.02, 0.03, 0.04, 0.05];
    const expected = [0.05, 0.05, 0.05, 0.05, 0.05];
    const bhComparison = multipleComparison(p, 'bh');
    const bhTest = multipleTest(p, 'bh');
    for (let i = 0; i < p.length; i++) {
      expect(bhComparison[i]).toBeCloseTo(expected[i], 9);
      expect(bhTest[i]).toBeCloseTo(expected[i], 9);
    }
  });

  it('adjusted p-values stay in [0,1] and are monotonic non-decreasing in sorted-p order (holm/bh)', () => {
    for (const p of vectors) {
      for (const method of methods) {
        const adj = multipleComparison([...p], method);
        for (const v of adj) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        if (method === 'holm' || method === 'bh') {
          const order = p.map((_, i) => i).sort((i, j) => p[i] - p[j]);
          for (let rank = 1; rank < order.length; rank++) {
            expect(adj[order[rank]]).toBeGreaterThanOrEqual(adj[order[rank - 1]] - 1e-9);
          }
        }
      }
    }
  });
});
