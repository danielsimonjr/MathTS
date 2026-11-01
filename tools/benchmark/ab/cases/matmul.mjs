import { randomMatrix } from './helpers.mjs';

export const entry = '@danielsimonjr/mathts-matrix';

function pair(M, n, seedA, seedB) {
  const { DenseMatrix, jsBackend } = M;
  const A = DenseMatrix.fromArray(randomMatrix(n, n, seedA));
  const B = DenseMatrix.fromArray(randomMatrix(n, n, seedB));
  return () => jsBackend.multiply(A, B);
}

export const cases = [
  {
    name: 'JSBackend multiply 8×8',
    kind: 'gain',
    pr: 'P7-8',
    make: (M) => pair(M, 8, 0xa00800, 0xb00800),
  },
  {
    name: 'JSBackend multiply 32×32',
    kind: 'gain',
    pr: 'P7-8',
    make: (M) => pair(M, 32, 0xa03200, 0xb03200),
  },
  {
    name: 'JSBackend multiply 128×128',
    kind: 'gain',
    pr: 'P7-8',
    make: (M) => pair(M, 128, 0xa12800, 0xb12800),
  },
  {
    name: 'JSBackend multiply 16×16 with 0×Infinity and NaN',
    kind: 'gain',
    pr: 'P7-8',
    make: (M) => {
      const { DenseMatrix, jsBackend } = M;
      const A = randomMatrix(16, 16, 0xa01600);
      const B = randomMatrix(16, 16, 0xb01600);
      A[0][0] = 0;
      B[0][0] = Infinity;
      A[1][1] = NaN;
      return () => jsBackend.multiply(DenseMatrix.fromArray(A), DenseMatrix.fromArray(B));
    },
  },
];
