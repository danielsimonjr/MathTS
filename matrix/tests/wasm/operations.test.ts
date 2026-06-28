/**
 * WASM Operations Tests
 *
 * Tests that WASM matrix operations produce correct results
 * compared to the JS reference implementation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { jsBackend } from '../../src/backends/JSBackend.js';
import { WASMBackend, createWASMBackend } from '../../src/backends/WASMBackend.js';

describe('WASM Operations', () => {
  let wasmBackend: WASMBackend;
  let wasmBackendSIMD: WASMBackend;

  // Helper to create a test matrix
  function createMatrix(
    rows: number,
    cols: number,
    fill?: (i: number, j: number) => number
  ): DenseMatrix {
    const data: number[][] = [];
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        row.push(fill ? fill(i, j) : Math.random() * 10);
      }
      data.push(row);
    }
    return new DenseMatrix(rows, cols, data);
  }

  // Helper to compare matrices within tolerance
  function expectMatrixClose(actual: DenseMatrix, expected: DenseMatrix, tolerance = 1e-10): void {
    expect(actual.rows).toBe(expected.rows);
    expect(actual.cols).toBe(expected.cols);

    for (let i = 0; i < actual.rows; i++) {
      for (let j = 0; j < actual.cols; j++) {
        const diff = Math.abs(actual.get(i, j) - expected.get(i, j));
        expect(diff).toBeLessThan(tolerance);
      }
    }
  }

  beforeAll(async () => {
    // Create backend with minimum elements set to 0 to always use WASM
    wasmBackend = createWASMBackend({ minElements: 0, useSIMD: false });
    wasmBackendSIMD = createWASMBackend({ minElements: 0, useSIMD: true });

    // Initialize if WASM is available
    if (wasmBackend.isAvailable()) {
      await wasmBackend.initialize();
      await wasmBackendSIMD.initialize();
    }
  });

  describe('Element-wise Addition', () => {
    it('should add matrices correctly', () => {
      const a = createMatrix(10, 10, (i, j) => i + j);
      const b = createMatrix(10, 10, (i, j) => i * j);

      const jsResult = jsBackend.add(a, b);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.add(a, b);
        expectMatrixClose(wasmResult, jsResult);
      }
    });

    it('should add large matrices correctly', () => {
      const a = createMatrix(100, 100);
      const b = createMatrix(100, 100);

      const jsResult = jsBackend.add(a, b);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.add(a, b);
        expectMatrixClose(wasmResult, jsResult);
      }
    });

    it('should add matrices correctly with SIMD', () => {
      const a = createMatrix(100, 100);
      const b = createMatrix(100, 100);

      const jsResult = jsBackend.add(a, b);

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.add(a, b);
        expectMatrixClose(simdResult, jsResult);
      }
    });
  });

  describe('Element-wise Subtraction', () => {
    it('should subtract matrices correctly', () => {
      const a = createMatrix(10, 10, (i, j) => i + j + 5);
      const b = createMatrix(10, 10, (i, j) => i * j);

      const jsResult = jsBackend.subtract(a, b);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.subtract(a, b);
        expectMatrixClose(wasmResult, jsResult);
      }
    });

    it('should subtract large matrices correctly with SIMD', () => {
      const a = createMatrix(100, 100);
      const b = createMatrix(100, 100);

      const jsResult = jsBackend.subtract(a, b);

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.subtract(a, b);
        expectMatrixClose(simdResult, jsResult);
      }
    });
  });

  describe('Element-wise Multiplication', () => {
    it('should multiply matrices element-wise correctly', () => {
      const a = createMatrix(10, 10, (i, _j) => i + 1);
      const b = createMatrix(10, 10, (i, j) => j + 1);

      const jsResult = jsBackend.multiplyElementwise(a, b);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.multiplyElementwise(a, b);
        expectMatrixClose(wasmResult, jsResult);
      }
    });

    it('should multiply element-wise correctly with SIMD', () => {
      const a = createMatrix(100, 100);
      const b = createMatrix(100, 100);

      const jsResult = jsBackend.multiplyElementwise(a, b);

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.multiplyElementwise(a, b);
        expectMatrixClose(simdResult, jsResult);
      }
    });
  });

  describe('Element-wise Division', () => {
    it('should divide matrices element-wise correctly', () => {
      const a = createMatrix(10, 10, (i, j) => (i + 1) * (j + 1));
      const b = createMatrix(10, 10, (i, j) => j + 1); // Avoid zeros

      const jsResult = jsBackend.divideElementwise(a, b);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.divideElementwise(a, b);
        expectMatrixClose(wasmResult, jsResult);
      }
    });

    it('should divide element-wise correctly with SIMD', () => {
      const a = createMatrix(100, 100, () => Math.random() * 10 + 1);
      const b = createMatrix(100, 100, () => Math.random() * 5 + 1); // Avoid zeros

      const jsResult = jsBackend.divideElementwise(a, b);

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.divideElementwise(a, b);
        expectMatrixClose(simdResult, jsResult, 1e-9);
      }
    });
  });

  describe('Scalar Operations', () => {
    it('should scale matrix correctly', () => {
      const a = createMatrix(10, 10, (i, j) => i + j);
      const scalar = 2.5;

      const jsResult = jsBackend.scale(a, scalar);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.scale(a, scalar);
        expectMatrixClose(wasmResult, jsResult);
      }
    });

    it('should scale large matrix correctly with SIMD', () => {
      const a = createMatrix(100, 100);
      const scalar = 3.14159;

      const jsResult = jsBackend.scale(a, scalar);

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.scale(a, scalar);
        expectMatrixClose(simdResult, jsResult);
      }
    });
  });

  describe('Unary Operations', () => {
    it('should compute absolute value correctly', () => {
      const a = createMatrix(10, 10, (i, j) => (i % 2 === 0 ? 1 : -1) * (i + j));

      const jsResult = jsBackend.abs(a);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.abs(a);
        expectMatrixClose(wasmResult, jsResult);
      }
    });

    it('should compute abs correctly with SIMD', () => {
      const a = createMatrix(100, 100, () => (Math.random() - 0.5) * 20);

      const jsResult = jsBackend.abs(a);

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.abs(a);
        expectMatrixClose(simdResult, jsResult);
      }
    });

    it('should negate matrix correctly', () => {
      const a = createMatrix(10, 10, (i, j) => i * j);

      const jsResult = jsBackend.negate(a);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.negate(a);
        expectMatrixClose(wasmResult, jsResult);
      }
    });

    it('should negate correctly with SIMD', () => {
      const a = createMatrix(100, 100);

      const jsResult = jsBackend.negate(a);

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.negate(a);
        expectMatrixClose(simdResult, jsResult);
      }
    });
  });

  describe('Matrix Multiplication', () => {
    it('should multiply matrices correctly', () => {
      const a = createMatrix(10, 8, (i, j) => i + j);
      const b = createMatrix(8, 6, (i, j) => i - j);

      const jsResult = jsBackend.multiply(a, b);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.multiply(a, b);
        expectMatrixClose(wasmResult, jsResult, 1e-9);
      }
    });

    it('should multiply large matrices correctly', () => {
      const a = createMatrix(50, 50);
      const b = createMatrix(50, 50);

      const jsResult = jsBackend.multiply(a, b);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.multiply(a, b);
        expectMatrixClose(wasmResult, jsResult, 1e-8);
      }
    });

    it('should multiply correctly with SIMD', () => {
      const a = createMatrix(50, 50);
      const b = createMatrix(50, 50);

      const jsResult = jsBackend.multiply(a, b);

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.multiply(a, b);
        expectMatrixClose(simdResult, jsResult, 1e-8);
      }
    });
  });

  describe('Matrix Transpose', () => {
    it('should transpose matrix correctly', () => {
      const a = createMatrix(5, 8, (i, j) => i * 10 + j);

      const jsResult = jsBackend.transpose(a);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.transpose(a);
        expectMatrixClose(wasmResult, jsResult);
      }
    });

    it('should transpose large matrix correctly', () => {
      const a = createMatrix(100, 80);

      const jsResult = jsBackend.transpose(a);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.transpose(a);
        expectMatrixClose(wasmResult, jsResult);
      }
    });
  });

  describe('Reduction Operations', () => {
    it('should compute sum correctly', () => {
      const a = createMatrix(10, 10, (i, j) => i + j);

      const jsResult = jsBackend.sum(a) as number;

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.sum(a);
        expect(Math.abs(wasmResult - jsResult)).toBeLessThan(1e-10);
      }
    });

    it('should compute sum correctly with SIMD', () => {
      const a = createMatrix(100, 100);

      const jsResult = jsBackend.sum(a) as number;

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.sum(a);
        expect(Math.abs(simdResult - jsResult)).toBeLessThan(1e-8);
      }
    });

    it('should compute norm correctly', () => {
      const a = createMatrix(10, 10, (i, j) => i + j);

      const jsResult = jsBackend.norm(a);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.norm(a);
        expect(Math.abs(wasmResult - jsResult)).toBeLessThan(1e-10);
      }
    });

    it('should compute norm correctly with SIMD', () => {
      const a = createMatrix(100, 100);

      const jsResult = jsBackend.norm(a);

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.norm(a);
        expect(Math.abs(simdResult - jsResult)).toBeLessThan(1e-8);
      }
    });

    it('should compute dot product correctly', () => {
      const a = createMatrix(1, 100, (_, j) => j);
      const b = createMatrix(1, 100, (_, j) => 100 - j);

      const jsResult = jsBackend.dot(a, b) as number;

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.dot(a, b);
        expect(Math.abs(wasmResult - jsResult)).toBeLessThan(1e-9);
      }
    });

    it('should compute dot product correctly with SIMD', () => {
      const a = createMatrix(1, 1000);
      const b = createMatrix(1, 1000);

      const jsResult = jsBackend.dot(a, b) as number;

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.dot(a, b);
        expect(Math.abs(simdResult - jsResult)).toBeLessThan(1e-7);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle 1x1 matrices', () => {
      const a = new DenseMatrix(1, 1, [[5]]);
      const b = new DenseMatrix(1, 1, [[3]]);

      const jsAdd = jsBackend.add(a, b);
      const jsMul = jsBackend.multiplyElementwise(a, b);

      if (wasmBackend.isAvailable()) {
        const wasmAdd = wasmBackend.add(a, b);
        const wasmMul = wasmBackend.multiplyElementwise(a, b);

        expectMatrixClose(wasmAdd, jsAdd);
        expectMatrixClose(wasmMul, jsMul);
      }
    });

    it('should handle matrices with odd dimensions', () => {
      const a = createMatrix(7, 13);
      const b = createMatrix(7, 13);

      const jsResult = jsBackend.add(a, b);

      if (wasmBackendSIMD.isAvailable()) {
        const simdResult = wasmBackendSIMD.add(a, b);
        expectMatrixClose(simdResult, jsResult);
      }
    });

    it('should handle matrices with zeros', () => {
      const a = createMatrix(10, 10, () => 0);
      const b = createMatrix(10, 10, (i, j) => i + j);

      const jsResult = jsBackend.add(a, b);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.add(a, b);
        expectMatrixClose(wasmResult, jsResult);
      }
    });

    it('should handle negative values', () => {
      const a = createMatrix(10, 10, (i, j) => -i - j);
      const b = createMatrix(10, 10, (i, j) => i * j);

      const jsResult = jsBackend.multiply(a, b);

      if (wasmBackend.isAvailable()) {
        const wasmResult = wasmBackend.multiply(a, b);
        expectMatrixClose(wasmResult, jsResult, 1e-9);
      }
    });
  });
});
