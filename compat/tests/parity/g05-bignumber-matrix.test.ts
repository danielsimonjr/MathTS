import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { expectSame } from './differential.js';

/**
 * G05 — BigNumber matrix `pow`, `sylvester` and `lyap` (#1553).
 *
 * In BigNumber mode the matrix literals of an expression hold BigNumbers. The
 * compat instance computes `pow` through the activated factory and, since G05,
 * `sylvester` and `lyap` through the mathjs 15.3.0 ports wired to the compat
 * `schur` (the mathjs QR iteration), so every case below matches the mathjs
 * 15.3.0 oracle in `typeOf` and `format(value, { precision: 14 })`, including
 * the entry types.
 */

type CompatInstance = ReturnType<typeof createCompat>;

const bigNumberInstance = (): CompatInstance => createCompat(compatAll, { number: 'BigNumber' });

const entryTypes = (L: CompatInstance, m: unknown): string[][] =>
  (m as { toArray(): unknown[][] })
    .toArray()
    .map((row: unknown[]): string[] => row.map((x: unknown) => String(L.typeOf(x))));

describe('G05 BigNumber matrix pow/sylvester/lyap (#1553)', () => {
  it('pow([[1, 2], [4, 3]], 2) matches the oracle with BigNumber entries', () => {
    const L = bigNumberInstance();
    const result = L.evaluate('pow([[1, 2], [4, 3]], 2)');
    expect(L.typeOf(result)).toBe('DenseMatrix');
    expect(L.format(result, { precision: 14 })).toBe('[[9, 8], [16, 17]]');
    expect(entryTypes(L, result)).toEqual([
      ['BigNumber', 'BigNumber'],
      ['BigNumber', 'BigNumber'],
    ]);
  });

  it('sylvester([[-1, -2], [1, 1]], [[-2, 1], [-1, 2]], [[-3, 2], [3, 0]]) matches the oracle', () => {
    const L = bigNumberInstance();
    const result = L.evaluate(
      'sylvester([[-1, -2], [1, 1]], [[-2, 1], [-1, 2]], [[-3, 2], [3, 0]])'
    );
    expect(L.typeOf(result)).toBe('DenseMatrix');
    expect(L.format(result, { precision: 14 })).toBe('[[1.75, 0.75], [-1.5, 0.25]]');
    expect(entryTypes(L, result)).toEqual([
      ['BigNumber', 'BigNumber'],
      ['BigNumber', 'BigNumber'],
    ]);
  });

  it('lyap([[-2, 0], [1, -4]], [[3, 1], [1, 3]]) matches the oracle', () => {
    const L = bigNumberInstance();
    const result = L.evaluate('lyap([[-2, 0], [1, -4]], [[3, 1], [1, 3]])');
    expect(L.typeOf(result)).toBe('DenseMatrix');
    expect(L.format(result, { precision: 14 })).toBe(
      '[[0.75, 0.29166666666667], [0.29166666666667, 0.44791666666667]]'
    );
    expect(entryTypes(L, result)).toEqual([
      ['BigNumber', 'BigNumber'],
      ['BigNumber', 'BigNumber'],
    ]);
  });

  it('the three issue rows equal the oracle through the differential harness', () => {
    expectSame('G05 pow of a BigNumber matrix', { number: 'BigNumber' }, (L) =>
      (L as unknown as CompatInstance).evaluate('pow([[1, 2], [4, 3]], 2)')
    );
    expectSame('G05 sylvester of BigNumber matrices', { number: 'BigNumber' }, (L) =>
      (L as unknown as CompatInstance).evaluate(
        'sylvester([[-1, -2], [1, 1]], [[-2, 1], [-1, 2]], [[-3, 2], [3, 0]])'
      )
    );
    expectSame('G05 lyap of BigNumber matrices', { number: 'BigNumber' }, (L) =>
      (L as unknown as CompatInstance).evaluate('lyap([[-2, 0], [1, -4]], [[3, 1], [1, 3]])')
    );
  });

  it('schur of a BigNumber matrix returns BigNumber entries and reconstructs A', () => {
    const L = bigNumberInstance();
    const result = L.evaluate('schur([[1, 2], [3, 4]])') as {
      U: { toArray(): unknown[][] };
      T: { toArray(): unknown[][] };
    };
    const T = result.T.toArray() as unknown[][];
    const U = result.U.toArray() as unknown[][];
    expect(L.typeOf(T[0][0])).toBe('BigNumber');
    expect(L.typeOf(U[0][0])).toBe('BigNumber');
    // A = U · T · Uᵀ holds on the compat BigNumber entries. The raw functions
    // multiply keeps the entries; the compat arithmetic shim narrows arrays to
    // the native number matrix, so it is not used here.
    const product = mathFunctions.multiply(
      mathFunctions.multiply(U, T) as unknown,
      mathFunctions.transpose(U) as unknown
    ) as unknown[][];
    const expected = L.format(
      [
        [L.bignumber(1), L.bignumber(2)],
        [L.bignumber(3), L.bignumber(4)],
      ],
      {
        precision: 10,
      }
    );
    expect(L.format(product, { precision: 10 })).toBe(expected);
  });
});
