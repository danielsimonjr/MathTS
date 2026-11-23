import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { describe, expect, it } from 'vitest';
import {
  cholesky,
  evaluate,
  lq,
  matrix,
  matrixExpm,
  ql,
  qrPivoted,
  rq,
  sparse,
  svd,
} from '../src/index.js';

const entries = [
  [4, 1],
  [1, 3],
];

describe('#1340 native and boxed matrix entry points', () => {
  it('evaluates one-based indices and end on a native matrix', () => {
    const A = DenseMatrix.fromArray(entries);
    expect(evaluate('A[1,1]', { A })).toBe(4);
    expect(evaluate('A[end,end]', { A })).toBe(3);
  });

  it('matrixExpm preserves the input container', () => {
    const native = DenseMatrix.fromArray(entries);
    const boxed = matrix(entries);
    const csc = sparse(entries);
    expect(Array.isArray(matrixExpm(entries))).toBe(true);
    expect(matrixExpm(native)).toBeInstanceOf(DenseMatrix);
    expect((matrixExpm(boxed) as { storage(): string }).storage()).toBe('dense');
    expect((matrixExpm(csc) as { storage(): string }).storage()).toBe('sparse');
  });

  it('factors dense and sparse boxed inputs through the same numerical kernels', () => {
    for (const a of [matrix(entries), sparse(entries)]) {
      expect(cholesky(a)).toEqual(cholesky(entries));
      for (const factor of [svd, lq, rq, ql, qrPivoted] as const) {
        expect(JSON.stringify(factor(a))).toBe(JSON.stringify(factor(entries)));
      }
    }
  });

  it('reports rank and lossy entries on boxed inputs', () => {
    expect(() => qrPivoted(matrix([4, 1]))).toThrow(/two-dimensional/);
    expect(() =>
      svd(
        matrix([
          [{}, 1],
          [1, 3],
        ])
      )
    ).toThrow(TypeError);
  });
});
