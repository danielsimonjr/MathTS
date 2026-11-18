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
    'qr of [[3,1],[4,2]]·%s: Q^T·R = A, R triangular',
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

  it.each([1e-100, 1e-15, 3e200])('lu of the matrix·%s is regular and P·A = L·U', async (s) => {
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

  it.each([1e-100, 1e-15, 3e200])('inverse of the matrix·%s is the SciPy inverse', async (s) => {
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
