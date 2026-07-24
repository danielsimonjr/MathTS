import { describe, it, expect } from 'vitest';
import { chi2Contingency, multipleTest } from '../src/index.js';

describe('chi2Contingency + multipleTest', () => {
  it('chi2 test of independence matches scipy (no correction)', () => {
    const r = chi2Contingency(
      [
        [10, 20],
        [30, 40],
      ],
      { correction: false }
    );
    expect(r.dof).toBe(1);
    expect(r.chi2).toBeCloseTo(0.7937, 3);
    expect(r.pValue).toBeCloseTo(0.373, 2);
    expect(r.expected[0][0]).toBeCloseTo(12, 6);
  });
  it('bonferroni multiplies by n, capped at 1', () => {
    const adj = multipleTest([0.01, 0.04, 0.5], 'bonferroni');
    expect(adj[0]).toBeCloseTo(0.03, 8);
    expect(adj[2]).toBeCloseTo(1, 8);
  });
  it('BH adjusted p-values are in [0,1] and preserve order mapping', () => {
    const adj = multipleTest([0.001, 0.008, 0.039, 0.041, 0.9], 'bh');
    expect(adj.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(adj).toHaveLength(5);
  });
  it('holm is at least as conservative as BH (elementwise) on the same input', () => {
    const p = [0.001, 0.008, 0.039, 0.041, 0.9];
    const holm = multipleTest(p, 'holm');
    const bh = multipleTest(p, 'bh');
    holm.forEach((h, i) => expect(h).toBeGreaterThanOrEqual(bh[i] - 1e-9));
  });
});
