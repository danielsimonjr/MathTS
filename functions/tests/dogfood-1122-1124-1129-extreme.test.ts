/**
 * Dogfood #1122, #1124, #1129 - matrices with extreme entries.
 *
 * The kernels of the functions package (qr, sqrtm, inv, rank, nullspace) get the power-of-2
 * scale of #1104. lstsq keeps the small entries of an extreme right-hand side, and the svd
 * family judges an unscaled run by its singular values. Expected values are NumPy 2.3.5 and
 * SciPy output, pasted as literals.
 */

import { describe, it, expect } from 'vitest';
import { lstsq, pinv as svdPinv, svd, singularValues } from '@danielsimonjr/mathts-matrix';
import { inv, nullspace, pinv, qr, rank, sqrtm } from '../src/index.js';

/** Every entry of `got` is within `tol` of `want`, relative to the largest |want| of its row. */
function expectClose(got: unknown, want: number[][], tol = 1e-12): void {
  const g = got as number[][];
  expect(g.length).toBe(want.length);
  for (let i = 0; i < want.length; i++) {
    const scale = Math.max(...want[i].map(Math.abs));
    for (let j = 0; j < want[i].length; j++) {
      expect(Number.isFinite(g[i][j])).toBe(true);
      if (want[i][j] === 0 && scale === 0) expect(g[i][j]).toBe(0);
      else expect(Math.abs(g[i][j] - want[i][j])).toBeLessThanOrEqual(tol * scale);
    }
  }
}

/** Each entry of `got` is within `tol` of its own `want`; a zero `want` needs a zero (either sign). */
function expectEachClose(got: unknown, want: number[] | number[][], tol = 1e-15): void {
  const g = (got as number[] | number[][]).flat();
  const w = want.flat();
  expect(g.length).toBe(w.length);
  w.forEach((v, k) => {
    if (v === 0) expect(g[k] === 0).toBe(true);
    else expect(Math.abs(g[k] - v)).toBeLessThanOrEqual(tol * Math.abs(v));
  });
}

describe('#1122 functions kernels on extreme matrices', () => {
  it('qr of a matrix near 1e200', () => {
    const { Q, R } = qr([
      [3e200, 1e200],
      [4e200, 2e200],
    ]) as { Q: number[][]; R: number[][] };
    // NumPy returns -Q and -R in the first row of R; the sign convention of this qr differs.
    expectClose(Q, [
      [0.6000000000000001, -0.8],
      [0.8, 0.6],
    ]);
    expectClose(R, [
      [4.9999999999999995e200, 2.2000000000000003e200],
      [0, 3.999999999999998e199],
    ]);
  });

  it('qr of a matrix near 1e-200', () => {
    const { R } = qr([
      [3e-200, 1e-200],
      [4e-200, 2e-200],
    ]) as { R: number[][] };
    expectClose(R, [
      [4.9999999999999993e-200, 2.2000000000000004e-200],
      [0, 3.9999999999999976e-201],
    ]);
  });

  it('sqrtm of a matrix near 1e200', () => {
    expectClose(
      sqrtm([
        [4e200, 1e200],
        [1e200, 3e200],
      ]),
      [
        [1.9815776331353157e100, 2.7083220609417954e99],
        [2.708322060941795e99, 1.7107454270411362e100],
      ],
      1e-9
    );
  });

  it('sqrtm of a matrix near 1e-20 reaches full precision', () => {
    expectClose(
      sqrtm([
        [4e-20, 1e-20],
        [1e-20, 3e-20],
      ]),
      [
        [1.9815776331353154e-10, 2.7083220609417913e-11],
        [2.7083220609417913e-11, 1.7107454270411362e-10],
      ],
      1e-9
    );
  });

  it('inv of a matrix near 1e200', () => {
    expectClose(
      inv([
        [1e200, 1e200],
        [0, 2e200],
      ]),
      [
        [1e-200, -5e-201],
        [0, 5e-201],
      ]
    );
  });

  it('inv of a matrix near 1e-200', () => {
    expectClose(
      inv([
        [1e-200, 1e-200],
        [0, 2e-200],
      ]),
      [
        [1e200, -5e199],
        [0, 5e199],
      ]
    );
  });

  it('rank and nullspace of a matrix near 1e-20', () => {
    const A = [
      [1e-20, 1e-20],
      [0, 2e-20],
    ];
    expect(rank(A)).toBe(2);
    expect(nullspace(A)).toEqual([]);
  });

  it('rank keeps an explicit absolute tolerance', () => {
    expect(
      rank(
        [
          [1e-20, 1e-20],
          [0, 2e-20],
        ],
        1e-10
      )
    ).toBe(0);
  });
});

describe('#1124 lstsq keeps small right-hand-side entries', () => {
  it('a matrix right-hand side with a 1e200 column and a 1e-200 column', () => {
    const x = lstsq(
      [
        [1, 0],
        [0, 1],
      ],
      [
        [1e200, 1e-200],
        [0, 1e-200],
      ]
    );
    expectEachClose(x, [
      [1e200, 1e-200],
      [0, 1e-200],
    ]);
  });

  it('a vector right-hand side that spans 1e300 to 1e-300', () => {
    expectEachClose(
      lstsq(
        [
          [1, 0],
          [0, 1],
        ],
        [1e300, 1e-300]
      ),
      [1e300, 1e-300]
    );
  });
});

describe('#1129 the svd family judges the unscaled run by its singular values', () => {
  const A = [
    [1e200, 0, 0],
    [0, 1, 0],
    [0, 0, 1e-200],
  ];
  const want = [
    [1e-200, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  it('pinv of the matrix package', () => {
    expectClose(svdPinv(A), want);
  });

  it('pinv of the functions package', () => {
    expectClose(pinv(A), want);
  });

  it('singular values keep the largest', () => {
    expect(singularValues(A)[0]).toBe(1e200);
    expect(svd(A).S[0]).toBe(1e200);
  });
});
