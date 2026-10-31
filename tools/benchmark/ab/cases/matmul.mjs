import { randomMatrix } from './helpers.mjs';

export const entry = '@danielsimonjr/mathts-matrix';

export const cases = [
  {
    name: 'JSBackend multiply 128×128',
    kind: 'gain',
    make: (M) => {
      const { DenseMatrix, jsBackend } = M;
      const A = new DenseMatrix(randomMatrix(128, 128, 0xa12800));
      const B = new DenseMatrix(randomMatrix(128, 128, 0xb12800));
      return () => jsBackend.multiply(A, B);
    },
  },
];
