import { mulberry32 } from '../util.mjs';

export const entry = '@danielsimonjr/mathts-functions';

function numArr(n, seed) {
  const r = mulberry32(seed);
  const a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = r() * 2 - 1;
  return a;
}

export const cases = [
  {
    name: 'add number[] n = 1,000',
    kind: 'neutral',
    make: (F) => {
      const a = numArr(1000, 0xa001);
      const b = numArr(1000, 0xa002);
      return () => F.add(a, b);
    },
  },
  {
    name: 'dotMultiply n = 1,000 (control)',
    kind: 'neutral',
    make: (F) => {
      const a = numArr(1000, 0xd001);
      const b = numArr(1000, 0xd002);
      return () => F.dotMultiply(a, b);
    },
  },
];
