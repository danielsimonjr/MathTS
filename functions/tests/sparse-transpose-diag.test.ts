/**
 * The public `transpose` accepts a matrix or a nested array (#1034). `diag` returns the diagonal of
 * a sparse matrix. The expected values come from mathjs 15.2.0. The flat kernel
 * form `transpose(data, rows, cols)` is unchanged.
 */
import { describe, expect, it } from 'vitest';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { bignumber, diag, evaluate, matrix, sparse, transpose } from '../src/index.js';
import { MathJSSparseMatrix } from '../src/factories/matrix-bridge.js';

type M = { storage(): string; size(): number[]; valueOf(): unknown };
const asM = (x: unknown): M => x as M;
const S = (): unknown =>
  sparse([
    [1, 0, 3],
    [0, 2, 0],
  ]);

describe('transpose of a matrix or a nested array (#1034)', () => {
  it('transposes a sparse matrix and keeps the sparse storage', () => {
    const t = asM(transpose(S() as never));
    expect(t.storage()).toBe('sparse');
    expect(t.size()).toEqual([3, 2]);
    expect(t.valueOf()).toEqual([
      [1, 0],
      [0, 2],
      [3, 0],
    ]);
  });

  it('transposes a dense matrix and a nested array', () => {
    expect(
      asM(
        transpose(
          matrix([
            [1, 2],
            [3, 4],
          ]) as never
        )
      ).valueOf()
    ).toEqual([
      [1, 3],
      [2, 4],
    ]);
    expect(
      transpose([
        [1, 2],
        [3, 4],
      ] as never)
    ).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  it('keeps the flat kernel form', () => {
    expect(Array.from(transpose(new Float64Array([1, 2, 3, 4, 5, 6]), 2, 3))).toEqual([
      1, 4, 2, 5, 3, 6,
    ]);
  });

  it('evaluate resolves transpose to the matrix function', () => {
    expect(
      evaluate('transpose(A)', {
        A: [
          [1, 2],
          [3, 4],
        ],
      })
    ).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });
});

describe('diag of a sparse matrix', () => {
  it('returns the main diagonal as a sparse column', () => {
    const d = asM(diag(S() as never));
    expect(d.storage()).toBe('sparse');
    expect(d.size()).toEqual([2, 1]);
    expect(d.valueOf()).toEqual([[1], [2]]);
  });

  it('returns the super and sub diagonals', () => {
    expect(asM(diag(S() as never, 1)).valueOf()).toEqual([[0], [0]]);
    expect(asM(diag(S() as never, 2)).valueOf()).toEqual([[3]]);
    const sub = asM(diag(S() as never, -1));
    expect(sub.size()).toEqual([1, 1]);
    expect(sub.valueOf()).toEqual([[0]]);
  });

  it('converts to the requested storage', () => {
    const d = asM(diag(S() as never, 'dense'));
    expect(d.storage()).toBe('dense');
    expect(d.valueOf()).toEqual([[1], [2]]);
  });
});

describe('transpose: argument checks and the matrix package', () => {
  it('a typed array without rows and cols throws', () => {
    expect(() => transpose(new Float64Array([1, 2, 3, 4]) as never)).toThrow(
      /typed array needs rows and cols/
    );
  });

  it('rows without cols throws a TypeError that names the function', () => {
    // transpose is a typed-function (#1160): a call with no signature gives the mathjs TypeError.
    const t = transpose as unknown as (...a: unknown[]) => unknown;
    expect(() => t([[1, 2]], 1)).toThrow(TypeError);
    expect(() => t([[1, 2]], 1)).toThrow(/in function transpose/);
    expect(() => [[[1, 2]]].map(t)).toThrow(TypeError);
    expect(() => [[[1, 2]]].map(t)).toThrow(/in function transpose/);
  });

  it('a matrix of the matrix package keeps its class', () => {
    const d = transpose(
      DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]) as never
    ) as unknown;
    expect(d).toBeInstanceOf(DenseMatrix);
    expect((d as DenseMatrix).toArray()).toEqual([
      [1, 3],
      [2, 4],
    ]);
    const s = SparseMatrix.fromDense(
      DenseMatrix.fromArray([
        [1, 0, 3],
        [0, 2, 0],
      ])
    );
    const st = transpose(s as never) as unknown as SparseMatrix;
    expect(st.toDense().toArray()).toEqual([
      [1, 0],
      [0, 2],
      [3, 0],
    ]);
  });

  it('the public type follows the array shape', () => {
    const t2: number[][] = transpose([
      [1, 2],
      [3, 4],
    ]);
    const t1: number[] = transpose([1, 2]);
    expect(t2).toEqual([
      [1, 3],
      [2, 4],
    ]);
    expect(t1).toEqual([1, 2]);
  });
});

describe('diagonal: index checks, pattern matrices and the matrix package', () => {
  it('matches mathjs for every k in range, and gives size [0, 1] outside it', () => {
    const m = sparse([
      [1, 0],
      [3, 4],
      [5, 0],
    ]);
    const got = (k: number): unknown => asM(diag(m as never, k)).valueOf();
    expect(got(0)).toEqual([[1], [4]]);
    expect(got(1)).toEqual([[0]]);
    expect(got(-1)).toEqual([[3], [0]]);
    expect(got(-2)).toEqual([[5]]);
    const big = (m as unknown as MathJSSparseMatrix).diagonal(3);
    expect(big.size()).toEqual([0, 1]);
  });

  it('a BigNumber k works, and a non-integer k throws', () => {
    expect(asM(diag(S() as never, bignumber(2) as never)).valueOf()).toEqual([[3]]);
    expect(() => diag(S() as never, 0.5)).toThrow(TypeError);
    expect(() => (S() as MathJSSparseMatrix).diagonal(0.5)).toThrow(/must be an integer/);
  });

  it('a pattern matrix gives a pattern column', () => {
    const p = new MathJSSparseMatrix({ values: null, index: [0, 1], ptr: [0, 1, 2], size: [2, 2] });
    const d = p.diagonal();
    expect(d.size()).toEqual([2, 1]);
    expect(d._values).toBeNull();
    expect(d._index).toEqual([0, 1]);
  });

  it('diag of a sparse matrix of the matrix package works', () => {
    const s = SparseMatrix.fromDense(
      DenseMatrix.fromArray([
        [1, 0, 3],
        [0, 2, 0],
      ])
    );
    const d = diag(s as never) as unknown as SparseMatrix;
    expect(d.toDense().toArray()).toEqual([[1], [2]]);
  });
});
