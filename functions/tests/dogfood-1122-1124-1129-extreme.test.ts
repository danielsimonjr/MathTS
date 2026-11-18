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

  it('qr of a matrix near 2^-60 reflects every column', () => {
    // Before: R was the upper triangle of A, because isZero read each column norm as zero.
    const A = [
      [1.3, -0.4, 0.7],
      [0.2, 2.1, -1.1],
      [-0.9, 0.5, 1.6],
    ].map((row) => row.map((v) => v * 2 ** -60));
    const { R } = qr(A) as { R: number[][] };
    // NumPy returns the first two rows with the opposite sign.
    expectClose(
      R.map((row) => row.map((v) => v * 2 ** 60)),
      [
        [1.5937377450509227, -0.3451006928259873, -0.4705918538536188],
        [0, 2.1681571695361535, -0.9004889508175455],
        [0, 0, 1.7965697750274356],
      ]
    );
  });

  it('qr is exact under a power-of-2 scale across the lower window edge', () => {
    const A = [
      [1.3, -0.4, 0.7],
      [0.2, 2.1, -1.1],
      [-0.9, 0.5, 1.6],
    ];
    const want = qr(A) as { Q: number[][]; R: number[][] };
    for (const k of [-19, -20, -21, -22, -51, -400, -401, -1000]) {
      const got = qr(A.map((row) => row.map((v) => v * 2 ** k))) as {
        Q: number[][];
        R: number[][];
      };
      expect(got.Q).toEqual(want.Q);
      expect(got.R.map((row) => row.map((v) => v / 2 ** k))).toEqual(want.R);
    }
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

  it('sqrtm above 2^400 is 2^225 times the root at 2^0', () => {
    // Before: scaled to the top of the window, the iteration did not converge.
    const A = [
      [2.4175568593124126, 0.08472754974047803],
      [0.08472754974047803, 2.0184761582291912],
    ];
    const want = sqrtm(A) as number[][];
    expect(want).toEqual([
      [1.5545886195619647, 0.02847952318486678],
      [0.02847952318486678, 1.4204453790935976],
    ]);
    const got = sqrtm(A.map((row) => row.map((v) => v * 2 ** 450))) as number[][];
    expect(got).toEqual(want.map((row) => row.map((v) => v * 2 ** 225)));
  });

  it('sqrtm of a subnormal matrix', () => {
    expectEachClose(
      sqrtm([
        [1e-310, 0],
        [0, 4e-310],
      ]) as number[][],
      [
        [1e-155, 0],
        [0, 2e-155],
      ],
      1e-14
    );
  });

  it('inv of a matrix with a subnormal entry', () => {
    // Before: the determinant 2^-2000 underflowed to 0 and inv threw.
    expectEachClose(
      inv([
        [2 ** -1000, 2 ** -1060],
        [0, 2 ** -1000],
      ]) as number[][],
      [
        [2 ** 1000, -(2 ** 940)],
        [0, 2 ** 1000],
      ],
      1e-14
    );
  });

  it('rank and nullspace of a tiny 3x3 matrix', () => {
    const A = [
      [1e-30, 2e-30, 0],
      [0, 3e-30, 1e-30],
      [1e-30, 0, 4e-30],
    ];
    expect(rank(A)).toBe(3);
    expect(nullspace(A)).toEqual([]);
  });

  it('rank and nullspace of a subnormal matrix', () => {
    const A = [
      [5e-324, 0],
      [0, 5e-324],
    ];
    expect(rank(A)).toBe(2);
    expect(nullspace(A)).toEqual([]);
  });

  it('rank and nullspace of zero, -0, NaN and Infinity inputs take the unscaled path', () => {
    for (const Z of [
      [
        [0, 0],
        [0, 0],
      ],
      [
        [-0, 0],
        [0, -0],
      ],
    ]) {
      expect(rank(Z)).toBe(0);
      expect(nullspace(Z)).toEqual([
        [1, 0],
        [0, 1],
      ]);
    }
    for (const v of [NaN, Infinity]) {
      const A = [
        [v, 1],
        [1, 1],
      ];
      expect(rank(A)).toBe(2);
      expect(nullspace(A)).toEqual([]);
    }
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
  it('a right-hand side with a 1e-300 entry next to 1e100', () => {
    expect(
      lstsq(
        [
          [1, 0],
          [0, 1],
        ],
        [1e100, 1e-300]
      )
    ).toEqual([1e100, 1e-300]);
  });

  it('a right-hand side with a subnormal entry', () => {
    const I = [
      [1, 0],
      [0, 1],
    ];
    expect(lstsq(I, [1e10, 1e-310])).toEqual([1e10, 1e-310]);
    expect(lstsq(I, [3, 1e-310])).toEqual([3, 1e-310]);
  });

  it('a right-hand side on three levels: 1.7e308, 1e-20 and 5e-324', () => {
    const I = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    expect(lstsq(I, [1.7e308, 1e-20, 5e-324])).toEqual([1.7e308, 1e-20, 5e-324]);
    expect(lstsq(I, [1e300, 1e-10, 1e-320])).toEqual([1e300, 1e-10, 1e-320]);
  });

  it('a small entry in a row that no large entry reaches is solved alone', () => {
    const A = [
      [3, 0, 1],
      [0, 2, 0],
      [1, 0, 2],
    ];
    const x = lstsq(A, [1e57, 3e-251, 2e57]);
    expect(x[1]).toBe(1.5e-251);
    // The other entries have the bits of the solve without the small entry.
    const large = lstsq(A, [1e57, 0, 2e57]);
    expect(x[0]).toBe(large[0]);
    expect(x[2]).toBe(large[2]);
  });

  it('a small entry that cannot change the solution leaves its bits', () => {
    const A = [
      [2, 1],
      [1, 3],
      [1, 1],
    ];
    expect(lstsq(A, [3e200, 7e199, 1e-200])).toEqual(lstsq(A, [3e200, 7e199, 0]));
  });

  it('a subnormal right-hand side with a matrix entry above 1', () => {
    const A = [
      [9, -2],
      [0, 1],
    ];
    expect(lstsq(A, [0, 1e-323])).toEqual([0, 1e-323]);
    expect(lstsq(A, [-7e-5, 1e-323])).toEqual([-0.000007777777777777777, 1e-323]);
  });

  it('an extreme right-hand side with no small entry keeps the old bits', () => {
    const A = [
      [2, 1],
      [1, 3],
      [1, 1],
    ];
    expect(lstsq(A, [3e200, 7e199, 1e200])).toEqual([
      1.6033333333333326e200, -3.199999999999999e199,
    ]);
    expect(lstsq(A, [3e-200, 7e-201, 1e-200])).toEqual([
      1.6033333333333327e-200, -3.1999999999999994e-201,
    ]);
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

  it('singular values reject an unscaled run that disagrees with the scaled run', () => {
    // Before: the unscaled run gave [2e87, 1e86, 1e64]; its values were finite, so it was kept.
    expectEachClose(
      singularValues([
        [0, 0, 0],
        [0, 2e87, 1e86],
        [1e64, 0, 1e-267],
      ]),
      [2.0024984394500785e87, 1e64, 0],
      1e-14
    );
  });

  it('singular values keep the largest', () => {
    expect(singularValues(A)[0]).toBe(1e200);
    expect(svd(A).S[0]).toBe(1e200);
  });
});
