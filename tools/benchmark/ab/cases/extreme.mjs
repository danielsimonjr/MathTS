import { mulberry32 } from '../util.mjs';

export const entry = '@danielsimonjr/mathts-functions';

export const cases = [
  {
    name: 'factory_max n = 10,000',
    kind: 'neutral',
    make: (F) => {
      const r = mulberry32(0xf000a);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = r() * 1000;
      return () => F.max(a);
    },
  },
  {
    name: 'prod n = 10,000',
    kind: 'neutral',
    make: (F) => {
      const r = mulberry32(0x700d000);
      const a = new Array(10_000);
      for (let i = 0; i < a.length; i++) a[i] = 0.999 + r() * 0.002;
      return () => F.prod(a);
    },
  },
];
