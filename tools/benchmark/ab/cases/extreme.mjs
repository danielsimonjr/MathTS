import { mulberry32 } from '../util.mjs';

export const entry = '@danielsimonjr/mathts-functions';

export const cases = [
  ...[10, 1_000, 10_000].flatMap((n) => [
    {
      name: `factory_max n = ${n.toLocaleString('en-US')}`,
      kind: 'gain',
      pr: 'P7-3',
      make: (F) => {
        const r = mulberry32(0x7003000 + n);
        const a = new Array(n);
        for (let i = 0; i < n; i++) a[i] = r() * 2000 - 1000;
        return () => F.factory_max(a);
      },
    },
    {
      name: `factory_min n = ${n.toLocaleString('en-US')}`,
      kind: 'gain',
      pr: 'P7-3',
      make: (F) => {
        const r = mulberry32(0x7003100 + n);
        const a = new Array(n);
        for (let i = 0; i < n; i++) a[i] = r() * 2000 - 1000;
        return () => F.factory_min(a);
      },
    },
  ]),
  {
    name: 'factory_max with NaN, n = 10,000',
    kind: 'gain',
    pr: 'P7-3',
    make: (F) => {
      const r = mulberry32(0x7003200);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = r() * 2000 - 1000;
      a[6_000] = NaN;
      return () => F.factory_max(a);
    },
  },
  {
    name: 'factory_min with ±0, n = 10,000',
    kind: 'gain',
    pr: 'P7-3',
    make: (F) => {
      const r = mulberry32(0x7003300);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = 1 + r() * 1000;
      a[2_500] = -0;
      a[5_000] = 0;
      a[7_500] = -0;
      return () => F.factory_min(a);
    },
  },
  {
    name: 'factory_max 2-D 100×100 (generic)',
    kind: 'neutral',
    pr: 'P7-3',
    make: (F) => {
      const r = mulberry32(0x7003400);
      const a = Array.from({ length: 100 }, () => Array.from({ length: 100 }, () => r() * 1000));
      return () => F.factory_max(a);
    },
  },
  {
    name: 'factory_max DenseMatrix 10,000 (generic)',
    kind: 'neutral',
    pr: 'P7-3',
    make: (F) => {
      const r = mulberry32(0x7003500);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = r() * 1000;
      const m = F.matrix(a);
      return () => F.factory_max(m);
    },
  },
  {
    name: 'factory_max BigNumber n = 200 (fallback)',
    kind: 'neutral',
    pr: 'P7-3',
    make: (F) => {
      const r = mulberry32(0x7003600);
      const a = new Array(200);
      for (let i = 0; i < a.length; i++) a[i] = F.bignumber(String(1 + Math.floor(r() * 1000)));
      return () => F.factory_max(a);
    },
  },
  {
    name: 'factory_max Fraction at 150 (fallback)',
    kind: 'neutral',
    pr: 'P7-3',
    make: (F) => {
      const r = mulberry32(0x7003700);
      const a = new Array(200);
      for (let i = 0; i < a.length; i++) a[i] = Math.floor(r() * 1000);
      a[150] = F.fraction(1, 3);
      return () => F.factory_max(a);
    },
  },
  {
    name: 'prod n = 10',
    kind: 'gain',
    pr: 'P7-2',
    make: (F) => {
      const r = mulberry32(0x7002010);
      const a = new Array(10);
      for (let i = 0; i < a.length; i++) a[i] = 0.5 + r() * 0.5;
      return () => F.prod(a);
    },
  },
  {
    name: 'prod n = 10,000',
    kind: 'gain',
    pr: 'P7-2',
    make: (F) => {
      const r = mulberry32(0x700d000);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = 0.999 + r() * 0.002;
      return () => F.prod(a);
    },
  },
  {
    name: 'prod BigNumber n = 200 (fallback)',
    kind: 'neutral',
    pr: 'P7-2',
    make: (F) => {
      const a = new Array(200);
      for (let i = 0; i < a.length; i++) a[i] = F.bignumber('1.001');
      return () => F.prod(a);
    },
  },
  {
    name: 'prod Fraction at 1 (fallback)',
    kind: 'neutral',
    pr: 'P7-2',
    make: (F) => {
      const a = new Array(200).fill(1);
      a[1] = F.fraction(1, 2);
      return () => F.prod(a);
    },
  },
  {
    name: 'prod Fraction last (fallback)',
    kind: 'neutral',
    pr: 'P7-2',
    make: (F) => {
      const a = new Array(200);
      for (let i = 0; i < 199; i++) a[i] = 2;
      a[199] = F.fraction(1, 2);
      return () => F.prod(a);
    },
  },
];
