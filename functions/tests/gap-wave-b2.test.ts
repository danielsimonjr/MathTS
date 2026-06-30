import { describe, it, expect } from 'vitest';
import {
  rankdata,
  kruskalWallis,
  wilcoxon,
  fisherExact,
} from '@danielsimonjr/mathts-functions';

/**
 * Wave B (part 2) — rank-based + exact tests. Reference values from scipy.stats
 * (rankdata, kruskal, wilcoxon[mode='approx', correction=True], fisher_exact),
 * pinned so CI needs no Python. `rankdata` (a P2 stats gap) is reused by both
 * rank tests; `fisherExact` reuses `lgamma` for a stable hypergeometric.
 */
describe('gap Wave B — rank-based + exact tests (vs SciPy)', () => {
  it('rankdata — average ranks with ties', () => {
    expect(rankdata([7, 1, 2, 2, 5])).toEqual([5, 1, 2.5, 2.5, 4]);
    expect(rankdata([3, 1, 4, 1, 5, 9, 2, 6])).toEqual([4, 1.5, 5, 1.5, 6, 8, 3, 7]);
  });

  it('kruskalWallis — matches scipy.stats.kruskal (with tie correction)', () => {
    const r = kruskalWallis([2.9, 3.0, 2.5, 3.2, 3.8], [3.8, 2.7, 4.0, 2.4], [2.8, 3.4, 3.7, 2.2, 2.0]);
    expect(r.statistic).toBeCloseTo(1.037279735682816, 9);
    expect(r.pValue).toBeCloseTo(0.5953297246553027, 9);
    expect(r.df).toBe(2);
  });

  it('wilcoxon — matches scipy.stats.wilcoxon(mode=approx, correction=True)', () => {
    const x = [1.83, 0.5, 1.62, 2.48, 1.68, 1.88, 1.55, 3.06, 1.3];
    const y = [0.878, 0.647, 0.598, 2.05, 1.06, 1.29, 1.06, 3.14, 1.29];
    const r = wilcoxon(x, y);
    expect(r.statistic).toBeCloseTo(5.0, 9);
    expect(r.pValue).toBeCloseTo(0.04401098401295143, 7);
  });

  it('fisherExact — two-sided p-value matches scipy.stats.fisher_exact', () => {
    const r = fisherExact([
      [8, 2],
      [1, 5],
    ]);
    expect(r.pValue).toBeCloseTo(0.034965034965034975, 9);
    expect(r.oddsRatio).toBeCloseTo((8 * 5) / (2 * 1), 9); // sample odds ratio
  });

  it('fisherExact — independence gives p ≈ 1', () => {
    const r = fisherExact([
      [10, 10],
      [10, 10],
    ]);
    expect(r.pValue).toBeGreaterThan(0.99);
  });
});
