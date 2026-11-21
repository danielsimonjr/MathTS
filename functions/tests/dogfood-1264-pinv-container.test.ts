import { describe, expect, it } from 'vitest';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { pinv, sparse, zeros } from '../src/index.js';

type Boxed = { toArray(): number[][]; size(): number[]; storage(): string };
const A = [
  [2, 1],
  [1, 3],
];
// inverse of A = 1/5 [[3, -1], [-1, 2]]
const INV = [
  [0.6, -0.2],
  [-0.2, 0.4],
];
const close = (got: number[][], want: number[][]) => {
  for (let i = 0; i < want.length; i++) {
    for (let j = 0; j < want[i].length; j++) expect(got[i][j]).toBeCloseTo(want[i][j], 10);
  }
};
const size = (r: unknown): number[] =>
  typeof (r as Boxed).size === 'function'
    ? (r as Boxed).size()
    : [(r as { rows: number }).rows, (r as { cols: number }).cols];

describe('pinv keeps the container (mathjs 15.2.0)', () => {
  it('a boxed sparse matrix gives a boxed sparse matrix', () => {
    const r = pinv(sparse(A)) as Boxed;
    expect(Array.isArray(r)).toBe(false);
    expect(r.storage()).toBe('sparse');
    close(r.toArray(), INV);
  });
  it('a public CSR SparseMatrix gives a SparseMatrix', () => {
    const r = pinv(
      SparseMatrix.fromDense(DenseMatrix.fromArray(A)) as never
    ) as unknown as SparseMatrix;
    expect(r instanceof SparseMatrix).toBe(true);
    close(r.toArray() as number[][], INV);
  });
  it('a public CSR matrix with a zero axis gives a SparseMatrix of the transposed size', () => {
    for (const [r, c] of [
      [0, 0],
      [0, 3],
      [3, 0],
    ]) {
      const out = pinv(SparseMatrix.fromDense(DenseMatrix.zeros(r, c)) as never);
      expect(out instanceof SparseMatrix).toBe(true);
      expect(size(out)).toEqual([c, r]);
    }
  });
  it('the pseudo-inverse of a boxed 3 x 0 matrix is a 0 x 3 matrix', () => {
    expect(size(pinv(zeros(3, 0) as never))).toEqual([0, 3]);
  });
});
