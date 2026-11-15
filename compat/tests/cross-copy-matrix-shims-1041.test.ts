/**
 * The matrix shims treat a matrix of a second copy of `@danielsimonjr/mathts-matrix` as a matrix
 * of the first copy (#1041). `instanceof` fails across copies, so a shim that tests with it
 * rejects the matrix or takes the wrong path.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as m1 from '@danielsimonjr/mathts-matrix';
import { add, det, matrix, transpose } from '../src/shims.js';

type M = typeof m1;
let m2: M;
const E = [
  { row: 0, col: 0, value: 2 },
  { row: 1, col: 1, value: 3 },
];
const rows = (v: unknown) => (v as { toArray(): number[][] }).toArray();

beforeAll(async () => {
  // The helper is untyped, so the test imports it through a URL that the type checker does not read.
  const helper = new URL('../../tools/test/second-package-copy.mjs', import.meta.url).href;
  const { importSecondPackageCopy } = (await import(helper)) as {
    importSecondPackageCopy(dir: string, name: string): Promise<unknown>;
  };
  m2 = (await importSecondPackageCopy('matrix', 'compat-matrix-1041')) as M;
});

describe('#1041 the matrix shims with a matrix of a second copy', () => {
  it('the copy has its own classes', () => {
    expect(m2.DenseMatrix).not.toBe(m1.DenseMatrix);
    expect(m2.DenseMatrix.fromArray([[1]]) instanceof m1.DenseMatrix).toBe(false);
  });

  it('matrix returns a dense matrix of the second copy unchanged', () => {
    const d = m2.DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
    ]);
    expect(matrix(d as never)).toBe(d);
  });

  it('matrix with the sparse format converts a dense matrix of the second copy', () => {
    const s = matrix(
      m2.DenseMatrix.fromArray([
        [1, 0],
        [0, 2],
      ]) as never,
      'sparse'
    );
    expect((s as unknown as { storage(): string }).storage()).toBe('sparse');
    expect(rows(s)).toEqual([
      [1, 0],
      [0, 2],
    ]);
  });

  it('transpose transposes a dense matrix of the second copy', () => {
    const t = transpose(
      m2.DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]) as never
    );
    expect(rows(t)).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  it('det rejects a sparse matrix of the second copy, as for the first copy', () => {
    expect(() => det(m1.SparseMatrix.fromCOO(2, 2, E) as never)).toThrow(
      'Expected DenseMatrix or 2D array'
    );
    expect(() => det(m2.SparseMatrix.fromCOO(2, 2, E) as never)).toThrow(
      'Expected DenseMatrix or 2D array'
    );
  });

  it('add of two dense matrices of the second copy returns the sum as an array', () => {
    const d = () =>
      m2.DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
    expect(add(d() as never, d() as never)).toEqual([
      [2, 4],
      [6, 8],
    ]);
  });
});
