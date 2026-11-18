/**
 * Dogfood #1123, #1125, #1127 — kernels that compare data to absolute constants.
 *
 * The result of these kernels depended on the unit of the matrix. A cutoff such as
 * `norm < 1e-14` or `isSymmetric(tol = 1e-8)` reads a small matrix as zero or as
 * symmetric, and a pivot test of `|a| < 1e-14` calls a scaled copy of a regular matrix
 * singular. A large matrix leaves Hessenberg residue above `1e-12`, so `sqrtm` read it
 * as a 2×2 block. The oracle is SciPy (values below) and homogeneity in a power of 2.
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix, matrixSqrtm, matrixLogm, qr } from '../src/index.js';
import { WASMBackend } from '../src/backends/WASMBackend.js';

const nested = (m: DenseMatrix): number[][] => m.toArray();
const scale = (a: number[][], f: number): number[][] => a.map((r) => r.map((x) => x * f));
const mul = (a: number[][], b: number[][]): number[][] =>
  a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const maxAbs = (a: number[][]): number => Math.max(...a.flat().map(Math.abs));
const maxDiff = (a: number[][], b: number[][]): number =>
  Math.max(...a.flat().map((x, i) => Math.abs(x - b.flat()[i])));
const transpose = (a: number[][]): number[][] => a[0].map((_, j) => a.map((r) => r[j]));

describe('#1127 sqrtm of a non-symmetric matrix at a large magnitude', () => {
  const G = [
    [0.7974129661584175, 0.2740272867913836, 0.10349203232331827, 0.2084351043928432],
    [0.013375910426421602, 1, 0.08446274005077208, 0.055715472028951205],
    [-0.02285613253935842, 0.07186782008112688, 0.8755190592324514, -0.014508746582366195],
    [0.10658716098773126, 0.061813296252045125, 0.21321555139567133, 0.8224867529854987],
  ];
  const base = nested(matrixSqrtm(DenseMatrix.fromArray(G)));

  it.each([40, 52, 100, 300])('G·2^%i: sqrtm(2^e G)·2^(-e/2) equals sqrtm(G)', (e) => {
    const r = nested(matrixSqrtm(DenseMatrix.fromArray(scale(G, 2 ** e))));
    expect(maxDiff(scale(r, 2 ** (-e / 2)), base)).toBeLessThan(1e-12);
  });

  it('the root of G squares back to G', () => {
    expect(maxDiff(mul(base, base), G)).toBeLessThan(1e-14);
  });
});

describe('#1125 matrixSqrtm', () => {
  it('a non-symmetric matrix at 2^-22 is not read as symmetric (SciPy 1.3227e-4, 1.3492e-4)', () => {
    const r = nested(
      matrixSqrtm(
        DenseMatrix.fromArray(
          scale(
            [
              [4, 1],
              [1.02, 3],
            ],
            2 ** -22
          )
        )
      )
    );
    expect(r[0][1]).toBeCloseTo(1.3227e-4, 8);
    expect(r[1][0]).toBeCloseTo(1.3492e-4, 8);
    expect(r[0][1]).not.toBe(r[1][0]);
  });

  it('the zero matrix has the root zero', () => {
    expect(nested(matrixSqrtm(DenseMatrix.zeros(2, 2)))).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});

describe('#1125 matrixLogm', () => {
  it('diag(1, 1e-20) is diag(0, -46.0517) (SciPy)', () => {
    const r = nested(
      matrixLogm(
        DenseMatrix.fromArray([
          [1, 0],
          [0, 1e-20],
        ])
      )
    );
    expect(r[0][0]).toBe(0);
    expect(r[1][1]).toBeCloseTo(-46.051701859880914, 9);
    expect(r[0][1]).toBe(0);
    expect(r[1][0]).toBe(0);
  });

  it('a negative eigenvalue still throws', () => {
    expect(() =>
      matrixLogm(
        DenseMatrix.fromArray([
          [1, 0],
          [0, -1e-20],
        ])
      )
    ).toThrow(/non-positive eigenvalue/);
  });
});

describe('#1125 qr keeps a column that is small against the largest entry', () => {
  // The second and third pivots are 1.6e-15 and 1.3e-15 (NumPy): below the old 1e-14.
  const A = scale(
    [
      [1, 1, 1],
      [1, 1 + 1e-9, 1],
      [1, 1, 1 + 1e-9],
    ],
    2 ** -19
  );
  it('Q·R = A and the pivots are the NumPy values', () => {
    const { Q, R } = qr(DenseMatrix.fromArray(A));
    const q = nested(Q);
    const r = nested(R);
    expect(maxDiff(mul(q, r), A) / maxAbs(A)).toBeLessThan(1e-9);
    expect(r[1][1] / 1.55734396e-15).toBeCloseTo(1, 2);
    expect(r[2][2] / 1.34869978e-15).toBeCloseTo(1, 2);
    expect(
      maxDiff(mul(transpose(q), q), [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
    ).toBeLessThan(1e-9);
  });
});

describe('#1125 matrixSqrtm: a negative or complex eigenvalue is rejected at each magnitude', () => {
  const sqrtmOf = (a: number[][], f: number): number[][] =>
    nested(matrixSqrtm(DenseMatrix.fromArray(scale(a, f))));

  it.each([2 ** -20, 1, 2 ** 40])('symmetric, eigenvalue -0.01·%p', (f) => {
    expect(() =>
      sqrtmOf(
        [
          [1, 0],
          [0, -0.01],
        ],
        f
      )
    ).toThrow(/negative eigenvalue/);
  });

  it.each([2 ** -20, 1, 2 ** 40])('non-symmetric, eigenvalue -0.01·%p', (f) => {
    expect(() =>
      sqrtmOf(
        [
          [1, 2],
          [0, -0.01],
        ],
        f
      )
    ).toThrow(/negative eigenvalue/);
  });

  it.each([2 ** -20, 1, 2 ** 40])('complex pair 1 ± 0.001i beside -0.01, times %p', (f) => {
    expect(() =>
      sqrtmOf(
        [
          [1, -0.001, 0],
          [0.001, 1, 0],
          [0, 0, -0.01],
        ],
        f
      )
    ).toThrow(/complex eigenvalues/);
  });
});

describe('#1125 matrixSqrtm: a singular matrix has its root at each magnitude', () => {
  const relResidual = (a: number[][]): number => {
    const r = nested(matrixSqrtm(DenseMatrix.fromArray(a)));
    return maxDiff(mul(r, r), a) / maxAbs(a);
  };

  // Rank 2, non-symmetric; SciPy gives a real root at each k. An absolute -1e-7 read the
  // rounding noise of the zero eigenvalue as a negative eigenvalue from 2^30.
  it.each([-40, -20, 0, 20, 30, 40, 60, 200])('non-symmetric rank-2 matrix·2^%i', (k) => {
    const A = scale(
      [
        [5, 1, 2],
        [1, 0.5, 0.1],
        [10, 2, 4],
      ],
      2 ** k
    );
    expect(relResidual(A)).toBeLessThan(1e-7);
  });

  // Rank 2, symmetric positive semi-definite (U·Uᵀ).
  it.each([-40, -20, 0, 20, 40, 60, 128, 200])('symmetric rank-2 matrix·2^%i', (k) => {
    const A = scale(
      [
        [5, 4, 1],
        [4, 5, -1],
        [1, -1, 2],
      ],
      2 ** k
    );
    expect(relResidual(A)).toBeLessThan(1e-7);
  });

  // The Newton step stopped at an absolute 1e-13: a relative residual of 5e-8 at 4e-6.
  it('a positive definite matrix of entries about 4e-6 has a residual below 1e-14', () => {
    const A = [
      [
        0.000003813867491344354, -9.841513004266744e-7, -0.0000017118065710494081,
        -2.6223755567215794e-7,
      ],
      [
        -9.841513004266744e-7, 0.0000041349239167993805, 5.905785984194268e-7,
        -0.0000024486224537905343,
      ],
      [
        -0.0000017118065710494081, 5.905785984194268e-7, 0.0000012116631905430532,
        -6.042381847729672e-7,
      ],
      [
        -2.6223755567215794e-7, -0.0000024486224537905343, -6.042381847729672e-7,
        0.0000026215503024026625,
      ],
    ];
    expect(relResidual(A)).toBeLessThan(1e-14);
  });
});

describe('#1125 matrixLogm rejects a singular matrix', () => {
  it('a rank-1 2×2 matrix throws', () => {
    expect(() =>
      matrixLogm(
        DenseMatrix.fromArray([
          [0.3618395826551426, 1.8211066011476398],
          [0.05335828610720117, 0.26854753242505963],
        ])
      )
    ).toThrow(/non-positive eigenvalue/);
  });
});

describe('#1125 matrixLogm: a small eigenvalue of a triangular matrix', () => {
  const logmOf = (m: number[][]): number[][] => nested(matrixLogm(DenseMatrix.fromArray(m)));

  it('[[1e-20, 1], [0, 1]] is [[-46.0517, 46.0517], [0, 0]] (SciPy)', () => {
    const r = logmOf([
      [1e-20, 1],
      [0, 1],
    ]);
    expect(r[0][0]).toBeCloseTo(-46.051701859880914, 9);
    expect(r[0][1]).toBeCloseTo(46.051701859880914, 9);
    expect(r[1][0]).toBe(0);
    expect(r[1][1]).toBeCloseTo(0, 12);
  });

  // log([[a, b], [0, a]]) = [[ln a, b/a], [0, ln a]]. The root recurrence divides by the sum
  // of two diagonal entries of about 1e-15; an absolute 1e-14 test set the quotient to 0.
  // The entry 1 keeps the matrix inside the scaling window.
  it('a block [[1e-30, 1e-20], [0, 1e-30]] has the off-diagonal entry 1e10', () => {
    const r = logmOf([
      [1e-30, 1e-20, 0],
      [0, 1e-30, 0],
      [0, 0, 1],
    ]);
    // The block is far from normal (b/a = 1e10), so the diagonal keeps about 9 digits.
    expect(r[0][0]).toBeCloseTo(-69.07755278982137, 6);
    expect(r[0][1] / 1e10).toBeCloseTo(1, 9);
    expect(r[2][2]).toBe(0);
  });

  it('the message names the floor for a positive eigenvalue below it', () => {
    expect(() =>
      logmOf([
        [1, 1],
        [1, 1 + 1e-14],
      ])
    ).toThrow(/non-positive eigenvalue.*not above the floor 1e-14/);
  });
});

describe('#1125 matrixLogm quadrature constants', () => {
  // The 16-point Gauss-Legendre nodes were wrong by up to 1e-8 and the weights summed to
  // 1 - 1e-11, so the Schur path had an error of about 1e-11 for each matrix.
  it('logm of [[2,1,0],[1,3,1],[0,1,4]] equals the mpmath value to 1e-14', () => {
    const r = nested(
      matrixLogm(
        DenseMatrix.fromArray([
          [2, 1, 0],
          [1, 3, 1],
          [0, 1, 4],
        ])
      )
    );
    // mpmath, 40 digits.
    const ref = [
      [0.5832842544815817, 0.4477505161685006, -0.0675775180180274],
      [0.4477505161685006, 0.963457252632055, 0.31259548013244576],
      [-0.0675775180180274, 0.31259548013244576, 1.3436302507825282],
    ];
    expect(maxDiff(r, ref)).toBeLessThan(1e-14);
  });
});

describe('#1125 matrixLogm of a large non-symmetric matrix', () => {
  // The Schur form of a large matrix keeps residue above an absolute 1e-12 below its
  // diagonal. The absolute test sent the matrix to the Newton path: an error of 5e5 at
  // 2^120 for this matrix.
  const A = [
    [20024917.398208477, -1928743.611125782, -7002042.169364643],
    [5556725.288284881, 10102.919974043085, -2107337.8945354274],
    [-2128627.5478277775, -563868.5877630396, 1722821.1071258693],
  ];
  // SciPy logm(A).
  const ref = [
    [16.89564851998866, -0.7432493596868418, -1.1774173732628286],
    [1.0577514667385077, 12.918980177564473, -0.4941534613397401],
    [-0.05946578399619151, -1.1239482521376205, 13.730516432310395],
  ];

  // The Schur form of this graded matrix at 2^40 keeps residue above 1e-12 below its
  // diagonal. The Schur path gives an error of 1.5e-12 and the Newton path 7e-15; the
  // Newton result agrees with the Schur result, so it is kept.
  it('a graded matrix·2^40 keeps the Newton accuracy', () => {
    const G = [
      [3212169.3124976046, -660700.232568496, -14134.602758667621, 3716.585283999683],
      [-660700.232568496, 468928.2308662234, 72105.44239057656, -30523.52264561726],
      [-14134.602758667621, 72105.44239057656, 20995.950544789375, -12345.20289383199],
      [3716.585283999683, -30523.522645617257, -12345.20289383199, 11302.887047334152],
    ];
    // mpmath, 40 digits: logm(G) + 40·ln 2·I.
    const ref = [
      [42.633077807776715, -0.5361915791649691, 0.13287986665238535, -0.023380260261963697],
      [-0.5361915791649691, 40.37254703170481, 0.8343429107864396, -0.14592072172390894],
      [0.13287986665238535, 0.8343429107864396, 36.03847181704347, -1.177954563668173],
      [-0.023380260261963683, -0.14592072172390885, -1.177954563668173, 36.31096871467894],
    ];
    const r = nested(matrixLogm(DenseMatrix.fromArray(scale(G, 2 ** 40))));
    expect(maxDiff(r, ref)).toBeLessThan(1e-13);
  });

  it.each([0, 50, 120])('logm(A·2^%i) = logm(A) + k·ln 2·I', (k) => {
    const r = nested(matrixLogm(DenseMatrix.fromArray(scale(A, 2 ** k))));
    const want = ref.map((row, i) => row.map((v, j) => (i === j ? v + k * Math.LN2 : v)));
    expect(maxDiff(r, want)).toBeLessThan(1e-8);
  });
});

describe('#1125 qr of dependent columns', () => {
  it('the zero matrix has R = 0 and a finite Q', () => {
    const { Q, R } = qr(DenseMatrix.zeros(2, 2));
    expect(nested(R)).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(nested(Q).flat().every(Number.isFinite)).toBe(true);
  });

  // Column 3 = column 1 + column 2. The rank is 2 at each magnitude below 1.
  it.each([1, 2 ** -10, 2 ** -19])('a dependent column at %p gives R[2][2] = 0 to 1e-14', (f) => {
    const A = scale(
      [
        [1, 2, 3],
        [4, 5, 9],
        [7, 8.5, 15.5],
      ],
      f
    );
    const { Q, R } = qr(DenseMatrix.fromArray(A));
    const q = nested(Q);
    const r = nested(R);
    expect(maxDiff(mul(q, r), A) / maxAbs(A)).toBeLessThan(1e-14);
    expect(Math.abs(r[2][2]) / maxAbs(A)).toBeLessThan(1e-14);
    expect(
      maxDiff(mul(transpose(q), q), [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
    ).toBeLessThan(1e-12);
  });
});

describe.each([
  ['JS path', false],
  ['AssemblyScript path', true],
])('#1123 WASMBackend decompositions (%s)', (_name, useWasm) => {
  const backend = new WASMBackend();
  let ready = false;
  const init = async (): Promise<void> => {
    if (!ready) {
      if (useWasm) await backend.initialize();
      ready = true;
    }
  };
  const base = [
    [3, 1],
    [4, 2],
  ];

  // Without the binary, `initialize()` falls back to the JS path and the AssemblyScript
  // cases would pass on it. The build makes matrix/dist/wasm/mathts-as.wasm.
  it(`the AssemblyScript module is ${useWasm ? 'loaded' : 'not loaded'}`, async () => {
    await init();
    const mod = (backend as unknown as { wasmModule: Record<string, unknown> | null }).wasmModule;
    if (!useWasm) {
      expect(mod).toBeNull();
      return;
    }
    expect(
      mod,
      'WASMBackend.initialize() fell back to JS: run `bun run build` from the repo root'
    ).not.toBeNull();
    for (const name of ['matrix_lu_decompose', 'matrix_qr_decompose', 'matrix_inverse']) {
      expect(typeof mod?.[name], `${name} exported by the AS binary`).toBe('function');
    }
  });

  it.each([1e-100, 1e-15, 1e-8, 3e200])(
    'qr of [[3,1],[4,2]]·%p: Q^T·R = A, R triangular',
    async (s) => {
      await init();
      const A = scale(base, s);
      const { q, r } = await backend.qrDecomposition(DenseMatrix.fromArray(A));
      const Q = nested(q);
      const R = nested(r);
      // The backend returns Q^T in `q` (A = q^T · r).
      expect(maxDiff(mul(transpose(Q), R), A) / maxAbs(A)).toBeLessThan(1e-14);
      expect(
        maxDiff(mul(transpose(Q), Q), [
          [1, 0],
          [0, 1],
        ])
      ).toBeLessThan(1e-14);
      expect(Math.abs(R[1][0]) / maxAbs(A)).toBeLessThan(1e-14);
      // NumPy: |R| = [[5, 2.2], [0, 0.4]]·s
      expect(Math.abs(R[0][0]) / s).toBeCloseTo(5, 12);
      expect(Math.abs(R[1][1]) / s).toBeCloseTo(0.4, 12);
    }
  );

  it.each([1e-100, 1e-15, 3e200])('lu of the matrix·%p is regular and P·A = L·U', async (s) => {
    await init();
    const A = scale(base, s);
    const { lu, perm, singular } = await backend.luDecomposition(DenseMatrix.fromArray(A));
    expect(singular).toBe(false);
    const LU = nested(lu);
    const L = LU.map((row, i) => row.map((v, j) => (i > j ? v : i === j ? 1 : 0)));
    const U = LU.map((row, i) => row.map((v, j) => (i <= j ? v : 0)));
    const PA = Array.from(perm).map((p) => A[p]);
    expect(maxDiff(mul(L, U), PA) / maxAbs(A)).toBeLessThan(1e-14);
  });

  it.each([1e-100, 1e-15, 3e200])('inverse of the matrix·%p is the SciPy inverse', async (s) => {
    await init();
    const { inverse, singular } = await backend.inverse(DenseMatrix.fromArray(scale(base, s)));
    expect(singular).toBe(false);
    const inv = nested(inverse);
    // inv([[3,1],[4,2]]) = [[1,-0.5],[-2,1.5]]
    const ref = [
      [1, -0.5],
      [-2, 1.5],
    ];
    expect(maxDiff(scale(inv, s), ref)).toBeLessThan(1e-13);
  });

  it('an ordinary matrix is not changed', async () => {
    await init();
    const A = [
      [2, -1, 0],
      [-1, 2, -1],
      [0, -1, 2],
    ];
    const { q, r } = await backend.qrDecomposition(DenseMatrix.fromArray(A));
    expect(maxDiff(mul(transpose(nested(q)), nested(r)), A)).toBeLessThan(1e-14);
    expect((await backend.luDecomposition(DenseMatrix.fromArray(A))).singular).toBe(false);
  });

  it('a singular matrix is still singular', async () => {
    await init();
    const rank1 = [
      [1, 2, 3],
      [2, 4, 6],
      [3, 6, 9],
    ];
    for (const f of [1, 1e-100, 1e100]) {
      const r = await backend.luDecomposition(DenseMatrix.fromArray(scale(rank1, f)));
      expect(r.singular).toBe(true);
    }
  });

  // The JS path tested the pivots 0 to n-2 only: `singular: false` and an inverse of NaN.
  it.each([
    [
      '[[1,2],[2,4]]',
      [
        [1, 2],
        [2, 4],
      ],
    ],
    ['[[0]]', [[0]]],
    [
      '[[2,1,3],[4,2,6],[1,5,2]] (rows 1 and 2 dependent)',
      [
        [2, 1, 3],
        [4, 2, 6],
        [1, 5, 2],
      ],
    ],
  ])('a last pivot of 0 is singular: %s', async (_label, A) => {
    await init();
    for (const f of [1, 1e-100, 1e100]) {
      const M = DenseMatrix.fromArray(scale(A, f));
      expect((await backend.luDecomposition(M)).singular).toBe(true);
      const inv = await backend.inverse(M);
      expect(inv.singular).toBe(true);
      expect(
        nested(inv.inverse)
          .flat()
          .every((v) => v === 0)
      ).toBe(true);
    }
  });

  // The JS path gave `singular: false` from 2^10 and the AssemblyScript path `true`.
  it.each([0, 4, 10, 100, 300, 500])('a rank-1 matrix·2^%i is singular', async (k) => {
    await init();
    const rank1 = [
      [0.1, 0.3, 0.7],
      [0.2, 0.6, 1.4],
      [0.3, 0.9, 2.1],
    ];
    const M = DenseMatrix.fromArray(scale(rank1, 2 ** k));
    expect((await backend.luDecomposition(M)).singular).toBe(true);
    expect((await backend.inverse(M)).singular).toBe(true);
  });

  it('the determinant keeps a last pivot below the floor', async () => {
    await init();
    const det = (m: number[][]): Promise<number> =>
      backend.determinantWasm(DenseMatrix.fromArray(m));
    expect(
      await det([
        [1, 0],
        [0, 1e-15],
      ])
    ).toBe(1e-15);
    expect(
      Math.abs(
        await det([
          [1, 2],
          [2, 4],
        ])
      )
    ).toBe(0);
  });
});
