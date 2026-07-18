/**
 * Matrix-domain dedup parity + oracle guard.
 *
 * The dedup campaign allowlists several matrix-domain symbols that are defined
 * in BOTH `@danielsimonjr/mathts-functions` and `@danielsimonjr/mathts-matrix`.
 * Two dispositions are guarded here (per feedback-allowlist-needs-parity-guard):
 *
 *  1. `cholesky` — functions' `number[][]` surface now ROUTES to the matrix
 *     DenseMatrix primitive (native-accel). This pins the routed result to the
 *     NumPy oracle AND to the matrix primitive.
 *
 *  2. `trace`/`diag`/`dotMultiply`/`row`/`column`/`subset` — independent-by-design:
 *     functions/ carries the mathjs-derived factory body (mathjs Matrix / number[][]
 *     contract) while matrix/ dispatches the same op over `DenseMatrix`. Different
 *     type surfaces across two packages — this test pins the two impls together so
 *     they cannot silently diverge.
 *
 *  3. `cond` — functions' public `cond` is the SVD-based matrix primitive; pinned
 *     to the NumPy oracle (np.linalg.cond).
 *
 * Oracle values from NumPy 2.x (`np.linalg.cholesky`, `np.trace`, `np.linalg.cond`).
 */
import { describe, it, expect } from 'vitest';
import {
  cholesky,
  cond,
  trace,
  diag,
  dotMultiply,
  row,
  column,
  subset,
  index,
} from '@danielsimonjr/mathts-functions';
import {
  DenseMatrix,
  cholesky as mCholesky,
  trace as mTrace,
  diag as mDiag,
  dotMultiply as mDotMultiply,
  row as mRow,
  column as mColumn,
  subset as mSubset,
} from '@danielsimonjr/mathts-matrix';

const approx = (a: number[][], b: number[][]): void => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(a[i].length).toBe(b[i].length);
    for (let j = 0; j < a[i].length; j++) expect(a[i][j]).toBeCloseTo(b[i][j], 9);
  }
};

describe('cholesky — routed to matrix primitive, pinned to NumPy', () => {
  // np.linalg.cholesky reference L (lower-triangular, A = L·Lᵀ)
  const cases: Array<{ A: number[][]; L: number[][] }> = [
    {
      A: [
        [4, 2],
        [2, 3],
      ],
      L: [
        [2, 0],
        [1, Math.SQRT2],
      ],
    },
    {
      A: [
        [4, 12, -16],
        [12, 37, -43],
        [-16, -43, 98],
      ],
      L: [
        [2, 0, 0],
        [6, 1, 0],
        [-8, 5, 3],
      ],
    },
    {
      A: [
        [2, -1, 0],
        [-1, 2, -1],
        [0, -1, 2],
      ],
      L: [
        [1.4142135623730951, 0, 0],
        [-0.7071067811865476, 1.224744871391589, 0],
        [0, -0.816496580927726, 1.1547005383792515],
      ],
    },
  ];

  for (const { A, L } of cases) {
    it(`matches NumPy L for ${JSON.stringify(A)}`, () => {
      const got = cholesky(A).L as number[][];
      approx(got, L);
    });
    it(`agrees with the matrix DenseMatrix primitive for ${JSON.stringify(A)}`, () => {
      const fromFns = cholesky(A).L as number[][];
      const fromMatrix = mCholesky(DenseMatrix.fromArray(A)).L.toArray();
      approx(fromFns, fromMatrix);
    });
  }

  it('throws on a non-symmetric matrix (preserved contract)', () => {
    expect(() =>
      cholesky([
        [4, 2],
        [3, 3],
      ])
    ).toThrow(/symmetric/);
  });
  it('throws on a non-positive-definite matrix', () => {
    expect(() =>
      cholesky([
        [1, 2],
        [2, 1],
      ])
    ).toThrow(/positive definite/);
  });
});

describe('cond — SVD-based, pinned to NumPy (np.linalg.cond)', () => {
  it('cond(diag(1,2)) === 2', () => {
    expect(
      cond([
        [1, 0],
        [0, 2],
      ]) as number
    ).toBeCloseTo(2, 10);
  });
  it('cond of a near-singular matrix is large', () => {
    expect(
      cond([
        [1, 2],
        [2, 4.0001],
      ]) as number
    ).toBeGreaterThan(1e5);
  });
});

describe('matrix-domain factory ↔ DenseMatrix parity (independent-by-design)', () => {
  const A = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 10],
  ];
  const DM = (): DenseMatrix => DenseMatrix.fromArray(A);

  it('trace: functions factory === matrix DenseMatrix === NumPy (16)', () => {
    expect(trace(A) as number).toBe(16); // np.trace
    expect(trace(A) as number).toBe(mTrace(DM()) as number);
  });

  it('diag (build from vector): functions === matrix', () => {
    const v = [1, 2, 3];
    const fromFns = diag(v) as number[][];
    const fromMatrix = (mDiag(v) as DenseMatrix).toArray();
    approx(fromFns, fromMatrix);
    approx(fromFns, [
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]);
  });

  it('dotMultiply (elementwise): functions === matrix', () => {
    const fromFns = dotMultiply(A, A) as number[][];
    const fromMatrix = (mDotMultiply(DM(), DM()) as DenseMatrix).toArray();
    approx(fromFns, fromMatrix);
    approx(fromFns, [
      [1, 4, 9],
      [16, 25, 36],
      [49, 64, 100],
    ]);
  });

  it('row: functions === matrix', () => {
    const fromFns = row(A, 1) as number[][];
    const fromMatrix = (mRow(DM(), 1) as DenseMatrix).toArray();
    approx(fromFns, fromMatrix);
    approx(fromFns, [[4, 5, 6]]);
  });

  it('column: functions === matrix', () => {
    const fromFns = column(A, 1) as number[][];
    const fromMatrix = (mColumn(DM(), 1) as DenseMatrix).toArray();
    approx(fromFns, fromMatrix);
    approx(fromFns, [[2], [5], [8]]);
  });

  it('subset (scalar element): functions === matrix === 5', () => {
    expect(subset(A, index(1, 1)) as number).toBe(5);
    expect(mSubset(DM(), 1, 1) as number).toBe(5);
  });
});
