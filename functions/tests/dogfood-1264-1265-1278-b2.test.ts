/**
 * Dogfood #1264, #1265 and #1278 (batch B2).
 *
 * #1264: expm returns a matrix of the class and the storage of its argument.
 * #1265: sylvester checks the shapes of A, B and C first and throws a RangeError.
 * #1278: pow of a 0 x 0 matrix, the Matrix result of pow of a non-empty Matrix,
 * and sqrtm of a non-empty Matrix, which returns a Matrix.
 *
 * Every call goes through the root exports. The expected container rule is the
 * mathjs 15.2.0 rule: a Matrix in gives a Matrix out, an Array in gives an Array out.
 */
import { describe, expect, it } from 'vitest';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import {
  bignumber,
  expm as expmFn,
  matrix,
  pow as powFn,
  sparse,
  sqrtm as sqrtmFn,
  sylvester as sylvesterFn,
  zeros,
} from '../src/index.js';

type Fn1 = (a: unknown) => unknown;

type Fn2 = (a: unknown, b: unknown) => unknown;

type Fn3 = (a: unknown, b: unknown, c: unknown) => unknown;

type BridgeMatrix = { storage(): string; size(): number[]; toArray(): unknown };

const expm = expmFn as unknown as Fn1;

const pow = powFn as unknown as Fn2;

const sqrtm = sqrtmFn as unknown as Fn1;

const sylvester = sylvesterFn as unknown as Fn3;

/** The size of a bridge matrix (`size()`), a native dense or a public CSR matrix (`rows`, `cols`). */
const sz = (r: unknown): number[] => {
  const m = r as { size?: unknown; rows: number; cols: number };
  return typeof m.size === 'function' ? (m.size as () => number[])() : [m.rows, m.cols];
};

const I2 = [
  [1, 0],
  [0, 1],
];

/** Compares two nested number arrays entry by entry. */
const expectCloseTo = (actual: unknown, expected: number[][], digits = 12) => {
  const a = actual as number[][];
  expect(a.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(a[i].length).toBe(expected[i].length);
    for (let j = 0; j < expected[i].length; j++) {
      expect(a[i][j]).toBeCloseTo(expected[i][j], digits);
    }
  }
};

const E = Math.E;

const expE: number[][] = [
  [E, 0],
  [0, E],
];

describe('#1264 expm keeps the matrix class and storage', () => {
  it('T1 a dense Matrix gives a dense Matrix with size()', () => {
    const r = expm(matrix(I2)) as BridgeMatrix;
    expect(Array.isArray(r)).toBe(false);
    expect(typeof r.size).toBe('function');
    expect(r.storage()).toBe('dense');
    expect(r.size()).toEqual([2, 2]);
    expectCloseTo(r.toArray(), expE);
  });

  it('T2 a sparse Matrix gives a sparse Matrix', () => {
    const r = expm(sparse(I2)) as BridgeMatrix;
    expect(Array.isArray(r)).toBe(false);
    expect(r.storage()).toBe('sparse');
    expect(r.size()).toEqual([2, 2]);
    expectCloseTo(r.toArray(), expE);
  });

  it('T3 a public CSR SparseMatrix gives a public CSR SparseMatrix', () => {
    const r = expm(SparseMatrix.fromDense(DenseMatrix.identity(2)));
    expect(r instanceof SparseMatrix).toBe(true);
    expect(sz(r)).toEqual([2, 2]);
    const s = r as SparseMatrix;
    expect(s.get(0, 0)).toBeCloseTo(E, 12);
    expect(s.get(1, 1)).toBeCloseTo(E, 12);
    expect(s.get(0, 1)).toBe(0);
  });

  it('T4 a native DenseMatrix stays a native DenseMatrix', () => {
    const r = expm(DenseMatrix.identity(2));
    expect(r instanceof DenseMatrix).toBe(true);
    expectCloseTo((r as DenseMatrix).toArray(), expE);
  });

  it('T5 an Array stays an Array, and empty and non-square inputs follow the container rule', () => {
    const arr = expm(I2);
    expect(Array.isArray(arr)).toBe(true);
    expectCloseTo(arr, expE);

    const empty = expm(matrix([])) as BridgeMatrix;
    expect(typeof empty.size).toBe('function');
    expect(empty.storage()).toBe('dense');
    expect(empty.size()).toEqual([0, 0]);

    const emptySparse = expm(sparse([])) as BridgeMatrix;
    expect(Array.isArray(emptySparse)).toBe(false);
    expect(emptySparse.storage()).toBe('sparse');
    expect(emptySparse.size()).toEqual([0, 0]);

    const csr00 = expm(SparseMatrix.fromDense(DenseMatrix.zeros(0, 0)));
    expect(csr00 instanceof SparseMatrix).toBe(true);
    expect(sz(csr00)).toEqual([0, 0]);

    expect(() =>
      expm(
        matrix([
          [1, 2, 3],
          [4, 5, 6],
        ])
      )
    ).toThrow(/square/);
    expect(() =>
      expm(
        matrix([
          [1, 2, 3],
          [4, 5, 6],
        ])
      )
    ).toThrow(/2×3/);
    expect(() => expm(zeros(0, 3))).toThrow(/0×3/);
    expect(() => expm(matrix([1, 2, 3]))).toThrow(/square/);
    expect(() => expm(sparse([[1, 2, 3]]))).toThrow(/square/);
  });
});

describe('#1265 sylvester checks the shapes first', () => {
  const A23 = [
    [1, 2, 3],
    [4, 5, 6],
  ];
  const calls: Array<[string, () => unknown, RegExp]> = [
    [
      'A is 2 x 3',
      () => sylvester(A23, [[1]], [[1], [2]]),
      /A must be a square matrix \(size: \[2, 3\]\)/,
    ],
    [
      'C is 1 x 1 for a 2 x 2 A and a 3 x 3 B',
      () =>
        sylvester(
          I2,
          [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
          [[1]]
        ),
      /C must be 2 x 3/,
    ],
    [
      'C is 3 x 3 for a 2 x 2 A and a 2 x 2 B',
      () =>
        sylvester(
          I2,
          [
            [2, 0],
            [0, 2],
          ],
          [
            [1, 1, 1],
            [1, 1, 1],
            [1, 1, 1],
          ]
        ),
      /C must be 2 x 2/,
    ],
  ];

  it('T6 each shape error is a RangeError that names the operand', () => {
    for (const [label, call, message] of calls) {
      expect(call, label).toThrow(RangeError);
      expect(call, label).toThrow(/Dimension mismatch/);
      expect(call, label).toThrow(message);
    }
    expect(() => sylvester([[1]], [[1, 2]], [[1, 2]])).toThrow(RangeError);
    expect(() => sylvester([[1]], [[1, 2]], [[1, 2]])).toThrow(/B must be a square/);
  });

  it('T7 the Matrix path throws the same RangeError', () => {
    expect(() => sylvester(matrix(A23), matrix([[1]]), matrix([[1], [2]]))).toThrow(RangeError);
    expect(() => sylvester(matrix(A23), matrix([[1]]), matrix([[1], [2]]))).toThrow(
      /Dimension mismatch/
    );
    expect(() =>
      sylvester(
        matrix(I2),
        matrix([
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ]),
        matrix([[1]])
      )
    ).toThrow(RangeError);
    expect(() =>
      sylvester(
        matrix(I2),
        matrix([
          [2, 0],
          [0, 2],
        ]),
        matrix([
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1],
        ])
      )
    ).toThrow(/C must be 2 x 2/);
  });

  it('T8 a valid system gives the same solution as before', () => {
    const x = sylvester(
      [
        [-1, -2],
        [1, 1],
      ],
      [
        [2, -1],
        [1, -2],
      ],
      [
        [-3, 2],
        [3, 0],
      ]
    );
    expect(Array.isArray(x)).toBe(true);
    expectCloseTo(x, [
      [-0.25, 0.25],
      [1.5, -1.25],
    ]);
  });
});

describe('#1278 pow of a 0 x 0 matrix and of a non-empty Matrix', () => {
  const M = () =>
    matrix([
      [1, 1],
      [0, 1],
    ]);
  const cube = [
    [1, 3],
    [0, 1],
  ];

  it('T9 an empty Array gives [] and a non-integer exponent still throws', () => {
    expect(pow([], 2)).toEqual([]);
    expect(pow([], 0)).toEqual([]);
    expect(() => pow([], 1.5)).toThrow(/integer/);
  });

  it('T10 a 0 x 0 Matrix gives a 0 x 0 Matrix of the same storage', () => {
    for (const a of [matrix([]), zeros(0, 0)]) {
      const r = pow(a, 2) as BridgeMatrix;
      expect(Array.isArray(r)).toBe(false);
      expect(typeof r.size).toBe('function');
      expect(r.storage()).toBe('dense');
      expect(r.size()).toEqual([0, 0]);
    }
    const s = pow(sparse([]), 2) as BridgeMatrix;
    expect(Array.isArray(s)).toBe(false);
    expect(s.storage()).toBe('sparse');
    expect(s.size()).toEqual([0, 0]);

    const native = pow(DenseMatrix.zeros(0, 0), 2) as DenseMatrix;
    expect(native instanceof DenseMatrix).toBe(true);
    expect([native.rows, native.cols]).toEqual([0, 0]);
  });

  it('T11 a 0 x 3 matrix throws the square RangeError', () => {
    expect(() => pow(zeros(0, 3), 2)).toThrow(RangeError);
    expect(() => pow(zeros(0, 3), 2)).toThrow(/square/);
    expect(() => pow(DenseMatrix.zeros(0, 3), 2)).toThrow(RangeError);
    expect(() => pow(DenseMatrix.zeros(0, 3), 2)).toThrow(/square/);
  });

  it('T12 a non-empty Matrix gives a Matrix, an Array gives an Array', () => {
    const d = pow(M(), 3) as BridgeMatrix;
    expect(Array.isArray(d)).toBe(false);
    expect(d.storage()).toBe('dense');
    expect(d.toArray()).toEqual(cube);

    const s = pow(
      sparse([
        [1, 1],
        [0, 1],
      ]),
      3
    ) as BridgeMatrix;
    expect(Array.isArray(s)).toBe(false);
    expect(s.storage()).toBe('dense');
    expect(s.toArray()).toEqual(cube);

    const a = pow(
      [
        [1, 1],
        [0, 1],
      ],
      3
    );
    expect(Array.isArray(a)).toBe(true);
    expect(a).toEqual(cube);
  });

  it('T12b the exponent conversions and the existing errors stay', () => {
    for (const e of [3n, bignumber(3)]) {
      const r = pow(M(), e) as BridgeMatrix;
      expect(Array.isArray(r)).toBe(false);
      expect(r.toArray()).toEqual(cube);
    }
    expect(() => pow(M(), -1)).toThrow(/non-negative integer/);
    expect(() => pow(M(), 1.5)).toThrow(/non-negative integer/);
    expect(() => pow(matrix([1, 2]), 2)).toThrow(TypeError);
    expect(() => pow(matrix([1, 2]), 2)).toThrow(/2-D/);

    const id = pow(M(), 0) as BridgeMatrix;
    expect(Array.isArray(id)).toBe(false);
    expect(id.toArray()).toEqual(I2);

    const native = pow(
      DenseMatrix.fromArray([
        [1, 1],
        [0, 1],
      ]),
      3
    );
    expect(native instanceof DenseMatrix).toBe(true);
    expect((native as DenseMatrix).toArray()).toEqual(cube);

    const csr = pow(SparseMatrix.fromDense(DenseMatrix.identity(2)), 2);
    expect(Array.isArray(csr)).toBe(false);
    expect(sz(csr)).toEqual([2, 2]);

    const csr00 = pow(SparseMatrix.fromDense(DenseMatrix.zeros(0, 0)), 2);
    expect(csr00 instanceof SparseMatrix).toBe(true);
    expect(sz(csr00)[0]).toBe(0);
  });

  it('T12c an exponent that is not a non-negative integer fails before an empty result', () => {
    for (const a of [[], matrix([]), zeros(0, 0), sparse([]), DenseMatrix.zeros(0, 0)]) {
      expect(() => pow(a, 1.5)).toThrow(/non-negative integer/);
      expect(() => pow(a, -1)).toThrow(/non-negative integer/);
    }
  });
});

describe('#1278 sqrtm of a non-empty Matrix returns a Matrix', () => {
  it('T15 root sqrtm keeps the container', () => {
    const r = sqrtm(
      matrix([
        [4, 0],
        [0, 9],
      ])
    ) as BridgeMatrix;
    expect(Array.isArray(r)).toBe(false);
    expect(r.storage()).toBe('dense');
    expect(r.size()).toEqual([2, 2]);
    expectCloseTo(
      r.toArray(),
      [
        [2, 0],
        [0, 3],
      ],
      9
    );

    const s = sqrtm(
      sparse([
        [4, 0],
        [0, 9],
      ])
    ) as BridgeMatrix;
    expect(Array.isArray(s)).toBe(false);
    expect(s.storage()).toBe('dense');
    expectCloseTo(
      s.toArray(),
      [
        [2, 0],
        [0, 3],
      ],
      9
    );

    const a = sqrtm([
      [4, 0],
      [0, 9],
    ]);
    expect(Array.isArray(a)).toBe(true);
    expectCloseTo(
      a,
      [
        [2, 0],
        [0, 3],
      ],
      9
    );
  });
});
