import { describe, it, expect, vi } from 'vitest';
// A SparseMatrix from a second loaded copy of the package fails `instanceof`.
// Every decomposition input must still accept it (issue #949 class).
import * as first from '@danielsimonjr/mathts-matrix';

const ENTRIES = [
  { row: 0, col: 0, value: 4 },
  { row: 0, col: 1, value: -1 },
  { row: 1, col: 0, value: -1 },
  { row: 1, col: 1, value: 4 },
  { row: 1, col: 2, value: -1 },
  { row: 2, col: 1, value: -1 },
  { row: 2, col: 2, value: 4 },
];
const DENSE = [
  [4, -1, 0],
  [-1, 4, -1],
  [0, -1, 4],
];

async function foreignSparse(): Promise<first.SparseMatrix> {
  vi.resetModules();
  const second = await import('@danielsimonjr/mathts-matrix');
  expect(second.SparseMatrix).not.toBe(first.SparseMatrix);
  const S = second.SparseMatrix.fromCOO(3, 3, ENTRIES);
  expect(S instanceof first.SparseMatrix).toBe(false);
  return S as unknown as first.SparseMatrix;
}

describe('decompositions accept a SparseMatrix of a second package copy', () => {
  it('eig and eigvals', async () => {
    const S = await foreignSparse();
    const want = first
      .eigvals(DENSE)
      .map((v) => v.re)
      .sort();
    expect(
      first
        .eigvals(S)
        .map((v) => v.re)
        .sort()
    ).toEqual(want);
    expect(first.eig(S).values).toHaveLength(3);
  });

  it('svd', async () => {
    const S = await foreignSparse();
    expect(first.svd(S).S).toEqual(first.svd(DENSE).S);
  });

  it('qr', async () => {
    const S = await foreignSparse();
    expect(first.qr(S).R.toArray()).toEqual(first.qr(DENSE).R.toArray());
  });

  it('cholesky', async () => {
    const S = await foreignSparse();
    expect(first.cholesky(S).L.toArray()).toEqual(first.cholesky(DENSE).L.toArray());
  });

  it('lu and luSolve', async () => {
    const S = await foreignSparse();
    const x = first.luSolve(first.lu(S), [3, 2, 3]);
    const flat = Array.from(
      (x as { toFloat64Array?: () => Float64Array }).toFloat64Array?.() ?? (x as never)
    );
    expect(flat.map((v) => Math.round((v as number) * 1e12) / 1e12)).toEqual([1, 1, 1]);
  });

  it('condest', async () => {
    const S = await foreignSparse();
    expect(first.condest(S)).toBeCloseTo(first.condest(new first.DenseMatrix(3, 3, DENSE)), 12);
  });

  it('lstsq', async () => {
    const S = await foreignSparse();
    expect(first.lstsq(S, [3, 2, 3])).toEqual(first.lstsq(DENSE, [3, 2, 3]));
  });

  it('the element limit applies to a decomposition input', async () => {
    vi.resetModules();
    const second = await import('@danielsimonjr/mathts-matrix');
    const big = second.SparseMatrix.fromCOO(5000, 5000, [{ row: 0, col: 0, value: 1 }]);
    expect(() => first.svd(big as never)).toThrow(RangeError);
  });
});
