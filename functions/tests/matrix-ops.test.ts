import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  characteristicPolynomial,
  rowReduce,
  matrixRank,
  cholesky,
  hessenbergForm,
  matrixPower,
  matrixLog,
  polarDecomposition,
  jordanForm,
} from '../src/typed/matrix-ops.js';
import { computePool } from '@danielsimonjr/mathts-parallel';

// =============================================================================
// Helpers
// =============================================================================

/** Check two matrices are approximately equal. */
function expectMatrixClose(A: number[][], B: number[][], tol = 1e-8) {
  expect(A.length).toBe(B.length);
  for (let i = 0; i < A.length; i++) {
    expect(A[i].length).toBe(B[i].length);
    for (let j = 0; j < A[i].length; j++) {
      expect(A[i][j]).toBeCloseTo(B[i][j], -Math.log10(tol));
    }
  }
}

/** Check an array is approximately equal to expected. */
function expectArrayClose(a: number[], b: number[], tol = 1e-8) {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(a[i]).toBeCloseTo(b[i], -Math.log10(tol));
  }
}

/** Matrix multiply helper for test verification. */
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const p = A[0].length;
  const n = B[0].length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < p; k++) {
      for (let j = 0; j < n; j++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

/** Transpose helper for test verification. */
function transpose(A: number[][]): number[][] {
  return A[0].map((_, j) => A.map((row) => row[j]));
}

// =============================================================================
// 1. characteristicPolynomial
// =============================================================================

describe('characteristicPolynomial', () => {
  it('should compute characteristic polynomial of 2x2 matrix', async () => {
    // [[2,1],[1,2]] -> lambda^2 - 4*lambda + 3 -> [3, -4, 1]
    const coeffs = await characteristicPolynomial([
      [2, 1],
      [1, 2],
    ]);
    expectArrayClose(coeffs, [3, -4, 1]);
  });

  it('should compute characteristic polynomial of identity', async () => {
    // 2x2 identity -> lambda^2 - 2*lambda + 1 -> [1, -2, 1]
    const coeffs = await characteristicPolynomial([
      [1, 0],
      [0, 1],
    ]);
    expectArrayClose(coeffs, [1, -2, 1]);
  });

  it('should compute characteristic polynomial of 3x3 matrix', async () => {
    // [[1,0,0],[0,2,0],[0,0,3]] -> (lambda-1)(lambda-2)(lambda-3)
    // = lambda^3 - 6*lambda^2 + 11*lambda - 6
    // coeffs in ascending: [-6, 11, -6, 1]
    const coeffs = await characteristicPolynomial([
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]);
    expectArrayClose(coeffs, [-6, 11, -6, 1]);
  });

  it('should handle 1x1 matrix', async () => {
    const coeffs = await characteristicPolynomial([[5]]);
    expectArrayClose(coeffs, [-5, 1]);
  });

  it('should throw for non-square matrix', async () => {
    await expect(
      characteristicPolynomial([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ).rejects.toThrow('square');
  });
});

// =============================================================================
// 2. rowReduce
// =============================================================================

describe('rowReduce', () => {
  it('should compute RREF of rank-deficient matrix', () => {
    const rref = rowReduce([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expectMatrixClose(rref, [
      [1, 0, -1],
      [0, 1, 2],
      [0, 0, 0],
    ]);
  });

  it('should compute RREF of identity', () => {
    const rref = rowReduce([
      [1, 0],
      [0, 1],
    ]);
    expectMatrixClose(rref, [
      [1, 0],
      [0, 1],
    ]);
  });

  it('should handle zero matrix', () => {
    const rref = rowReduce([
      [0, 0],
      [0, 0],
    ]);
    expectMatrixClose(rref, [
      [0, 0],
      [0, 0],
    ]);
  });

  it('should handle non-square matrix', () => {
    const rref = rowReduce([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expectMatrixClose(rref, [
      [1, 0, -1],
      [0, 1, 2],
    ]);
  });

  it('should handle augmented system', () => {
    // [1 1 | 3]  -> [1 0 | 1]
    // [1 2 | 5]     [0 1 | 2]
    const rref = rowReduce([
      [1, 1, 3],
      [1, 2, 5],
    ]);
    expectMatrixClose(rref, [
      [1, 0, 1],
      [0, 1, 2],
    ]);
  });

  it('should return empty for empty matrix', () => {
    expect(rowReduce([])).toEqual([]);
  });
});

// =============================================================================
// 3. matrixRank
// =============================================================================

describe('matrixRank', () => {
  it('should return 1 for rank-1 matrix', () => {
    expect(
      matrixRank([
        [1, 2],
        [2, 4],
      ])
    ).toBe(1);
  });

  it('should return 2 for full-rank 2x2', () => {
    expect(
      matrixRank([
        [1, 0],
        [0, 1],
      ])
    ).toBe(2);
  });

  it('should return 2 for rank-2 3x3', () => {
    expect(
      matrixRank([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ])
    ).toBe(2);
  });

  it('should return 0 for zero matrix', () => {
    expect(
      matrixRank([
        [0, 0],
        [0, 0],
      ])
    ).toBe(0);
  });

  it('should handle non-square matrix', () => {
    expect(
      matrixRank([
        [1, 0, 0],
        [0, 1, 0],
      ])
    ).toBe(2);
  });
});

// =============================================================================
// 4. cholesky
// =============================================================================

describe('cholesky', () => {
  it('should decompose 2x2 SPD matrix', () => {
    const { L } = cholesky([
      [4, 2],
      [2, 3],
    ]);
    expect(L[0][0]).toBeCloseTo(2, 10);
    expect(L[0][1]).toBeCloseTo(0, 10);
    expect(L[1][0]).toBeCloseTo(1, 10);
    expect(L[1][1]).toBeCloseTo(Math.sqrt(2), 10);
  });

  it('should satisfy A = L * L^T', () => {
    const A = [
      [4, 2],
      [2, 3],
    ];
    const { L } = cholesky(A);
    const LLt = matMul(L, transpose(L));
    expectMatrixClose(LLt, A, 1e-10);
  });

  it('should decompose 3x3 SPD matrix', () => {
    const A = [
      [4, 12, -16],
      [12, 37, -43],
      [-16, -43, 98],
    ];
    const { L } = cholesky(A);
    const LLt = matMul(L, transpose(L));
    expectMatrixClose(LLt, A, 1e-10);
  });

  it('should decompose identity', () => {
    const { L } = cholesky([
      [1, 0],
      [0, 1],
    ]);
    expectMatrixClose(L, [
      [1, 0],
      [0, 1],
    ]);
  });

  it('should throw for non-symmetric matrix', () => {
    expect(() =>
      cholesky([
        [1, 2],
        [3, 4],
      ])
    ).toThrow('symmetric');
  });

  it('should throw for non-positive-definite matrix', () => {
    expect(() =>
      cholesky([
        [-1, 0],
        [0, 1],
      ])
    ).toThrow('positive definite');
  });
});

// =============================================================================
// 5. hessenbergForm
// =============================================================================

describe('hessenbergForm', () => {
  it('should produce upper Hessenberg matrix', () => {
    const A = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const { H } = hessenbergForm(A);

    // Check zeros below subdiagonal
    for (let i = 2; i < 3; i++) {
      for (let j = 0; j < i - 1; j++) {
        expect(Math.abs(H[i][j])).toBeLessThan(1e-10);
      }
    }
  });

  it('should satisfy A = Q * H * Q^T', () => {
    const A = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const { H, Q } = hessenbergForm(A);
    const QHQt = matMul(matMul(Q, H), transpose(Q));
    expectMatrixClose(QHQt, A, 1e-10);
  });

  it('should produce orthogonal Q', () => {
    const A = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const { Q } = hessenbergForm(A);
    const QtQ = matMul(transpose(Q), Q);
    const I = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    expectMatrixClose(QtQ, I, 1e-10);
  });

  it('should handle diagonal matrix (already Hessenberg)', () => {
    const A = [
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ];
    const { H, Q } = hessenbergForm(A);
    // H should be essentially the same as A
    const QHQt = matMul(matMul(Q, H), transpose(Q));
    expectMatrixClose(QHQt, A, 1e-10);
  });

  it('should handle 2x2 matrix (no transformation needed)', () => {
    const A = [
      [3, 1],
      [2, 4],
    ];
    const { H, Q } = hessenbergForm(A);
    const QHQt = matMul(matMul(Q, H), transpose(Q));
    expectMatrixClose(QHQt, A, 1e-10);
  });
});

// =============================================================================
// 6. matrixPower
// =============================================================================

describe('matrixPower', () => {
  it('should compute positive integer power', async () => {
    const result = await matrixPower(
      [
        [1, 1],
        [0, 1],
      ],
      3
    );
    expectMatrixClose(result, [
      [1, 3],
      [0, 1],
    ]);
  });

  it('should return identity for p=0', async () => {
    const result = await matrixPower(
      [
        [5, 3],
        [2, 7],
      ],
      0
    );
    expectMatrixClose(result, [
      [1, 0],
      [0, 1],
    ]);
  });

  it('should return copy for p=1', async () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const result = await matrixPower(A, 1);
    expectMatrixClose(result, A);
  });

  it('should compute inverse for p=-1', async () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const Ainv = await matrixPower(A, -1);
    const product = matMul(A, Ainv);
    expectMatrixClose(product, [
      [1, 0],
      [0, 1],
    ]);
  });

  it('should compute negative integer power', async () => {
    const A = [
      [1, 1],
      [0, 1],
    ];
    const result = await matrixPower(A, -2);
    // A^{-1} = [[1,-1],[0,1]], A^{-2} = [[1,-2],[0,1]]
    expectMatrixClose(result, [
      [1, -2],
      [0, 1],
    ]);
  });

  it('should compute square root of diagonal matrix', async () => {
    const result = await matrixPower(
      [
        [4, 0],
        [0, 9],
      ],
      0.5
    );
    expectMatrixClose(
      result,
      [
        [2, 0],
        [0, 3],
      ],
      1e-6
    );
  });

  it('should throw for singular matrix with negative power', async () => {
    await expect(
      matrixPower(
        [
          [1, 0],
          [0, 0],
        ],
        -1
      )
    ).rejects.toThrow('singular');
  });
});

// =============================================================================
// 7. matrixLog
// =============================================================================

describe('matrixLog', () => {
  it('should compute log of identity as zero matrix', async () => {
    const result = await matrixLog([
      [1, 0],
      [0, 1],
    ]);
    expectMatrixClose(
      result,
      [
        [0, 0],
        [0, 0],
      ],
      1e-10
    );
  });

  it('should compute log of upper triangular near-identity', async () => {
    // exp([[0,1],[0,0]]) = [[1,1],[0,1]]
    // so log([[1,1],[0,1]]) should be [[0,1],[0,0]]
    const result = await matrixLog([
      [1, 1],
      [0, 1],
    ]);
    expectMatrixClose(
      result,
      [
        [0, 1],
        [0, 0],
      ],
      1e-8
    );
  });

  it('should compute log of diagonal matrix', async () => {
    const result = await matrixLog([
      [Math.E, 0],
      [0, Math.E * Math.E],
    ]);
    expectMatrixClose(
      result,
      [
        [1, 0],
        [0, 2],
      ],
      1e-6
    );
  });

  it('should throw for matrix with non-positive eigenvalues', async () => {
    await expect(
      matrixLog([
        [-1, 0],
        [0, 1],
      ])
    ).rejects.toThrow();
  });
});

// =============================================================================
// 8. polarDecomposition
// =============================================================================

describe('polarDecomposition', () => {
  it('should decompose diagonal matrix', async () => {
    const { U, P } = await polarDecomposition([
      [2, 0],
      [0, 3],
    ]);
    // U should be close to identity, P close to the original
    const product = matMul(U, P);
    expectMatrixClose(
      product,
      [
        [2, 0],
        [0, 3],
      ],
      1e-10
    );
  });

  it('should produce orthogonal U', async () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const { U } = await polarDecomposition(A);
    const UtU = matMul(transpose(U), U);
    expectMatrixClose(
      UtU,
      [
        [1, 0],
        [0, 1],
      ],
      1e-8
    );
  });

  it('should produce symmetric positive semi-definite P', async () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const { P } = await polarDecomposition(A);
    // P should be symmetric
    expectMatrixClose(P, transpose(P), 1e-8);
  });

  it('should satisfy A = U * P', async () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const { U, P } = await polarDecomposition(A);
    const product = matMul(U, P);
    expectMatrixClose(product, A, 1e-8);
  });

  it('should handle identity matrix', async () => {
    const { U, P } = await polarDecomposition([
      [1, 0],
      [0, 1],
    ]);
    expectMatrixClose(
      U,
      [
        [1, 0],
        [0, 1],
      ],
      1e-10
    );
    expectMatrixClose(
      P,
      [
        [1, 0],
        [0, 1],
      ],
      1e-10
    );
  });
});

// =============================================================================
// 9. jordanForm
// =============================================================================

describe('jordanForm', () => {
  it('should handle diagonal matrix with distinct eigenvalues', async () => {
    const { J } = await jordanForm([
      [2, 0],
      [0, 3],
    ]);
    // J should be diagonal with eigenvalues 2 and 3 (in some order)
    const diag = [J[0][0], J[1][1]].sort();
    expect(diag[0]).toBeCloseTo(2, 6);
    expect(diag[1]).toBeCloseTo(3, 6);
    // Off-diagonals should be zero
    expect(Math.abs(J[0][1])).toBeLessThan(1e-6);
    expect(Math.abs(J[1][0])).toBeLessThan(1e-6);
  });

  it('should handle identity matrix', async () => {
    const { J } = await jordanForm([
      [1, 0],
      [0, 1],
    ]);
    expectMatrixClose(
      J,
      [
        [1, 0],
        [0, 1],
      ],
      1e-6
    );
  });

  it('should handle 3x3 diagonal matrix', async () => {
    const { J } = await jordanForm([
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]);
    const diag = [J[0][0], J[1][1], J[2][2]].sort();
    expect(diag[0]).toBeCloseTo(1, 6);
    expect(diag[1]).toBeCloseTo(2, 6);
    expect(diag[2]).toBeCloseTo(3, 6);
  });

  it('should handle matrix with repeated eigenvalue (2x2 Jordan block)', async () => {
    // [[2,1],[0,2]] has eigenvalue 2 with algebraic mult 2, geometric mult 1
    const { J } = await jordanForm([
      [2, 1],
      [0, 2],
    ]);
    // J should have 2 on diagonal
    expect(J[0][0]).toBeCloseTo(2, 6);
    expect(J[1][1]).toBeCloseTo(2, 6);
    // Should have a 1 on the superdiagonal (Jordan block)
    expect(Math.abs(J[0][1])).toBeCloseTo(1, 4);
  });
});

// =============================================================================
// Parallel matmul path
//
// The decomposition tests above use tiny matrices that never cross the worker
// dispatch threshold. These exercise the parallel matmul path with the
// threshold lowered, and check it agrees with the sequential path.
// =============================================================================

// De-flake note: these three tests dispatch real work to the worker pool. The
// values are deterministic (a parallel matmul/decomposition agrees with the
// sequential path to the stated tolerance regardless of how chunks are
// scheduled), so the only load-sensitive failure mode is the wall-clock cost of
// the worker round-trip: under heavy concurrent CPU contention the pool spin-up
// and chunk dispatch can exceed Vitest's 5000ms per-test default. The pool is
// awaited ready in beforeAll, and the hooks + worker-dispatch tests carry an
// explicit, generous timeout so a slow-but-correct parallel run is not killed
// mid-flight. No assertion or tolerance is changed.
const POOL_HOOK_TIMEOUT = 120_000;
const PARALLEL_TEST_TIMEOUT = 60_000;

describe('matrix-ops parallel matmul path', () => {
  // A 24x24 diagonally dominant (well-conditioned) matrix.
  const n = 24;
  const A = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? n + 2 : 1 / (1 + Math.abs(i - j))))
  );

  let seqPow: number[][];
  let seqChar: number[];
  let seqPolarP: number[][];

  beforeAll(async () => {
    // Pool not yet initialized -> sequential reference values.
    seqPow = await matrixPower(A, 5);
    seqChar = await characteristicPolynomial(A);
    seqPolarP = (await polarDecomposition(A)).P;

    await computePool.initialize();
    // n*n = 576 -> crosses this lowered threshold and offloads to workers.
    computePool.updateConfig({ thresholdElements: 100, chunkSize: 256 });
  }, POOL_HOOK_TIMEOUT);

  afterAll(async () => {
    computePool.updateConfig({ thresholdElements: 50000, chunkSize: 10000 });
    await computePool.terminate();
  }, POOL_HOOK_TIMEOUT);

  it(
    'matrixPower agrees with the sequential path',
    async () => {
      const parPow = await matrixPower(A, 5);
      expectMatrixClose(parPow, seqPow, 1e-9);
    },
    PARALLEL_TEST_TIMEOUT
  );

  it(
    'characteristicPolynomial agrees with the sequential path',
    async () => {
      const parChar = await characteristicPolynomial(A);
      expectArrayClose(parChar, seqChar, 1e-6);
    },
    PARALLEL_TEST_TIMEOUT
  );

  it(
    'polarDecomposition agrees with the sequential path',
    async () => {
      const parPolar = await polarDecomposition(A);
      expectMatrixClose(parPolar.P, seqPolarP, 1e-9);
    },
    PARALLEL_TEST_TIMEOUT
  );
});
