import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { all, combinations, create, derivative, erf, log2, median, norm } from '../src/index.js';

describe('named compatibility function imports', () => {
  it('matches the upstream results across mathematical categories', () => {
    expect(combinations(12, 3)).toBe(oracle.combinations(12, 3));
    expect(log2(16)).toBe(oracle.log2(16));
    expect(median([1, 9, 5])).toBe(oracle.median([1, 9, 5]));
    expect(erf(0.5)).toBeCloseTo(oracle.erf(0.5), 14);
    expect(String(derivative('x^2', 'x'))).toBe(oracle.derivative('x^2', 'x').toString());
  });

  it('accepts string infinity norms for vectors and matrices', () => {
    const vector = [-5, 2, 3];
    for (const p of ['inf', '-inf']) {
      expect(norm(vector, p)).toBe(oracle.norm(vector, p));
    }

    const math = create(all);
    const data = [
      [1, 2],
      [3, 4],
    ];
    const expected = oracle.norm(data, 'inf');
    expect(norm(data, 'inf')).toBe(expected);
    expect(math.norm(math.matrix(data), 'inf')).toBe(expected);
    expect(math.norm(math.sparse(data), 'inf')).toBe(expected);
    expect(math.evaluate('norm([[1, 2], [3, 4]], "inf")')).toBe(expected);
  });
});
