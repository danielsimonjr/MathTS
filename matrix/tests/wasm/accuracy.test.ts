/**
 * WASM Decomposition Accuracy Tests
 *
 * Tests that WASM matrix decompositions (LU, QR, Cholesky) produce
 * correct results within numerical precision.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { WASMBackend, createWASMBackend } from '../../src/backends/WASMBackend.js';

describe('WASM Decomposition Accuracy', () => {
  let wasmBackend: WASMBackend;

  // Helper to create a test matrix
  function createMatrix(rows: number, cols: number, fill: (i: number, j: number) => number): DenseMatrix {
    const data: number[][] = [];
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        row.push(fill(i, j));
      }
      data.push(row);
    }
    return new DenseMatrix(rows, cols, data);
  }

  // Helper to create a random matrix
  function randomMatrix(rows: number, cols: number): DenseMatrix {
    return createMatrix(rows, cols, () => Math.random() * 10 - 5);
  }

  // Helper to create a symmetric positive-definite matrix
  function createSPDMatrix(n: number): DenseMatrix {
    // Create A^T * A which is always positive semi-definite
    // Add nI to ensure positive definite
    const a = randomMatrix(n, n);
    const at = DenseMatrix.fromFlat(n, n, Array.from(a.toFloat64Array()));

    // Manual A^T * A + nI computation
    const data = new Float64Array(n * n);
    const aData = a.toFloat64Array();

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += aData[k * n + i] * aData[k * n + j];
        }
        data[i * n + j] = sum + (i === j ? n : 0);
      }
    }

    return DenseMatrix.fromFlat(n, n, Array.from(data));
  }

  // Matrix multiplication helper
  function multiply(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const m = a.rows;
    const n = b.cols;
    const k = a.cols;
    const result = new Float64Array(m * n);
    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let l = 0; l < k; l++) {
          sum += aData[i * k + l] * bData[l * n + j];
        }
        result[i * n + j] = sum;
      }
    }

    return DenseMatrix.fromFlat(m, n, Array.from(result));
  }

  // Compute Frobenius norm of difference
  function normDiff(a: DenseMatrix, b: DenseMatrix): number {
    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();
    let sum = 0;
    for (let i = 0; i < aData.length; i++) {
      const diff = aData[i] - bData[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  // Frobenius norm
  function norm(a: DenseMatrix): number {
    const data = a.toFloat64Array();
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum);
  }

  // Create identity matrix
  function identity(n: number): DenseMatrix {
    const data = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      data[i * n + i] = 1.0;
    }
    return DenseMatrix.fromFlat(n, n, Array.from(data));
  }

  beforeAll(async () => {
    wasmBackend = createWASMBackend({ minElements: 0 });
    if (wasmBackend.isAvailable()) {
      await wasmBackend.initialize();
    }
  });

  describe('LU Decomposition', () => {
    it('should produce correct L and U factors for 3x3 matrix', async () => {
      // Create a non-singular 3x3 matrix
      const a = createMatrix(3, 3, (i, j) => (i + 1) * (j + 1) + (i === j ? 5 : 0));

      const { lu, perm, singular } = await wasmBackend.luDecomposition(a);
      expect(singular).toBe(false);

      // Extract L and U from combined LU matrix
      const n = 3;
      const luData = lu.toFloat64Array();
      const l = new Float64Array(n * n);
      const u = new Float64Array(n * n);

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i > j) {
            l[i * n + j] = luData[i * n + j];
          } else if (i === j) {
            l[i * n + j] = 1.0;
            u[i * n + j] = luData[i * n + j];
          } else {
            u[i * n + j] = luData[i * n + j];
          }
        }
      }

      // Verify L * U ≈ P * A
      const lMat = DenseMatrix.fromFlat(n, n, Array.from(l));
      const uMat = DenseMatrix.fromFlat(n, n, Array.from(u));
      const product = multiply(lMat, uMat);

      // Apply permutation to A
      const aData = a.toFloat64Array();
      const paData = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          paData[i * n + j] = aData[perm[i] * n + j];
        }
      }
      const pa = DenseMatrix.fromFlat(n, n, Array.from(paData));

      const diff = normDiff(product, pa);
      expect(diff).toBeLessThan(1e-10);
    });

    it('should detect singular matrix', async () => {
      // Create a singular matrix (row 2 = row 1)
      const a = createMatrix(3, 3, (i, j) => {
        if (i === 2) return (1) * (j + 1);
        return (i + 1) * (j + 1);
      });

      const { singular } = await wasmBackend.luDecomposition(a);
      expect(singular).toBe(true);
    });

    it('should handle larger matrices', async () => {
      const n = 10;
      const a = randomMatrix(n, n);

      const { lu, perm, singular } = await wasmBackend.luDecomposition(a);

      if (!singular) {
        // Extract L and U
        const luData = lu.toFloat64Array();
        const l = new Float64Array(n * n);
        const u = new Float64Array(n * n);

        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (i > j) {
              l[i * n + j] = luData[i * n + j];
            } else if (i === j) {
              l[i * n + j] = 1.0;
              u[i * n + j] = luData[i * n + j];
            } else {
              u[i * n + j] = luData[i * n + j];
            }
          }
        }

        const lMat = DenseMatrix.fromFlat(n, n, Array.from(l));
        const uMat = DenseMatrix.fromFlat(n, n, Array.from(u));
        const product = multiply(lMat, uMat);

        const aData = a.toFloat64Array();
        const paData = new Float64Array(n * n);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            paData[i * n + j] = aData[perm[i] * n + j];
          }
        }
        const pa = DenseMatrix.fromFlat(n, n, Array.from(paData));

        const relError = normDiff(product, pa) / norm(pa);
        expect(relError).toBeLessThan(1e-10);
      }
    });
  });

  describe('QR Decomposition', () => {
    it('should produce orthogonal Q and upper triangular R', async () => {
      const a = createMatrix(4, 3, (i, j) => (i + 1) * (j + 1) + i - j);

      const { q, r } = await wasmBackend.qrDecomposition(a);

      // The implementation returns Q^T, so Q^T * Q should be identity
      const m = q.rows;
      const qData = q.toFloat64Array();

      // Compute Q * Q^T (since Q is actually Q^T from the Householder algorithm)
      const qqtData = new Float64Array(m * m);
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
          let sum = 0;
          for (let k = 0; k < m; k++) {
            sum += qData[i * m + k] * qData[j * m + k];
          }
          qqtData[i * m + j] = sum;
        }
      }
      const qqt = DenseMatrix.fromFlat(m, m, Array.from(qqtData));
      const id = identity(m);

      const orthogError = normDiff(qqt, id);
      expect(orthogError).toBeLessThan(1e-10);

      // Verify Q^T * R ≈ A (Q is stored as Q^T)
      // First transpose Q
      const qtData = new Float64Array(m * m);
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
          qtData[i * m + j] = qData[j * m + i];
        }
      }
      const qt = DenseMatrix.fromFlat(m, m, Array.from(qtData));
      const product = multiply(qt, r);
      const relError = normDiff(product, a) / norm(a);
      expect(relError).toBeLessThan(1e-10);

      // Verify R is upper triangular
      const rData = r.toFloat64Array();
      const n = r.cols;
      for (let i = 0; i < r.rows; i++) {
        for (let j = 0; j < Math.min(i, n); j++) {
          expect(Math.abs(rData[i * n + j])).toBeLessThan(1e-10);
        }
      }
    });

    it('should handle square matrices', async () => {
      const n = 5;
      const a = randomMatrix(n, n);

      const { q, r } = await wasmBackend.qrDecomposition(a);

      // The implementation returns Q^T, so transpose it
      const qData = q.toFloat64Array();
      const qtData = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          qtData[i * n + j] = qData[j * n + i];
        }
      }
      const qt = DenseMatrix.fromFlat(n, n, Array.from(qtData));

      // Verify Q^T * R ≈ A
      const product = multiply(qt, r);
      const relError = normDiff(product, a) / norm(a);
      expect(relError).toBeLessThan(1e-9);
    });
  });

  describe('Cholesky Decomposition', () => {
    it('should produce L such that A = L * L^T', async () => {
      const a = createSPDMatrix(4);

      const { l, positiveDefinite } = await wasmBackend.choleskyDecomposition(a);
      expect(positiveDefinite).toBe(true);

      // Compute L * L^T
      const n = l.rows;
      const lData = l.toFloat64Array();
      const lltData = new Float64Array(n * n);

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let sum = 0;
          for (let k = 0; k < n; k++) {
            sum += lData[i * n + k] * lData[j * n + k];
          }
          lltData[i * n + j] = sum;
        }
      }
      const llt = DenseMatrix.fromFlat(n, n, Array.from(lltData));

      const relError = normDiff(llt, a) / norm(a);
      expect(relError).toBeLessThan(1e-10);

      // Verify L is lower triangular
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          expect(Math.abs(lData[i * n + j])).toBeLessThan(1e-14);
        }
      }
    });

    it('should detect non-positive-definite matrix', async () => {
      // Create a non-positive-definite matrix
      const a = createMatrix(3, 3, (i, j) => {
        if (i === j) return -1; // Negative diagonal makes it not positive-definite
        return 0;
      });

      const { positiveDefinite } = await wasmBackend.choleskyDecomposition(a);
      expect(positiveDefinite).toBe(false);
    });
  });

  describe('Matrix Inversion', () => {
    it('should compute inverse such that A * inv(A) = I', async () => {
      const a = createMatrix(3, 3, (i, j) => (i + 1) * (j + 2) + (i === j ? 5 : 0));

      const { inverse, singular } = await wasmBackend.inverse(a);
      expect(singular).toBe(false);

      // Verify A * inv(A) ≈ I
      const product = multiply(a, inverse);
      const n = a.rows;
      const id = identity(n);

      const error = normDiff(product, id);
      expect(error).toBeLessThan(1e-10);
    });

    it('should compute inverse correctly for larger matrices', async () => {
      const n = 8;
      const a = createMatrix(n, n, (i, j) => {
        // Create a well-conditioned matrix
        return Math.random() * 2 - 1 + (i === j ? n : 0);
      });

      const { inverse, singular } = await wasmBackend.inverse(a);

      if (!singular) {
        const product = multiply(a, inverse);
        const id = identity(n);

        const relError = normDiff(product, id) / norm(id);
        expect(relError).toBeLessThan(1e-8);
      }
    });

    it('should detect singular matrix for inversion', async () => {
      // Create a singular matrix
      const a = createMatrix(3, 3, (i, j) => {
        if (i === 2) return (1 + 1) * (j + 1); // Row 2 = Row 0 * 2
        return (i + 1) * (j + 1);
      });

      const { singular } = await wasmBackend.inverse(a);
      expect(singular).toBe(true);
    });
  });

  describe('Determinant', () => {
    it('should compute correct determinant for 2x2 matrix', async () => {
      // Simple 2x2: [[2, 3], [1, 4]] => det = 2*4 - 3*1 = 5
      const a = createMatrix(2, 2, (i, j) => {
        const data = [[2, 3], [1, 4]];
        return data[i][j];
      });

      const det = await wasmBackend.determinantWasm(a);
      expect(Math.abs(det - 5)).toBeLessThan(1e-10);
    });

    it('should compute correct determinant for diagonal matrix', async () => {
      // Diagonal matrix: det = product of diagonal elements
      const a = createMatrix(3, 3, (i, j) => (i === j ? i + 2 : 0));
      // diag = [2, 3, 4], det = 2*3*4 = 24

      const det = await wasmBackend.determinantWasm(a);
      expect(Math.abs(det - 24)).toBeLessThan(1e-10);
    });

    it('should return 0 for singular matrix', async () => {
      // Row 2 = Row 0, making it singular
      const a = createMatrix(3, 3, (i, j) => {
        if (i === 2) return (0 + 1) * (j + 1); // Row 2 = Row 0
        return (i + 1) * (j + 1);
      });

      const det = await wasmBackend.determinantWasm(a);
      expect(Math.abs(det)).toBeLessThan(1e-10);
    });

    it('should handle identity matrix (det = 1)', async () => {
      const n = 5;
      const a = identity(n);

      const det = await wasmBackend.determinantWasm(a);
      expect(Math.abs(det - 1)).toBeLessThan(1e-10);
    });

    it('should handle upper triangular matrix', async () => {
      // Upper triangular: det = product of diagonal
      const a = createMatrix(3, 3, (i, j) => {
        if (i <= j) return i + j + 1;
        return 0;
      });
      // diag = [1, 3, 5], det = 15

      const det = await wasmBackend.determinantWasm(a);
      expect(Math.abs(det - 15)).toBeLessThan(1e-10);
    });
  });
});
