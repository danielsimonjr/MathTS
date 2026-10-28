/**
 * Oracle tests for ParallelBackend sequential fallbacks (M6).
 * Expected values come from jsBackend / DenseMatrix methods, not duplicated loops.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ParallelBackend } from '../../src/backends/ParallelBackend.js';
import { jsBackend } from '../../src/backends/JSBackend.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';

describe('ParallelBackend fallback oracle (M6)', () => {
  /** Forces sequential path even when the pool is initialized. */
  let sequentialOnly: ParallelBackend;
  /** Pool ready with threshold 0 — parallel path when initialized. */
  let parallelReady: ParallelBackend;

  beforeAll(async () => {
    sequentialOnly = new ParallelBackend({ parallelThreshold: 1_000_000 });
    await sequentialOnly.initialize();
    parallelReady = new ParallelBackend({ parallelThreshold: 0 });
    await parallelReady.initialize();
  });

  afterAll(async () => {
    await sequentialOnly.terminate();
    await parallelReady.terminate();
  });

  describe('divideElementwise', () => {
    it('matches jsBackend on 0×0', async () => {
      const a = DenseMatrix.zeros(0, 0);
      const b = DenseMatrix.zeros(0, 0);
      const expected = jsBackend.divideElementwise(a, b);
      expect((await sequentialOnly.divideElementwise(a, b)).toArray()).toEqual(expected.toArray());
    });

    it('matches jsBackend on 1×1 including divide-by-zero', async () => {
      const a = DenseMatrix.fromArray([[1]]);
      const b = DenseMatrix.fromArray([[0]]);
      const expected = jsBackend.divideElementwise(a, b);
      const got = await sequentialOnly.divideElementwise(a, b);
      expect(got.get(0, 0)).toBe(expected.get(0, 0));
      expect(Number.isFinite(got.get(0, 0))).toBe(false);
    });

    it('matches jsBackend on NaN and Infinity', async () => {
      const a = DenseMatrix.fromArray([[NaN, Infinity, 1]]);
      const b = DenseMatrix.fromArray([[1, 0, 0]]);
      const expected = jsBackend.divideElementwise(a, b);
      expect((await sequentialOnly.divideElementwise(a, b)).toFlatArray()).toEqual(
        expected.toFlatArray()
      );
    });

    it('throws the same dimension error as jsBackend', async () => {
      const a = DenseMatrix.zeros(2, 3);
      const b = DenseMatrix.zeros(3, 2);
      await expect(sequentialOnly.divideElementwise(a, b)).rejects.toThrow(
        'Matrix dimensions must match: 2×3 vs 3×2'
      );
      expect(() => jsBackend.divideElementwise(a, b)).toThrow(
        'Matrix dimensions must match: 2×3 vs 3×2'
      );
    });

    it('matches jsBackend when parallel threshold is met but pool path agrees', async () => {
      const a = DenseMatrix.fromArray([
        [4, 9],
        [16, 25],
      ]);
      const b = DenseMatrix.fromArray([
        [2, 3],
        [4, 5],
      ]);
      const expected = jsBackend.divideElementwise(a, b);
      expect((await parallelReady.divideElementwise(a, b)).toArray()).toEqual(expected.toArray());
    });
  });

  describe('dot', () => {
    it('matches jsBackend for column vectors', async () => {
      const a = DenseMatrix.fromArray([[1], [2], [3]]);
      const b = DenseMatrix.fromArray([[4], [5], [6]]);
      expect(await sequentialOnly.dot(a, b)).toBe(jsBackend.dot(a, b));
      expect(await sequentialOnly.dot(a, b)).toBe(32);
    });

    it('matches jsBackend for row vectors', async () => {
      const a = DenseMatrix.fromArray([[1, 2, 3]]);
      const b = DenseMatrix.fromArray([[4, 5, 6]]);
      expect(await sequentialOnly.dot(a, b)).toBe(jsBackend.dot(a, b));
    });

    it('throws on non-vector dot product', async () => {
      const a = DenseMatrix.zeros(2, 2);
      const b = DenseMatrix.zeros(2, 2);
      await expect(sequentialOnly.dot(a, b)).rejects.toThrow('Dot product requires two vectors');
    });

    it('throws on length mismatch', async () => {
      const a = DenseMatrix.fromArray([[1, 2, 3]]);
      const b = DenseMatrix.fromArray([[1, 2]]);
      await expect(sequentialOnly.dot(a, b)).rejects.toThrow('Vector lengths must match: 3 vs 2');
    });
  });

  describe('scale, multiply, transpose, sum', () => {
    it('scale matches DenseMatrix.scale below threshold', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      expect((await sequentialOnly.scale(a, -2)).toArray()).toEqual(a.scale(-2).toArray());
    });

    it('multiply matches DenseMatrix.multiply for non-square factors', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      const b = DenseMatrix.fromArray([
        [1, 0],
        [0, 1],
        [1, 1],
      ]);
      expect((await sequentialOnly.multiply(a, b)).toArray()).toEqual(a.multiply(b).toArray());
    });

    it('transpose matches DenseMatrix.transpose', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect((await sequentialOnly.transpose(a)).toArray()).toEqual(a.transpose().toArray());
    });

    it('sum matches DenseMatrix.sum including empty matrix', async () => {
      const empty = DenseMatrix.zeros(0, 0);
      expect(await sequentialOnly.sum(empty)).toBe(empty.sum());
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      expect(await sequentialOnly.sum(a)).toBe(a.sum());
    });

    it('parallel paths match sequential oracle for scale and sum', async () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect(await parallelReady.sum(a)).toBe(a.sum());
      expect((await parallelReady.scale(a, 0.5)).toArray()).toEqual(a.scale(0.5).toArray());
    });
  });
});
