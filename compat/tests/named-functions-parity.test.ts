import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { combinations, derivative, erf, log2, median } from '../src/index.js';

describe('named compatibility function imports', () => {
  it('matches the upstream results across mathematical categories', () => {
    expect(combinations(12, 3)).toBe(oracle.combinations(12, 3));
    expect(log2(16)).toBe(oracle.log2(16));
    expect(median([1, 9, 5])).toBe(oracle.median([1, 9, 5]));
    expect(erf(0.5)).toBeCloseTo(oracle.erf(0.5), 14);
    expect(String(derivative('x^2', 'x'))).toBe(oracle.derivative('x^2', 'x').toString());
  });
});
