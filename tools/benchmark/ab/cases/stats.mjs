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
    name: 'median n = 11',
    kind: 'gain',
    pr: 'P7-7',
    make: (F) => {
      const a = numArr(11, 0x7ed00b);
      return () => F.median(a);
    },
  },
  {
    name: 'median n = 1,000',
    kind: 'gain',
    pr: 'P7-7',
    make: (F) => {
      const a = numArr(1000, 0x7ed3e8);
      return () => F.median(a);
    },
  },
  {
    name: 'median n = 1,001',
    kind: 'gain',
    pr: 'P7-7',
    make: (F) => {
      const a = numArr(1001, 0x7ed3e9);
      return () => F.median(a);
    },
  },
  {
    name: 'median n = 100,000',
    kind: 'gain',
    pr: 'P7-7',
    make: (F) => {
      const a = numArr(100_000, 0x7ed001);
      return () => F.median(a);
    },
  },
  {
    name: 'median with NaN n = 10,000',
    kind: 'gain',
    pr: 'P7-7',
    make: (F) => {
      const a = numArr(10_000, 0x7e0a01);
      a[5000] = NaN;
      return () => F.median(a);
    },
  },
  {
    name: 'quantileSeq(a, 0.3) n = 10,000',
    kind: 'gain',
    pr: 'P7-7',
    make: (F) => {
      const r = mulberry32(0x7e3001);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = r() * 1000;
      return () => F.quantileSeq(a, 0.3);
    },
  },
  {
    name: 'mad n = 10,000',
    kind: 'gain',
    pr: 'P7-7',
    make: (F) => {
      const a = numArr(10_000, 0x7ead01);
      return () => F.mad(a);
    },
  },
  {
    name: 'partitionSelect n = 1,000',
    kind: 'gain',
    pr: 'P7-7',
    make: (F) => {
      const a = numArr(1000, 0x7e5001);
      return () => F.partitionSelect(a.slice(), 500);
    },
  },
  {
    name: 'median BigNumber n = 200 (fallback)',
    kind: 'neutral',
    pr: 'P7-7',
    make: (F) => {
      const a = numArr(200, 0x7eb200).map((x) => F.bignumber(x));
      return () => F.median(a);
    },
  },
  {
    name: 'sort n = 100',
    kind: 'gain',
    pr: 'P7-9',
    make: (F) => {
      const a = numArr(100, 0x590064);
      return () => F.sort(a.slice());
    },
  },
  {
    name: 'sort n = 100,000',
    kind: 'gain',
    pr: 'P7-9',
    make: (F) => {
      const a = numArr(100_000, 0x50b001);
      return () => F.sort(a.slice());
    },
  },
  {
    name: 'sort Matrix n = 1,000',
    kind: 'gain',
    pr: 'P7-9',
    make: (F) => {
      const m = F.matrix(numArr(1000, 0x5903e8));
      return () => F.sort(m);
    },
  },
  {
    name: 'sort desc n = 100',
    kind: 'neutral',
    pr: 'P7-9',
    make: (F) => {
      const a = numArr(100, 0x59d064);
      return () => F.sort(a.slice(), 'desc');
    },
  },
  {
    name: 'sort desc n = 100,000',
    kind: 'neutral',
    pr: 'P7-9',
    make: (F) => {
      const a = numArr(100_000, 0x59d001);
      return () => F.sort(a.slice(), 'desc');
    },
  },
  {
    name: 'sort BigNumber n = 200 (fallback)',
    kind: 'neutral',
    pr: 'P7-9',
    make: (F) => {
      const a = numArr(200, 0x59b200).map((x) => F.bignumber(x));
      return () => F.sort(a.slice());
    },
  },
  {
    name: 'mode n = 10,000 (control)',
    kind: 'neutral',
    control: true,
    make: (F) => {
      const r = mulberry32(0x0de001);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = Math.floor(r() * 100);
      return () => F.mode(a);
    },
  },
];
