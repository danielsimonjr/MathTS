/**
 * The studentized range distribution with an infinite number of groups. The range of infinitely
 * many standard normals is infinite, so the CDF is 0 at every finite q, and every quantile is
 * Infinity. Before the fix, the integrand was NaN, the CDF clamp hid the NaN, and the quantile
 * bisection collapsed to a value near 0.
 */
import { describe, it, expect } from 'vitest';
import { studentizedRangeCDF, studentizedRangeQuantile } from '../src/index.js';

describe('studentized range with k = Infinity', () => {
  it('the CDF is 0 at a finite q and 1 at q = Infinity', () => {
    expect(studentizedRangeCDF(2, Infinity, 10)).toBe(0);
    expect(studentizedRangeCDF(2, Infinity, Infinity)).toBe(0);
    expect(studentizedRangeCDF(Infinity, Infinity, 10)).toBe(1);
  });

  it('every quantile is Infinity', () => {
    expect(studentizedRangeQuantile(0.5, Infinity, 2)).toBe(Infinity);
    expect(studentizedRangeQuantile(0.95, Infinity, Infinity)).toBe(Infinity);
  });

  it('a finite k keeps its value (Tukey table q(0.95; 3, 10) = 3.877)', () => {
    expect(studentizedRangeQuantile(0.95, 3, 10)).toBeCloseTo(3.877, 2);
  });
});
