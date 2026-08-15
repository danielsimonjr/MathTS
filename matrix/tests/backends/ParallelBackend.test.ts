import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ParallelBackend,
  createParallelBackend,
  parallelBackend,
} from '../../src/backends/ParallelBackend.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';

describe('ParallelBackend', () => {
  let backend: ParallelBackend;

  beforeAll(async () => {
    // Create a backend with a low threshold to ensure parallel paths are taken
    backend = new ParallelBackend({ parallelThreshold: 0 });
    await backend.initialize();
  });

  afterAll(async () => {
    await backend.terminate();
  });

  describe('availability and lifecycle', () => {
    it('should be available', () => {
      expect(backend.isAvailable()).toBe(true);
    });

    it('should be ready after initialization', () => {
      expect(backend.isReady()).toBe(true);
    });

    it('should have type "parallel"', () => {
      expect(backend.type).toBe('parallel');
    });

    it('should initialize and terminate cleanly', async () => {
      const tempBackend = new ParallelBackend();
      expect(tempBackend.isReady()).toBe(false);
      await tempBackend.initialize();
      expect(tempBackend.isReady()).toBe(true);
      await tempBackend.terminate();
      expect(tempBackend.isReady()).toBe(false);
    });

    it('should provide stats', () => {
      const stats = backend.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('element-wise operations (parallel)', () => {
    it('should add matrices', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);
      const c = await backend.add(a, b);
      expect(c.toArray()).toEqual([
        [6, 8],
        [10, 12],
      ]);
    });

    it('should subtract matrices', async () => {
      const a = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);
      const b = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const c = await backend.subtract(a, b);
      expect(c.toArray()).toEqual([
        [4, 4],
        [4, 4],
      ]);
    });

    it('should multiply element-wise', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [2, 3],
        [4, 5],
      ]);
      const c = await backend.multiplyElementwise(a, b);
      expect(c.toArray()).toEqual([
        [2, 6],
        [12, 20],
      ]);
    });

    it('should divide element-wise', async () => {
      const a = DenseMatrix.fromArray([
        [4, 9],
        [16, 25],
      ]);
      const b = DenseMatrix.fromArray([
        [2, 3],
        [4, 5],
      ]);
      const c = await backend.divideElementwise(a, b);
      expect(c.toArray()).toEqual([
        [2, 3],
        [4, 5],
      ]);
    });

    it('should scale by scalar', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const c = await backend.scale(a, 3);
      expect(c.toArray()).toEqual([
        [3, 6],
        [9, 12],
      ]);
    });

    it('should compute absolute value (sequential)', () => {
      const a = DenseMatrix.fromArray([
        [-1, 2],
        [3, -4],
      ]);
      const c = backend.abs(a);
      expect(c.toArray()).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it('should negate matrix (sequential)', () => {
      const a = DenseMatrix.fromArray([
        [1, -2],
        [-3, 4],
      ]);
      const c = backend.negate(a);
      expect(c.toArray()).toEqual([
        [-1, 2],
        [3, -4],
      ]);
    });

    it('should throw on dimension mismatch for add', async () => {
      const a = DenseMatrix.zeros(2, 3);
      const b = DenseMatrix.zeros(3, 2);
      await expect(backend.add(a, b)).rejects.toThrow();
    });
  });

  describe('matrix operations (parallel)', () => {
    it('should multiply square matrices', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);
      const c = await backend.multiply(a, b);
      expect(c.toArray()).toEqual([
        [19, 22],
        [43, 50],
      ]);
    });

    it('should transpose matrix', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      const t = await backend.transpose(a);
      expect(t.toArray()).toEqual([
        [1, 4],
        [2, 5],
        [3, 6],
      ]);
    });

    it('should throw on incompatible dimensions for multiply', async () => {
      const a = DenseMatrix.zeros(2, 3);
      const b = DenseMatrix.zeros(2, 3);
      await expect(backend.multiply(a, b)).rejects.toThrow();
    });
  });

  describe('reduction operations (parallel)', () => {
    it('should compute sum', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      expect(await backend.sum(a)).toBe(10);
    });

    it('should sum along axis 0 (columns, sequential)', () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      const colSums = backend.sumAxis(a, 0);
      expect(colSums.toFlatArray()).toEqual([5, 7, 9]);
    });

    it('should sum along axis 1 (rows, sequential)', () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      const rowSums = backend.sumAxis(a, 1);
      expect(rowSums.toFlatArray()).toEqual([6, 15]);
    });

    it('should compute Frobenius norm (sequential)', () => {
      const a = DenseMatrix.fromArray([[3, 4]]);
      expect(backend.norm(a)).toBe(5);
    });

    it('should compute dot product of vectors', async () => {
      const a = DenseMatrix.fromArray([[1, 2, 3]]);
      const b = DenseMatrix.fromArray([[4, 5, 6]]);
      expect(await backend.dot(a, b)).toBe(32);
    });

    it('should throw on non-vector dot product', async () => {
      const a = DenseMatrix.zeros(2, 2);
      const b = DenseMatrix.zeros(2, 2);
      await expect(backend.dot(a, b)).rejects.toThrow();
    });

    it('should throw on mismatched vector lengths for dot product', async () => {
      const a = DenseMatrix.fromArray([[1, 2, 3]]);
      const b = DenseMatrix.fromArray([[1, 2]]);
      await expect(backend.dot(a, b)).rejects.toThrow();
    });
  });

  describe('fallback to sequential execution', () => {
    let sequentialBackend: ParallelBackend;

    beforeAll(async () => {
      // Create a backend with a very high threshold to force sequential execution
      sequentialBackend = new ParallelBackend({ parallelThreshold: 10000 });
      await sequentialBackend.initialize();
    });

    afterAll(async () => {
      await sequentialBackend.terminate();
    });

    it('should fallback for add', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);
      const c = await sequentialBackend.add(a, b);
      expect(c.toArray()).toEqual([
        [6, 8],
        [10, 12],
      ]);
    });

    it('should fallback for multiply', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);
      const c = await sequentialBackend.multiply(a, b);
      expect(c.toArray()).toEqual([
        [19, 22],
        [43, 50],
      ]);
    });

    it('should fallback for divideElementwise', async () => {
      const a = DenseMatrix.fromArray([
        [4, 9],
        [16, 25],
      ]);
      const b = DenseMatrix.fromArray([
        [2, 3],
        [4, 5],
      ]);
      const c = await sequentialBackend.divideElementwise(a, b);
      expect(c.toArray()).toEqual([
        [2, 3],
        [4, 5],
      ]);
    });

    it('should fallback for dot', async () => {
      const a = DenseMatrix.fromArray([[1, 2, 3]]);
      const b = DenseMatrix.fromArray([[4, 5, 6]]);
      expect(await sequentialBackend.dot(a, b)).toBe(32);
    });
  });

  describe('factory and default instance', () => {
    it('should have a default parallelBackend instance', () => {
      expect(parallelBackend).toBeDefined();
      expect(parallelBackend.type).toBe('parallel');
    });

    it('should create a backend with createParallelBackend', () => {
      const customBackend = createParallelBackend({ parallelThreshold: 500 });
      expect(customBackend).toBeDefined();
      expect(customBackend.type).toBe('parallel');
    });
  });
});
