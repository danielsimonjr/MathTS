/**
 * Sprint 2R clone-merge (cumsum / mapSlices dim shift) — expression transforms
 * vs direct zero-based function calls.
 */
import { describe, it, expect } from 'vitest';
import { evaluate } from '../../functions/src/factories/evaluate.js';
import { cumsum, mapSlices, factory_sum as sum } from '../../functions/src/factories/index.js';
import { IndexError } from '../src/error/IndexError.js';

const A = [
  [1, 2],
  [3, 4],
];

const val = (r: unknown): unknown => {
  const m = r as { toArray?: () => unknown };
  if (m && typeof m.toArray === 'function') return m.toArray();
  return r;
};

describe('cumsum transform dim oracle', () => {
  it('1D cumsum matches direct cumsum', () => {
    expect(val(evaluate('cumsum([1, 2, 3])'))).toEqual(val(cumsum([1, 2, 3])));
  });

  it('non-collection first argument does not shift the second argument', () => {
    expect(val(evaluate('cumsum(5, 1)'))).toEqual(val(cumsum(5, 1)));
    expect(val(evaluate('cumsum(1, 2, 3)'))).toEqual(val(cumsum(1, 2, 3)));
  });

  it('out-of-range dimension uses errorTransform (one-based IndexError on std)', () => {
    expect(() => evaluate('std([1, 2, 3], 9)')).toThrow(IndexError);
    try {
      evaluate('std([1, 2, 3], 9)');
    } catch (err) {
      expect((err as IndexError).index).toBe(9);
    }
  });
});

describe('mapSlices transform dim oracle', () => {
  it('dim 1 matches direct dim 0 with sum', () => {
    expect(val(evaluate('mapSlices([[1, 2], [3, 4]], 1, sum)'))).toEqual(val(mapSlices(A, 0, sum)));
    expect(val(evaluate('mapSlices([[1, 2], [3, 4]], 1, sum)'))).toEqual([4, 6]);
  });

  it('dim 2 matches direct dim 1 with sum', () => {
    expect(val(evaluate('mapSlices([[1, 2], [3, 4]], 2, sum)'))).toEqual(val(mapSlices(A, 1, sum)));
    expect(val(evaluate('mapSlices([[1, 2], [3, 4]], 2, sum)'))).toEqual([3, 7]);
  });

  it('dim 2 with prod matches embedded docs oracle', () => {
    expect(val(evaluate('mapSlices([[1, 2], [3, 4]], 2, prod)'))).toEqual([2, 12]);
  });

  it('three-argument form still shifts args[1] (dim), not lastDimToZeroBase', () => {
    expect(val(evaluate('mapSlices([[1, 2], [3, 4]], 2, sum)'))).toEqual([3, 7]);
  });

  it('non-numeric dim is left unchanged and surfaces the direct error', () => {
    const scope = new Map<string, unknown>([['badDim', 'nope']]);
    expect(() => evaluate('mapSlices([[1, 2], [3, 4]], badDim, sum)', scope)).toThrow();
    expect(() => mapSlices(A, 'nope' as unknown as number, sum)).toThrow();
  });
});
