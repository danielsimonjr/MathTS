/**
 * P7-12 pins: infer number datatype for Array,Array / Array,scalar only.
 */
import { describe, it, expect } from 'vitest';
import {
  bignumber,
  dotDivide,
  dotMultiply,
  getMatrixDataType,
  matrix,
} from '../src/factories/index.js';

function attachedDatatype(x: unknown): string | undefined {
  if (x && typeof x === 'object' && '_datatype' in x) {
    return (x as { _datatype?: string })._datatype;
  }
  return undefined;
}

describe('P7-12 Array,Array number inference', () => {
  it('dotMultiply is bit-exact on number arrays', () => {
    const a = [2, -0, 3, NaN];
    const b = [4, 0, 5, 1];
    const out = dotMultiply(a, b) as number[];
    expect(out[0]).toBe(8);
    expect(Object.is(out[1], -0) || Object.is(out[1], 0)).toBe(true);
    expect(out[2]).toBe(15);
    expect(Number.isNaN(out[3])).toBe(true);
    expect(Array.isArray(out)).toBe(true);
    expect(attachedDatatype(out)).toBeUndefined();
  });

  it('dotDivide is bit-exact on number arrays', () => {
    expect(dotDivide([8, 9], [2, 3])).toEqual([4, 3]);
  });

  it('mixed BigNumber stays on the generic path', () => {
    const a = [2, bignumber(3)];
    const b = [4, bignumber(5)];
    const out = dotMultiply(a, b) as unknown[];
    expect(out[0]).toBe(8);
    expect(String(out[1])).toBe('15');
  });
});

describe('P7-12 Array,scalar number inference', () => {
  it('dotMultiply(array, number) is bit-exact and stays an array', () => {
    const out = dotMultiply([2, 3, -0], 4) as number[];
    expect(out).toEqual([8, 12, -0]);
    expect(Array.isArray(out)).toBe(true);
    expect(attachedDatatype(out)).toBeUndefined();
  });

  it('does not infer when the scalar is a BigNumber', () => {
    const out = dotMultiply([2, 3], bignumber(4)) as unknown[];
    expect(String(out[0])).toBe('8');
    expect(String(out[1])).toBe('12');
    expect(Array.isArray(out)).toBe(true);
  });
});

describe('P7-12 DenseMatrix datatype is unchanged', () => {
  it('a DenseMatrix without datatype stays without one', () => {
    const a = matrix([1, 2, 3]);
    const b = matrix([4, 5, 6]);
    const out = dotMultiply(a, b);
    expect(attachedDatatype(a)).toBeUndefined();
    expect(attachedDatatype(out)).toBeUndefined();
    expect((out as { toArray(): number[] }).toArray()).toEqual([4, 10, 18]);
  });

  it('a DenseMatrix with datatype number keeps it', () => {
    const a = matrix([1, 2, 3]) as { _datatype?: string };
    const b = matrix([4, 5, 6]) as { _datatype?: string };
    a._datatype = 'number';
    b._datatype = 'number';
    const out = dotMultiply(a, b);
    expect(attachedDatatype(out)).toBe('number');
    expect(getMatrixDataType(out)).toBe('number');
    expect((out as { toArray(): number[] }).toArray()).toEqual([4, 10, 18]);
  });

  it('Array,DenseMatrix does not attach a datatype to the result', () => {
    const dense = matrix([4, 5, 6]) as { _datatype?: string };
    dense._datatype = 'number';
    const out = dotMultiply([1, 2, 3], dense);
    expect(attachedDatatype(out)).toBeUndefined();
    expect((out as { toArray(): number[] }).toArray()).toEqual([4, 10, 18]);
  });
});
