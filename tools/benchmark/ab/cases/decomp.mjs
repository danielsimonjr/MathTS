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
    name: 'det 128×128 (control)',
    kind: 'neutral',
    control: true,
    make: (F) => {
      const A = randomMatrix(128, 128, 0x99128);
      return () => F.det(A);
    },
  },
  { name: 'lup 2×2', kind: 'gain', pr: 'P7-4', make: (F) => () => F.lup(randomMatrix(2, 2, 0x72002)) },
  { name: 'lup 8×8', kind: 'gain', pr: 'P7-4', make: (F) => () => F.lup(randomMatrix(8, 8, 0x72008)) },
  {
    name: 'lup 32×32',
    kind: 'gain',
    pr: 'P7-4',
    make: (F) => () => F.lup(randomMatrix(32, 32, 0x72032)),
  },
  {
    name: 'lup 128×128',
    kind: 'gain',
    pr: 'P7-4',
    make: (F) => () => F.lup(randomMatrix(128, 128, 0x72128)),
  },
  {
    name: 'lup 60×20',
    kind: 'gain',
    pr: 'P7-4',
    make: (F) => () => F.lup(randomMatrix(60, 20, 0x726020)),
  },
  {
    name: 'lup 20×60',
    kind: 'gain',
    pr: 'P7-4',
    make: (F) => () => F.lup(randomMatrix(20, 60, 0x722060)),
  },
  {
    name: 'lup edge values 16×16',
    kind: 'gain',
    pr: 'P7-4',
    make: (F) => {
      const A = randomMatrix(16, 16, 0x721616);
      A[0][0] = NaN;
      A[1][1] = 0;
      A[2][2] = -0;
      A[3][3] = Infinity;
      return () => F.lup(A);
    },
  },
  {
    name: 'lup singular 24×24',
    kind: 'gain',
    pr: 'P7-4',
    make: (F) => {
      const A = randomMatrix(24, 24, 0x722424);
      for (let i = 0; i < 24; i++) A[i][23] = A[i][0];
      return () => F.lup(A);
    },
  },
  {
    name: 'lup DenseMatrix 32×32',
    kind: 'gain',
    pr: 'P7-4',
    make: (F) => {
      const A = F.matrix(randomMatrix(32, 32, 0x72032));
      return () => F.lup(A);
    },
  },
  {
    name: 'lusolve 8×8',
    kind: 'gain',
    pr: 'P7-4',
    make: (F) => {
      const A = randomMatrix(8, 8, 0x72008);
      const b = randomMatrix(8, 1, 0x72081).map((row) => row[0]);
      return () => F.lusolve(A, b);
    },
  },
  {
    name: 'lusolve 128×128',
    kind: 'gain',
    pr: 'P7-4',
    make: (F) => {
      const A = randomMatrix(128, 128, 0x72128);
      const b = randomMatrix(128, 1, 0x721281).map((row) => row[0]);
      return () => F.lusolve(A, b);
    },
  },
  {
    name: 'lup BigNumber 8×8 (fallback)',
    kind: 'neutral',
    pr: 'P7-4',
    make: (F) => {
      const A = randomMatrix(8, 8, 0x72b808).map((row) => row.map((x) => F.bignumber(x)));
      return () => F.lup(A);
    },
  },
];
