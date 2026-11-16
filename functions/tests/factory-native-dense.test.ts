/**
 * #1035: a factory function takes a DenseMatrix of the matrix package. Each factory function
 * gives the same entries as for the nested array of the same values. A matrix result is a
 * DenseMatrix of the matrix package when every entry is a number (dense in, dense out).
 */
import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import * as F from '../src/factories/index.js';

const fac = F as unknown as Record<string, (...a: unknown[]) => unknown>;
const data = (): number[][] => [
  [1, -2],
  [3, -4],
];
const native = (): DenseMatrix => DenseMatrix.fromArray(data());
const plain = (v: unknown): unknown =>
  v && typeof v === 'object' && 'toArray' in v ? (v as { toArray(): unknown }).toArray() : v;

// The 21 factory functions measured to recurse without end or throw on this class.
const NAMES = [
  'abs',
  'ceil',
  'fix',
  'floor',
  'log10',
  'log1p',
  'log2',
  'max',
  'min',
  'round',
  'sign',
  'unaryMinus',
  'unaryPlus',
  'cumsum',
  'mean',
  'norm',
  'std',
  'transpose',
  'variance',
];

describe('a factory function takes a DenseMatrix of the matrix package', () => {
  it.each(NAMES)('%s gives the result of the nested array', (name) => {
    const fn = fac[`factory_${name}`];
    expect(typeof fn).toBe('function');
    const want = plain(fn(data()));
    expect(plain(fn(native()))).toEqual(want);
  });

  it('a matrix result is a DenseMatrix of the matrix package', () => {
    expect(fac.factory_abs(native())).toBeInstanceOf(DenseMatrix);
    expect(fac.factory_transpose(native())).toBeInstanceOf(DenseMatrix);
  });

  it('nthRoot and gcd follow their nested-array result', () => {
    const sq = DenseMatrix.fromArray([
      [1, 4],
      [9, 16],
    ]);
    expect(plain(fac.factory_nthRoot(sq))).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(fac.factory_gcd(DenseMatrix.fromArray([[12, 18, 24]]))).toBe(6);
  });

  it('a non-number result gives the nested array', () => {
    expect(fac.factory_equal(native(), 1)).toEqual([
      [true, false],
      [false, false],
    ]);
  });
});

// The full add and multiply replace scalar stubs in factories/index.ts. A factory created
// before the replacement kept the stub, so it threw on an Array (mathjs 15 values).
describe('factories that add or multiply collections', () => {
  it('cumsum of a 2-D array sums the rows', () => {
    expect(fac.factory_cumsum(data())).toEqual([
      [1, -2],
      [4, -6],
    ]);
  });
  it('pow of a square matrix multiplies the matrix', () => {
    expect(
      plain(
        fac.factory_pow(
          [
            [1, 2],
            [3, 4],
          ],
          2
        )
      )
    ).toEqual([
      [7, 10],
      [15, 22],
    ]);
  });
});
