/**
 * The last guard of `matrixLogm`: a finite input never gets a non-finite logarithm back. No
 * input is known that reaches it (the block-balance overflow of #1171 is fixed at the root),
 * so the guard itself is pinned here.
 */

import { describe, it, expect } from 'vitest';
import { assertFiniteLogm } from '../src/operations/logm.js';

describe('assertFiniteLogm', () => {
  it('throws for a non-finite result of a finite input', () => {
    expect(() => assertFiniteLogm(new Float64Array([0, NaN]), new Float64Array([1, 2]))).toThrow(
      /not finite for a finite matrix/
    );
    expect(() =>
      assertFiniteLogm(new Float64Array([Infinity, 0]), new Float64Array([1, 2]))
    ).toThrow(/not finite for a finite matrix/);
  });

  it('passes a finite result, and a non-finite result of a non-finite input', () => {
    expect(() =>
      assertFiniteLogm(new Float64Array([0, 1]), new Float64Array([1, 2]))
    ).not.toThrow();
    expect(() =>
      assertFiniteLogm(new Float64Array([NaN, NaN]), new Float64Array([NaN, 2]))
    ).not.toThrow();
  });
});
