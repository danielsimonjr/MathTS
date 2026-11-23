import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { add, multiply, matrix, bignumber } from '../src/index.js';

type BinaryFn = (left: unknown, right: unknown) => unknown;
const operations: Record<'add' | 'multiply', BinaryFn> = { add, multiply };
const oracle = mathjs as unknown as Record<'add' | 'multiply', BinaryFn>;
type MatrixResult = { toArray(): unknown[] };
const oracleMatrix = mathjs.matrix as (input: unknown[][]) => mathjs.Matrix;

describe('numeric strings inside collections', () => {
  it.each(['add', 'multiply'] as const)('matches mathjs for %s on arrays', (name) => {
    const f = operations[name];
    const want = oracle[name];
    expect(f(['1', '2'], [3, 4])).toEqual(want(['1', '2'], [3, 4]));
    expect(f([3, 4], ['1', '2'])).toEqual(want([3, 4], ['1', '2']));
    expect(f(['1', '2'], 2)).toEqual(want(['1', '2'], 2));
    expect(f(2, ['1', '2'])).toEqual(want(2, ['1', '2']));
    expect(() => f(['no-number'], [1])).toThrow(/Cannot convert "no-number" to a number/);
    expect(() => f('2', 3)).toThrow(/unexpected type string/);
  });

  it.each(['add', 'multiply'] as const)('matches mathjs for %s on boxed matrices', (name) => {
    const a = [
      ['1', '2'],
      ['3', '4'],
    ];
    const b = [
      [3, 4],
      [5, 6],
    ];
    const actual = operations[name](matrix(a), matrix(b)) as MatrixResult;
    const expected = oracle[name](oracleMatrix(a), oracleMatrix(b)) as MatrixResult;
    expect(actual.toArray()).toEqual(expected.toArray());
  });

  it('uses precision-preserving scalar conversions for BigNumber matrix entries', () => {
    const value = '1.1234567890123456789';
    const actualBig = bignumber('2.3');
    const expectedBig = mathjs.bignumber('2.3');
    for (const name of ['add', 'multiply'] as const) {
      const left = [[value]];
      const actual = operations[name](left, [[actualBig]]) as unknown[][];
      const expected = oracle[name](left, [[expectedBig]]) as unknown[][];
      expect(String(actual[0][0])).toBe(String(expected[0][0]));
    }
  });
});
