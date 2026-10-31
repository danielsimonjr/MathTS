import { mulberry32 } from '../util.mjs';

export const entry = '@danielsimonjr/mathts-functions';

export const cases = [
  {
    name: 'median n = 100,000',
    kind: 'neutral',
    make: (F) => {
      const r = mulberry32(0xmed001);
      const a = new Float64Array(100_000);
      for (let i = 0; i < a.length; i++) a[i] = r() * 2 - 1;
      return () => F.median(Array.from(a));
    },
  },
  {
    name: 'mode n = 10,000 (control)',
    kind: 'neutral',
    make: (F) => {
      const r = mulberry32(0xmode01);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = Math.floor(r() * 100);
      return () => F.mode(a);
    },
  },
];
