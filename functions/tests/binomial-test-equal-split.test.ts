import { describe, it, expect } from 'vitest';
import { binomialTest } from '../src/index.js';

// scipy.stats.binomtest reference values (scipy 1.x, two-sided).
describe('binomialTest p-value mass (issue #625)', () => {
  it('an equal split includes every outcome, so p is exactly 1', () => {
    expect(binomialTest(500, 1000).pValue).toBe(1);
    expect(binomialTest(37, 74).pValue).toBe(1);
    expect(binomialTest(5000, 10000).pValue).toBe(1);
  });

  it('the mode under p != 0.5 includes every outcome, so p is exactly 1', () => {
    expect(binomialTest(30, 100, 0.3).pValue).toBe(1);
  });

  it('control: an asymmetric count keeps the scipy value', () => {
    const p = binomialTest(450, 1000).pValue;
    expect(Math.abs(p - 0.0017305360849763027)).toBeLessThan(1e-12);
    expect(Math.abs(binomialTest(8, 20, 0.5).pValue - 0.5034446716)).toBeLessThan(1e-9);
  });
});
