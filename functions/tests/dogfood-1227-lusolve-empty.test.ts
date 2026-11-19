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

describe('#1227 lusolve empty system: review cases', () => {
  it('real slu factor objects of sparse([]) solve for every order', async () => {
    const { slu } = await import('../src/factories/index.js');
    for (const order of [0, 1, 2, 3]) {
      const x = lusolve(slu(sparse([]), order, 1) as never, []) as unknown as {
        size(): number[];
      };
      expect(x.size()).toEqual([0, 1]);
    }
  });

  it('Array A = [] validates b like a matrix A', () => {
    for (const size of [
      [1, 0],
      [0, 2],
    ]) {
      const b = new DenseMatrix({ data: size[0] === 1 ? [[]] : [], size });
      expect(() => lusolve([], b as never)).toThrow(/Dimension mismatch/);
      expect(() => lusolve(matrix([]), b as never)).toThrow(/Dimension mismatch/);
    }
  });

  it('a non-square empty Array throws the same error class as a non-empty one', () => {
    let emptyErr: unknown;
    let fullErr: unknown;
    try {
      lusolve([[]], []);
    } catch (e) {
      emptyErr = e;
    }
    try {
      lusolve([[1, 2]], [1]);
    } catch (e) {
      fullErr = e;
    }
    expect((emptyErr as Error).constructor).toBe((fullErr as Error).constructor);
  });
});

describe('#1227 lusolve empty system: real lup factors and right-hand sides', () => {
  it('real lup factor objects of an empty system solve', async () => {
    const { lup } = await import('../src/factories/index.js');
    for (const a of [[], matrix([])]) {
      const x = lusolve(lup(a as never) as never, []) as unknown as { size(): number[] };
      expect(x.size()).toEqual([0, 1]);
      expect(() => lusolve(lup(a as never) as never, [1])).toThrow(/Dimension mismatch/);
    }
  });

  it('non-square lup factors throw the error of the L factor first, then of the U factor', async () => {
    const { lup, zeros } = await import('../src/factories/index.js');
    const tall = lup(zeros(3, 0) as never) as never; // L is 3 x 0, U is 0 x 0
    const wide = lup(zeros(0, 3) as never) as never; // L is 0 x 0, U is 0 x 3
    expect(() => lusolve(tall, [])).toThrow(/Matrix must be square \(size: \[3, 0\]\)/);
    expect(() => lusolve(tall, [1, 2, 3])).toThrow(/Matrix must be square \(size: \[3, 0\]\)/);
    expect(() => lusolve(wide, [])).toThrow(/Matrix must be square \(size: \[0, 3\]\)/);
    expect(() => lusolve(wide, [1, 2, 3])).toThrow(/Dimension mismatch/);
  });

  it('every kind of A accepts matrix([]) as b and refuses a b of the wrong size', async () => {
    const { lup, slu } = await import('../src/factories/index.js');
    const solvers: ((b: unknown) => unknown)[] = [
      (b) => lusolve(sparse([]), b as never),
      (b) => lusolve(sparse([]), b as never, 1, 1),
      (b) => lusolve(lup(matrix([])) as never, b as never),
      (b) => lusolve(slu(sparse([]), 1, 1) as never, b as never),
    ];
    for (const solve of solvers) {
      expect((solve(matrix([])) as { size(): number[] }).size()).toEqual([0, 1]);
      expect(() => solve([1])).toThrow(/Dimension mismatch/);
      expect(() => solve(new DenseMatrix({ data: [[]], size: [1, 0] }))).toThrow(
        /Dimension mismatch/
      );
      expect(() => solve(new DenseMatrix({ data: [], size: [0, 2] }))).toThrow(
        /Dimension mismatch/
      );
    }
  });
});
