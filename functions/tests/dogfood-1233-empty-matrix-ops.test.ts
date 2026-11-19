/**
 * Dogfood #1233 — pow, sqrtm, expm, sylvester and kron of an empty matrix.
 * A 0 x 0 input gives a 0 x 0 result of the same container type (Array or
 * Matrix), as inv and det do (#1230). pow(A0, 0) is the 0 x 0 identity.
 * kron takes its result size from the sizes of the operands, so an operand
 * with a zero dimension gives a result of the right size.
 */
import { describe, expect, it } from 'vitest';
import {
  expm,
  factory_pow as powFn,
  kron,
  matrix,
  sparse,
  sqrtm,
  sylvester,
  zeros,
} from '../src/factories/index.js';

type Mat = { storage(): string; size(): number[] };
const pow = powFn as (x: unknown, y: unknown) => unknown;
const k = kron as (a: unknown, b: unknown) => unknown;
const syl = sylvester as (a: unknown, b: unknown, c: unknown) => unknown;
const dense00 = () => zeros(0, 0, 'dense');
const sparse00 = () => zeros(0, 0, 'sparse');
const squareRe = /square/;

const expectEmpty = (r: unknown, storage: string, size = [0, 0]) => {
  expect((r as Mat).storage()).toBe(storage);
  expect((r as Mat).size()).toEqual(size);
};

describe('#1233 pow of a 0 x 0 matrix', () => {
  it('an Array [] gives [] for every integer power', () => {
    for (const y of [0, 1, 2, -1, -3]) expect(pow([], y)).toEqual([]);
  });
  it('matrix([]), a 0 x 0 DenseMatrix and sparse([]) keep their kind', () => {
    for (const y of [0, 2, -1]) {
      expectEmpty(pow(matrix([]), y), 'dense');
      expectEmpty(pow(dense00(), y), 'dense');
      expectEmpty(pow(sparse([]), y), 'sparse');
      expectEmpty(pow(sparse00(), y), 'sparse');
    }
  });
  it('returns a new object and keeps the input', () => {
    const a = dense00();
    expect(pow(a, 2)).not.toBe(a);
    expect((a as Mat).size()).toEqual([0, 0]);
  });
  it('a non-integer power still throws', () => {
    expect(() => pow([], 1.5)).toThrow(/integer/);
    expect(() => pow(dense00(), 0.5)).toThrow(/integer/);
  });
  it('a non-square empty input still throws the square error', () => {
    expect(() => pow([[]], 2)).toThrow(/square \(size is 1x0\)/);
    expect(() => pow(zeros(3, 0, 'dense'), 2)).toThrow(/square \(size is 3x0\)/);
  });
  it('a non-empty matrix is unchanged', () => {
    expect(
      pow(
        [
          [1, 2],
          [4, 3],
        ],
        2
      )
    ).toEqual([
      [9, 8],
      [16, 17],
    ]);
  });
});

describe('#1233 sqrtm of a 0 x 0 matrix', () => {
  it('an Array [] gives []', () => {
    expect(sqrtm([])).toEqual([]);
  });
  it('a Matrix keeps its kind and is a new object', () => {
    for (const a of [matrix([]), dense00(), sparse([]), sparse00()]) {
      const r = sqrtm(a);
      expect(r).not.toBe(a);
      expectEmpty(r, (a as Mat).storage());
    }
  });
  it('a non-square empty input still throws', () => {
    expect(() => sqrtm([[]])).toThrow(squareRe);
    expect(() => sqrtm(zeros(3, 0, 'dense'))).toThrow(/\[3, 0\]/);
  });
  it('a non-empty matrix is unchanged', () => {
    const r = sqrtm([
      [33, 24],
      [48, 57],
    ]) as number[][];
    expect(r[0][0]).toBeCloseTo(5, 9);
    expect(r[1][1]).toBeCloseTo(7, 9);
  });
});

describe('#1233 expm of a 0 x 0 matrix', () => {
  it('an Array [] gives []', () => {
    expect(expm([])).toEqual([]);
  });
  it('sparse([]) gives [], as a non-empty sparse matrix gives an Array', () => {
    expect(expm(sparse([]))).toEqual([]);
  });
  it('a DenseMatrix 0 x 0 gives a 0 x 0 matrix', () => {
    for (const a of [matrix([]), dense00()]) {
      const r = expm(a) as { rows: number; cols: number };
      expect([r.rows, r.cols]).toEqual([0, 0]);
    }
  });
  it('a non-square empty input throws the square error', () => {
    expect(() => expm([[]])).toThrow(squareRe);
    expect(() => expm([[]])).toThrow(/1×0/);
    expect(() => expm(zeros(2, 0, 'dense'))).toThrow(squareRe);
  });
  it('a non-empty matrix is unchanged', () => {
    expect(
      expm([
        [0, 0],
        [0, 0],
      ])
    ).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});

describe('#1233 sylvester of an empty system', () => {
  it('three Arrays [] give []', () => {
    expect(syl([], [], [])).toEqual([]);
  });
  it('a Matrix operand gives a 0 x 0 Matrix', () => {
    expectEmpty(syl(matrix([]), matrix([]), matrix([])), 'dense');
    expectEmpty(syl(dense00(), dense00(), dense00()), 'dense');
    expectEmpty(syl([], dense00(), []), 'dense');
    expectEmpty(syl(sparse([]), sparse([]), sparse([])), 'dense');
  });
  it('an empty B with a non-empty A gives an m x 0 result', () => {
    const a = [
      [1, 0],
      [0, 1],
    ];
    expect(syl(a, [], [[], []])).toEqual([[], []]);
    expectEmpty(syl(matrix([[1]]), dense00(), zeros(1, 0, 'dense')), 'dense', [1, 0]);
  });
  it('an empty A with a non-empty B gives a 0 x n Matrix', () => {
    expectEmpty(syl(dense00(), matrix([[1]]), zeros(0, 1, 'dense')), 'dense', [0, 1]);
  });
  it('a C of the wrong size throws', () => {
    expect(() => syl(dense00(), dense00(), matrix([[1]]))).toThrow(/Dimension mismatch/);
    expect(() => syl([[1]], [], [[1]])).toThrow(/Dimension mismatch/);
  });
  it('a non-empty system is unchanged', () => {
    const x = syl([[1]], [[1]], [[4]]) as number[][];
    expect(x[0][0]).toBeCloseTo(2, 12);
  });
});

describe('#1233 kron with an empty operand', () => {
  const m2 = () =>
    matrix([
      [1, 2],
      [3, 4],
    ]);
  it('Arrays keep their shape', () => {
    expect(k([], [])).toEqual([]);
    expect(k([[]], [[1, 2]])).toEqual([[]]);
    expect(k([[1, 2]], [[]])).toEqual([[]]);
    expect(k([[], []], [[1, 2]])).toEqual([[], []]);
  });
  it('a 0 x 0 Matrix with a 0 x 0 Matrix is 0 x 0', () => {
    expectEmpty(k(dense00(), dense00()), 'dense');
    expectEmpty(k(sparse00(), sparse00()), 'dense');
  });
  it('a 0 x 0 Matrix with a non-empty operand is 0 x 0', () => {
    expectEmpty(k(dense00(), [[1, 2]]), 'dense');
    expectEmpty(k([[1, 2]], dense00()), 'dense');
    expectEmpty(k(dense00(), m2()), 'dense');
    expectEmpty(k(m2(), sparse00()), 'dense');
  });
  it('an m x 0 or 0 x n Matrix gives the product of the sizes', () => {
    expectEmpty(k(zeros(2, 0, 'dense'), matrix([[1, 2]])), 'dense', [2, 0]);
    expectEmpty(k(zeros(0, 2, 'dense'), matrix([[1, 2]])), 'dense', [0, 4]);
    expectEmpty(k(matrix([[1, 2]]), zeros(0, 2, 'dense')), 'dense', [0, 4]);
    expectEmpty(k(zeros(0, 2, 'dense'), m2()), 'dense', [0, 4]);
    expectEmpty(k(zeros(3, 0, 'dense'), zeros(3, 0, 'dense')), 'dense', [9, 0]);
    expectEmpty(k(zeros(2, 0, 'dense'), zeros(0, 3, 'dense')), 'dense', [0, 0]);
    expectEmpty(k(zeros(0, 2, 'dense'), zeros(3, 0, 'dense')), 'dense', [0, 0]);
  });
  it('a one-dimensional empty Matrix is still a vector', () => {
    expectEmpty(k(matrix([]), matrix([[1, 2]])), 'dense', [1, 0]);
  });
  it('a non-empty Kronecker product is unchanged', () => {
    expect(k([1, 1], [2, 3, 4])).toEqual([2, 3, 4, 2, 3, 4]);
  });
});

describe('#1233 a 0 x n or n x 0 Matrix is not square', () => {
  const nonSquare = () => [
    zeros(0, 3, 'dense'),
    zeros(3, 0, 'dense'),
    zeros(0, 3, 'sparse'),
    zeros(3, 0, 'sparse'),
  ];
  it('pow throws the square error and does not return an empty matrix', () => {
    for (const a of nonSquare()) {
      const [r, c] = (a as Mat).size();
      for (const y of [0, 2, -1]) {
        expect(() => pow(a, y)).toThrow(`For A^b, A must be square (size is ${r}x${c})`);
      }
      expect(() => pow(a, 1.5)).toThrow(/integer/);
    }
  });
  it('sqrtm throws the square error', () => {
    for (const a of nonSquare()) expect(() => sqrtm(a)).toThrow(squareRe);
  });
  it('expm throws the square error, also for a sparse matrix', () => {
    for (const a of nonSquare()) {
      const [r, c] = (a as Mat).size();
      expect(() => expm(a)).toThrow(`matrixExpm: matrix must be square (got ${r}×${c})`);
    }
    expect(() => expm(sparse([[1, 2, 3]]))).toThrow(squareRe);
  });
  it('expm of a non-empty sparse matrix is unchanged', () => {
    expect(
      expm(
        sparse([
          [0, 0],
          [0, 0],
        ])
      )
    ).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
  it('sylvester throws for a non-square empty A or B', () => {
    for (const a of nonSquare()) {
      expect(() => syl(a, dense00(), dense00())).toThrow(squareRe);
    }
  });
});

describe('#1233 sylvester with 0 rows and an Array C', () => {
  const b = [
    [1, 0],
    [0, 1],
  ];
  it('C = [] is the 0 x n right-hand side', () => {
    expect(syl([], b, [])).toEqual([]);
    expectEmpty(syl(dense00(), matrix(b), []), 'dense', [0, 2]);
    expectEmpty(syl(dense00(), matrix(b), matrix([])), 'dense', [0, 2]);
  });
  it('C = [] is not an m x 0 right-hand side', () => {
    expect(() => syl(b, [], [])).toThrow(/Dimension mismatch: C must be 2 x 0/);
  });
});

describe('#1233 kron with two empty operands and with three dimensions', () => {
  it('two empty operands of each storage', () => {
    expectEmpty(k(sparse00(), zeros(0, 3, 'sparse')), 'dense', [0, 0]);
    expectEmpty(k(zeros(0, 3, 'sparse'), zeros(0, 3, 'dense')), 'dense', [0, 9]);
    expectEmpty(k(zeros(3, 0, 'sparse'), zeros(3, 0, 'sparse')), 'dense', [9, 0]);
    expectEmpty(k([], dense00()), 'dense', [0, 0]);
    expectEmpty(k(matrix([]), matrix([])), 'dense', [0]);
  });
  it('a sparse operand with a zero dimension', () => {
    expectEmpty(
      k(
        zeros(0, 3, 'sparse'),
        sparse([
          [1, 2],
          [3, 4],
        ])
      ),
      'dense',
      [0, 6]
    );
  });
  it('an operand of three dimensions keeps the earlier result', () => {
    expectEmpty(k([[[1]]], dense00()), 'dense', [1, 1, 0]);
  });
});
