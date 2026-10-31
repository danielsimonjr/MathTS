import { randomMatrix } from './helpers.mjs';

export const entry = '@danielsimonjr/mathts-functions';

/** @param {typeof import('@danielsimonjr/mathts-functions')} F @param {number} rows @param {number} cols @param {number} seed */
function qrCase(F, rows, cols, seed) {
  const A = randomMatrix(rows, cols, seed);
  return () => F.qr(A);
}

export const cases = [
  { name: 'qr 2×2', kind: 'gain', pr: 'P7-1', make: (F) => qrCase(F, 2, 2, 0x71002) },
  { name: 'qr 8×8', kind: 'gain', pr: 'P7-1', make: (F) => qrCase(F, 8, 8, 0x71008) },
  { name: 'qr 32×32', kind: 'gain', pr: 'P7-1', make: (F) => qrCase(F, 32, 32, 0x71032) },
  { name: 'qr 128×128', kind: 'gain', pr: 'P7-1', make: (F) => qrCase(F, 128, 128, 0x71128) },
  { name: 'qr 60×20', kind: 'gain', pr: 'P7-1', make: (F) => qrCase(F, 60, 20, 0x716020) },
  { name: 'qr 20×60', kind: 'gain', pr: 'P7-1', make: (F) => qrCase(F, 20, 60, 0x712060) },
  {
    name: 'qr edge values 16×16',
    kind: 'gain',
    pr: 'P7-1',
    make: (F) => {
      const A = randomMatrix(16, 16, 0x711616);
      A[0][0] = NaN;
      A[1][1] = 0;
      A[2][2] = -0;
      A[3][3] = Infinity;
      return () => F.qr(A);
    },
  },
  {
    name: 'qr singular 24×24',
    kind: 'gain',
    pr: 'P7-1',
    make: (F) => {
      const A = randomMatrix(24, 24, 0x712424);
      for (let i = 0; i < 24; i++) A[i][23] = A[i][0];
      return () => F.qr(A);
    },
  },
  {
    name: 'qr DenseMatrix 32×32',
    kind: 'gain',
    pr: 'P7-1',
    make: (F) => {
      const A = F.matrix(randomMatrix(32, 32, 0x71032));
      return () => F.qr(A);
    },
  },
  {
    name: 'qr Complex 8×8 (fallback)',
    kind: 'neutral',
    pr: 'P7-1',
    make: (F) => {
      const re = randomMatrix(8, 8, 0x71c808);
      const im = randomMatrix(8, 8, 0x71c909);
      const A = re.map((row, i) => row.map((x, j) => F.complex(x, im[i][j])));
      return () => F.qr(A);
    },
  },
  {
    name: 'lup 128×128',
    kind: 'neutral',
    make: (F) => {
      const A = randomMatrix(128, 128, 0x42128);
      return () => F.lup(A);
    },
  },
  {
    name: 'lusolve 128×128',
    kind: 'neutral',
    make: (F) => {
      const A = randomMatrix(128, 128, 0x53128);
      const b = randomMatrix(128, 1, 0x53129).map((r) => r[0]);
      return () => F.lusolve(A, b);
    },
  },
  {
    name: 'det 128×128 (control)',
    kind: 'neutral',
    control: true,
    make: (F) => {
      const A = randomMatrix(128, 128, 0x99128);
      return () => F.det(A);
    },
  },
];
