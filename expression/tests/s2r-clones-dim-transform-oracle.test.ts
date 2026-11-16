/**
 * Sprint 2R clone-merge (cumsum / mapSlices dim shift) — expression transforms
 * vs direct zero-based function calls.
 */
import { describe, it, expect } from 'vitest';
import { evaluate } from '../../functions/src/factories/evaluate.js';
import { cumsum, mapSlices, factory_sum as sum } from '../../functions/src/factories/index.js';
import { factoryScope } from '../../functions/src/factories/scope.js';
import { IndexError } from '../src/error/IndexError.js';
import { dimToZeroBase } from '../src/transform/utils/dimToZeroBase.js';

const A = [
  [1, 2],
  [3, 4],
];

const val = (r: unknown): unknown => {
  const m = r as { toArray?: () => unknown };
  if (m && typeof m.toArray === 'function') return m.toArray();
  return r;
};

const bignumber = factoryScope.bignumber as (n: number) => { sub(n: number): unknown };

describe('cumsum transform dim oracle', () => {
  it('1D cumsum matches direct cumsum', () => {
    expect(val(evaluate('cumsum([1, 2, 3])'))).toEqual([1, 3, 6]);
    expect(val(evaluate('cumsum([1, 2, 3])'))).toEqual(val(cumsum([1, 2, 3])));
  });

  it('2D dim 1 matches direct dim 0 (the rows are summed, as in mathjs)', () => {
    expect(val(evaluate('cumsum([[1, 2], [3, 4]], 1)'))).toEqual([
      [1, 2],
      [4, 6],
    ]);
    expect(val(evaluate('cumsum([[1, 2], [3, 4]], 1)'))).toEqual(val(cumsum(A, 0)));
  });

  it('2D dim 2 matches direct dim 1', () => {
    expect(val(evaluate('cumsum([[1, 2], [3, 4]], 2)'))).toEqual([
      [1, 3],
      [3, 7],
    ]);
    expect(val(evaluate('cumsum([[1, 2], [3, 4]], 2)'))).toEqual(val(cumsum(A, 1)));
  });

  it('non-collection first argument does not shift the second argument', () => {
    expect(val(evaluate('cumsum(5, 1)'))).toEqual(val(cumsum(5, 1)));
    expect(val(evaluate('cumsum(1, 2, 3)'))).toEqual([1, 3, 6]);
  });

  it('BigNumber dim 2 matches direct BigNumber dim 1', () => {
    expect(val(evaluate('cumsum([[1, 2], [3, 4]], bignumber(2))'))).toEqual([
      [1, 3],
      [3, 7],
    ]);
    expect(val(evaluate('cumsum([[1, 2], [3, 4]], bignumber(2))'))).toEqual(
      val(cumsum(A, bignumber(1)))
    );
  });

  it('out-of-range dimension uses errorTransform (one-based IndexError on std)', () => {
    expect(() => evaluate('std([1, 2, 3], 9)')).toThrow(IndexError);
    try {
      evaluate('std([1, 2, 3], 9)');
    } catch (err) {
      expect((err as IndexError).index).toBe(9);
    }
  });

  it('out-of-range cumsum dim throws a one-based IndexError (#1047)', () => {
    expect(() => evaluate('cumsum([[1, 2], [3, 4]], 9)')).toThrow(IndexError);
    expect(() => evaluate('cumsum([[1, 2], [3, 4]], 9)')).toThrow('Index out of range (9 > 2)');
  });

  it('zero and negative cumsum dims throw a one-based IndexError (#1047)', () => {
    expect(() => evaluate('cumsum([[1, 2], [3, 4]], 0)')).toThrow('Index out of range (0 < 1)');
    expect(() => evaluate('cumsum([[1, 2], [3, 4]], -1)')).toThrow('Index out of range (-1 < 1)');
  });

  it('a cumsum dim that is not an integer throws a TypeError (#1047)', () => {
    expect(() => evaluate('cumsum([[1, 2], [3, 4]], 1.5)')).toThrow(
      'Integer number expected for dimension'
    );
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

  it('BigNumber dim 1 matches direct dim 0; dim 2 matches direct dim 1', () => {
    expect(val(evaluate('mapSlices([[1, 2], [3, 4]], bignumber(1), sum)'))).toEqual([4, 6]);
    expect(val(evaluate('mapSlices([[1, 2], [3, 4]], bignumber(2), sum)'))).toEqual([3, 7]);
    expect(val(evaluate('mapSlices([[1, 2], [3, 4]], bignumber(1), sum)'))).toEqual(
      val(mapSlices(A, 0, sum))
    );
  });

  it('out-of-range dimension reports the user one-based index via errorTransform', () => {
    expect(() => evaluate('mapSlices([[1, 2], [3, 4]], 9, sum)')).toThrow(IndexError);
    try {
      evaluate('mapSlices([[1, 2], [3, 4]], 9, sum)');
    } catch (err) {
      expect((err as IndexError).index).toBe(9);
      expect((err as IndexError).message).toBe('Index out of range (9 > 2)');
    }
  });

  it('zero and negative dims throw IndexError after the 1-based shift', () => {
    expect(() => evaluate('mapSlices([[1, 2], [3, 4]], 0, sum)')).toThrow(IndexError);
    try {
      evaluate('mapSlices([[1, 2], [3, 4]], 0, sum)');
    } catch (err) {
      expect((err as IndexError).index).toBe(0);
      expect((err as IndexError).message).toBe('Index out of range (0 < 1)');
    }
    expect(() => evaluate('mapSlices([[1, 2], [3, 4]], -1, sum)')).toThrow(IndexError);
  });

  it('non-numeric dim is left unchanged and surfaces the direct error', () => {
    const scope = new Map<string, unknown>([['badDim', 'nope']]);
    expect(() => evaluate('mapSlices([[1, 2], [3, 4]], badDim, sum)', scope)).toThrow();
    expect(() => mapSlices(A, 'nope' as unknown as number, sum)).toThrow();
  });
});

describe('dimToZeroBase BigNumber shift', () => {
  it('shifts a MathTS BigNumber with .sub, not decimal.js .minus', () => {
    const shifted = dimToZeroBase(bignumber(1)) as { isBigNumber?: boolean };
    expect(Number(shifted)).toBe(0);
    expect(shifted.isBigNumber).toBe(true);
  });
});
