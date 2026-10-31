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
    name: 'add number[] n = 1',
    kind: 'gain',
    make: (F) => {
      const a = numArr(1, 0xa001);
      const b = numArr(1, 0xa002);
      return () => F.add(a, b);
    },
  },
  {
    name: 'add number[] n = 10',
    kind: 'gain',
    make: (F) => {
      const a = numArr(10, 0xa010);
      const b = numArr(10, 0xa011);
      return () => F.add(a, b);
    },
  },
  {
    name: 'add number[] n = 1,000',
    kind: 'gain',
    make: (F) => {
      const a = numArr(1000, 0xa001);
      const b = numArr(1000, 0xa002);
      return () => F.add(a, b);
    },
  },
  {
    name: 'subtract number[] n = 1,000',
    kind: 'gain',
    make: (F) => {
      const a = numArr(1000, 0xb001);
      const b = numArr(1000, 0xb002);
      return () => F.subtract(a, b);
    },
  },
  {
    name: 'multiply(number[], number) n = 1,000',
    kind: 'gain',
    make: (F) => {
      const a = numArr(1000, 0xc001);
      return () => F.multiply(a, 1.5);
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
  {
    name: 'add(number, number) (control)',
    kind: 'neutral',
    make: (F) => () => F.add(1.5, 2.5),
  },
];
