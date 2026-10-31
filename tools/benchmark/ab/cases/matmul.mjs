import { randomMatrix } from './helpers.mjs';

export const entry = '@danielsimonjr/mathts-matrix';

export const cases = [
  {
    name: 'DenseMatrix multiply 128×128',
    kind: 'neutral',
    make: (M) => {
      const { DenseMatrix } = M;
      const A = new DenseMatrix(randomMatrix(128, 128, 0xma128));
      const B = new DenseMatrix(randomMatrix(128, 128, 0xmb128));
      return () => A.multiply(B);
    },
  },
];
