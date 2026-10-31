import { randomMatrix } from './helpers.mjs';

export const entry = '@danielsimonjr/mathts-functions';

/** @param {typeof import('@danielsimonjr/mathts-functions')} F @param {number} rows @param {number} cols @param {number} seed */
function qrCase(F, rows, cols, seed) {
  const A = randomMatrix(rows, cols, seed);
  return () => F.qr(A);
}

/** @param {typeof import('@danielsimonjr/mathts-functions')} F @param {number} n @param {number} seed */
function qrSquare(F, n, seed) {
  return qrCase(F, n, n, seed);
}

export const cases = [
  { name: 'qr 2×2', kind: 'gain', make: (F) => qrSquare(F, 2, 0x71002) },
  { name: 'qr 8×8', kind: 'gain', make: (F) => qrSquare(F, 8, 0x71008) },
  { name: 'qr 32×32', kind: 'gain', make: (F) => qrSquare(F, 32, 0x71032) },
  { name: 'qr 128×128', kind: 'gain', make: (F) => qrSquare(F, 128, 0x71128) },
  { name: 'qr 60×20', kind: 'gain', make: (F) => qrCase(F, 60, 20, 0x716020) },
  { name: 'qr 20×60', kind: 'gain', make: (F) => qrCase(F, 20, 60, 0x712060) },
  {
    name: 'qr edge values 16×16',
    kind: 'gain',
    make: (F) => () => {
      const A = randomMatrix(16, 16, 0x711616);
      A[0][0] = NaN;
      A[1][1] = 0;
      A[2][2] = -0;
      A[3][3] = Infinity;
      return F.qr(A);
    },
  },
  {
    name: 'qr singular 24×24',
    kind: 'gain',
    make: (F) => () => {
      const A = randomMatrix(24, 24, 0x712424);
      for (let i = 0; i < 24; i++) A[i][23] = A[i][0];
      return F.qr(A);
    },
  },
  {
    name: 'qr DenseMatrix 32×32',
    kind: 'gain',
    make: (F) => () => F.qr(F.matrix(randomMatrix(32, 32, 0x71032))),
  },
  {
    name: 'qr Complex 8×8 (fallback)',
    kind: 'neutral',
    make: (F) => () => {
      const A = randomMatrix(8, 8, 0x71c808);
      return F.qr(
        A.map((row, i) =>
          row.map((re, j) => F.complex(re, randomMatrix(1, 1, 0x71c900 + i * 8 + j)[0][0]))
        )
      );
    },
  },
  {
    name: 'det 128×128 (control)',
    kind: 'neutral',
    make: (F) => () => F.det(randomMatrix(128, 128, 0x99128)),
  },
];
