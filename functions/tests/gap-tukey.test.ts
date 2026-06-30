import { describe, it, expect } from 'vitest';
import {
  studentizedRangeCDF,
  studentizedRangeQuantile,
  tukeyHSD,
} from '@danielsimonjr/mathts-functions';

/**
 * Studentized-range distribution + Tukey's HSD post-hoc test (gap analysis, the item
 * that had been blocked on the studentized-range distribution). The CDF integrates the
 * range probability against the χ-scaled denominator density (synchronous Simpson);
 * verified against scipy.stats.studentized_range and scipy.stats.tukey_hsd.
 */
describe('gap — studentized range distribution', () => {
  it('CDF / quantile match scipy.stats.studentized_range', () => {
    expect(studentizedRangeCDF(3.5, 4, 20)).toBeCloseTo(0.9050415494536981, 4);
    expect(studentizedRangeQuantile(0.95, 4, 20)).toBeCloseTo(3.9582935609453833, 3);
  });
  it('quantile inverts the CDF', () => {
    const q = studentizedRangeQuantile(0.9, 3, 15);
    expect(studentizedRangeCDF(q, 3, 15)).toBeCloseTo(0.9, 4);
  });
});

describe("gap — Tukey's HSD (vs scipy.stats.tukey_hsd)", () => {
  it('pairwise p-values match scipy', () => {
    const r = tukeyHSD([
      [24, 26, 21, 28, 25],
      [30, 29, 33, 31, 32],
      [22, 25, 20, 23, 24],
    ]);
    expect(r).toHaveLength(3); // 3 choose 2
    expect(r[0].groups).toEqual([0, 1]);
    expect(r[0].pValue).toBeCloseTo(0.0013162438549736422, 4);
    expect(r[1].pValue).toBeCloseTo(0.31437432096501317, 3);
    expect(r[2].pValue).toBeCloseTo(0.00011624709701962832, 4);
    // groups 0 vs 1 and 1 vs 2 differ significantly; 0 vs 2 does not
    expect(r[0].reject).toBe(true);
    expect(r[1].reject).toBe(false);
    expect(r[2].reject).toBe(true);
  });
});
