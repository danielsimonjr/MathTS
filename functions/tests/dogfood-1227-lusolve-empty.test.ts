/**
 * Dogfood #1227 — lusolve of an empty system has the empty solution (no "singular" error).
 * A non-square empty input throws the dimension error of the non-empty non-square path.
 */
import { describe, expect, it } from 'vitest';
import { lusolve, matrix, sparse } from '../src/factories/index.js';

type DenseCtor = new (o: { data: unknown[]; size: number[] }) => object;
const DenseMatrix = (matrix([]) as object).constructor as unknown as DenseCtor;

const emptyLup = (rows: number, cols: number) => ({
  L: new DenseMatrix({ data: [], size: [rows, cols] }),
  U: new DenseMatrix({ data: [], size: [rows, cols] }),
  p: [] as number[],
});

describe('#1227 lusolve of an empty system', () => {
  it('Array A returns an empty nested Array', () => {
    expect(lusolve([], [])).toEqual([]);
    expect(lusolve([], matrix([]))).toEqual([]);
  });

  it('DenseMatrix A returns a 0 x 1 DenseMatrix', () => {
    for (const b of [[], matrix([])]) {
      const x = lusolve(matrix([]), b) as unknown as { size(): number[]; valueOf(): unknown };
      expect(x.size()).toEqual([0, 1]);
      expect(x.valueOf()).toEqual([]);
    }
  });

  it('SparseMatrix A returns a 0 x 1 DenseMatrix, with or without order and threshold', () => {
    for (const x of [lusolve(sparse([]), []), lusolve(sparse([]), [], 1, 1)] as unknown as {
      size(): number[];
      valueOf(): unknown;
    }[]) {
      expect(x.size()).toEqual([0, 1]);
      expect(x.valueOf()).toEqual([]);
    }
  });

  it('an lup or slu style factor object of a 0 x 0 system returns a 0 x 1 DenseMatrix', () => {
    const x = lusolve(emptyLup(0, 0), []) as unknown as { size(): number[] };
    expect(x.size()).toEqual([0, 1]);
  });

  it('non-square empty input throws the dimension error', () => {
    expect(() => lusolve([[]], [])).toThrow(/must be square \(got 1×0\)/);
    expect(() => lusolve(matrix([[]]), [])).toThrow(/Matrix must be square \(size: \[1, 0\]\)/);
    expect(() => lusolve(sparse([[]]), [])).toThrow(/Matrix must be square \(size: \[1, 0\]\)/);
    expect(() => lusolve(emptyLup(1, 0), [])).toThrow(/Matrix must be square/);
  });

  it('a right-hand side of the wrong length still throws the dimension error', () => {
    expect(() => lusolve([], [1])).toThrow(/Dimension mismatch/);
    expect(() => lusolve(matrix([]), [1])).toThrow(/Dimension mismatch/);
  });

  it('never reports singular', () => {
    expect(() => lusolve([], [])).not.toThrow(/singular/i);
    expect(() => lusolve(sparse([]), [])).not.toThrow(/singular/i);
  });
});
