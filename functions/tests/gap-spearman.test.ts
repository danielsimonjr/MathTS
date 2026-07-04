import { describe, it, expect } from 'vitest';
import { spearman } from '@danielsimonjr/mathts-functions';

/**
 * Spearman rank correlation — new function (the one genuine gap in the statistics
 * domain). Oracles are closed-form: ρ = 1 for any monotonically-increasing pair
 * (including non-linear ones — its whole point), −1 for reversed, and for the
 * no-tie case ρ = 1 − 6Σd²/(n(n²−1)).
 */
describe('spearman — rank correlation', () => {
  it('ρ = 1 for a monotonic LINEAR relationship', () => {
    expect(spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(1, 12);
  });

  it('ρ = 1 for a monotonic NON-LINEAR relationship (Pearson would be < 1)', () => {
    // y = x² on positives is monotonic → Spearman sees perfect rank agreement.
    expect(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 25])).toBeCloseTo(1, 12);
  });

  it('ρ = −1 for a reversed relationship', () => {
    expect(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1, 12);
  });

  it('ρ = 0.8 for a known no-tie case (1 − 6·4/(5·24))', () => {
    // d = [−1, 1, −1, 1, 0], Σd² = 4 → ρ = 1 − 24/120 = 0.8.
    expect(spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeCloseTo(0.8, 12);
  });

  it('handles ties via average ranks', () => {
    // constant y → undefined correlation, throws
    expect(() => spearman([1, 2, 3], [7, 7, 7])).toThrow(/constant/);
  });
});
