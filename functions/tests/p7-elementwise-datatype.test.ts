/**
 * P7-12 pins: infer number datatype for Array,Array / Array,scalar only.
 */
import { describe, it, expect } from 'vitest';
import { Complex, Fraction } from '@danielsimonjr/mathts-core';
import {
  bignumber,
  complex,
  dotDivide,
  dotMultiply,
  getMatrixDataType,
  matrix,
} from '../src/factories/index.js';
import { factoryScope } from '../src/factories/scope.js';
import { createMatAlgo13xDD } from '../src/type/matrix/utils/matAlgo13xDD.js';
import type { TypedFunction } from '../src/core/function/typed.js';

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

  it('a Fraction entry stays on the generic path', () => {
    const a = [new Fraction(2, 1), new Fraction(3, 1)];
    const b = [new Fraction(4, 1), new Fraction(5, 1)];
    const out = dotMultiply(a, b) as { toNumber(): number }[];
    expect(out[0]!.toNumber()).toBe(8);
    expect(out[1]!.toNumber()).toBe(15);
    expect(out[0]).toBeInstanceOf(Fraction);
  });

  it('a Complex entry stays on the generic path', () => {
    const a = [complex(2, 0), new Complex(3, 1)];
    const b = [complex(4, 0), new Complex(5, 0)];
    const out = dotMultiply(a, b) as { re: number; im: number }[];
    expect(out[0]!.re).toBe(8);
    expect(out[1]!.re).toBe(15);
    expect(out[1]!.im).toBe(5);
  });

  it('2-D number arrays stay bit-exact and datatype-free', () => {
    const a = [
      [1, 2],
      [3, 4],
    ];
    const b = [
      [5, 6],
      [7, 8],
    ];
    const out = dotMultiply(a, b) as number[][];
    expect(out).toEqual([
      [5, 12],
      [21, 32],
    ]);
    expect(Array.isArray(out)).toBe(true);
    expect(attachedDatatype(out)).toBeUndefined();
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

describe('P7-12 malformed shapes stay on the generic path', () => {
  it('a ragged array does not produce NaN from a raw number impl', () => {
    let threw = false;
    let out: unknown;
    try {
      out = dotMultiply([[1, 2], [3]], 4);
    } catch {
      threw = true;
    }
    if (!threw) {
      const rows = out as unknown[][];
      expect(rows).toEqual([[4, 8], [12]]);
      expect(rows[1]).toHaveLength(1);
      expect(rows.flat().some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false);
    }
  });
});

describe('P7-12 matAlgo13xDD does not tag when find fails', () => {
  it('a plain-function callback returning BigNumbers leaves the result untagged', () => {
    const algo = createMatAlgo13xDD({
      typed: factoryScope.typed as TypedFunction,
    }) as (
      a: unknown,
      b: unknown,
      cb: (x: unknown, y: unknown) => unknown
    ) => { _datatype?: string; toArray(): unknown[][] };
    const a = matrix([
      [1, 2],
      [3, 4],
    ]) as { _datatype?: string };
    const b = matrix([
      [5, 6],
      [7, 8],
    ]) as { _datatype?: string };
    a._datatype = 'number';
    b._datatype = 'number';
    const out = algo(a, b, (x, y) => bignumber(x as number).mul(y as number));
    expect(attachedDatatype(out)).toBeUndefined();
    expect(String(out.toArray()[0]![0])).toBe('5');
  });
});
