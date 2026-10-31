import { randomMatrix } from './helpers.mjs';

export const entry = '@danielsimonjr/mathts-functions';

/** @param {typeof import('@danielsimonjr/mathts-functions')} F @param {number} n @param {number} seed */
function qrCase(F, n, seed) {
  const A = randomMatrix(n, n, seed);
  return () => F.qr(A);
}

export const cases = [
  { name: 'qr 128×128', kind: 'neutral', make: (F) => qrCase(F, 128, 0x71128) },
  { name: 'qr 32×32', kind: 'neutral', make: (F) => qrCase(F, 32, 0x71032) },
  { name: 'qr 8×8', kind: 'neutral', make: (F) => qrCase(F, 8, 0x71008) },
  {
    name: 'lup 128×128',
    kind: 'neutral',
    make: (F) => () => F.lup(randomMatrix(128, 128, 0x42128)),
  },
  {
    name: 'lusolve 128×128',
    kind: 'neutral',
    make: (F) => () => {
      const A = randomMatrix(128, 128, 0x53128);
      const b = randomMatrix(128, 1, 0x53129).map((r) => r[0]);
      return F.lusolve(A, b);
    },
  },
  {
    name: 'det 128×128 (control)',
    kind: 'neutral',
    make: (F) => () => F.det(randomMatrix(128, 128, 0x99128)),
  },
];
