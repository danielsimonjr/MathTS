import { mulberry32 } from '../util.mjs';

export const entry = '@danielsimonjr/mathts-functions';

export const cases = [
  {
    name: 'median n = 100,000',
    kind: 'gain',
    make: (F) => {
<<<<<<< HEAD
      const r = mulberry32(0x5ed001);
      const a = new Float64Array(100_000);
=======
      const r = mulberry32(0x7ed001);
      const a = new Array(100_000);
>>>>>>> b7ce901b (feat(functions): number comparator path for partitionSelect/median (P7-7))
      for (let i = 0; i < a.length; i++) a[i] = r() * 2 - 1;
      return () => F.median(a);
    },
  },
  {
    name: 'median with NaN n = 10,000',
    kind: 'gain',
    make: (F) => {
      const r = mulberry32(0x7e0a01);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = r();
      a[5000] = NaN;
      return () => F.median(a);
    },
  },
  {
    name: 'quantileSeq(a, 0.3) n = 10,000',
    kind: 'gain',
    make: (F) => {
      const r = mulberry32(0x7e3001);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = r() * 1000;
      return () => F.quantileSeq(a, 0.3);
    },
  },
  {
    name: 'sort n = 100,000',
    kind: 'gain',
    make: (F) => {
      const r = mulberry32(0x50b001);
      const a = new Array(100_000);
      for (let i = 0; i < a.length; i++) a[i] = r() * 1e6;
      return () => F.sort(a.slice());
    },
  },
  {
    name: 'mode n = 10,000 (control)',
    kind: 'neutral',
    make: (F) => {
      const r = mulberry32(0x0de001);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = Math.floor(r() * 100);
      return () => F.mode(a);
    },
  },
];
