/**
 * ComputePool — additional coverage for the worker-dispatched (parallel) paths
 * and helper methods not exercised by ComputePool.test.ts.
 *
 * These drive REAL worker_threads (the workerpool runs Node workers in the
 * Vitest runtime — see the 1M-element divide/pow tests in ComputePool.test.ts)
 * so the parallel branches of pow/sign/tensordot/bitwise execute, plus the
 * fan-out helpers (integrateFanOut, distributionSampleFanOut), fftBatch,
 * distanceMatrix, applyKernel/applyKernel2, prod, exec and the workerCount
 * getter. Every assertion checks the parallel result against a sequential
 * oracle; the long-running cases rely on the test timeout as the hang guard.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ComputePool } from '../src/ComputePool.js';

describe('ComputePool — parallel paths and helpers', () => {
  let pool: ComputePool;

  beforeAll(async () => {
    // Low global threshold + 'always' overrides so even tiny inputs take the
    // worker-dispatched branch. Small chunkSize forces multi-chunk fan-out.
    pool = new ComputePool({
      maxWorkers: 3,
      thresholdElements: 4,
      chunkSize: 8,
      thresholdByOp: { pow: 'always', sign: 'always', tensordot: 'always' },
    });
    await pool.initialize();
  }, 60_000);

  afterAll(async () => {
    await pool.terminate();
  });

  describe('exec()', () => {
    it('dispatches a raw worker kernel (integrateChunk) and returns the result', async () => {
      // integrateChunk is a registered worker method; verify exec plumbing
      // directly. ∫_0^1 x dx = 1/2 via 2-point Gauss-Legendre (exact for linear).
      const nodes = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)];
      const weights = [1, 1];
      const result = await pool.exec<number>('integrateChunk', [
        '(x) => x',
        0,
        1,
        nodes,
        weights,
      ]);
      expect(result).toBeCloseTo(0.5, 9);
    });
  });

  describe('prod()', () => {
    it('computes the product of array elements', async () => {
      const data = new Float64Array([1, 2, 3, 4]);
      const result = await pool.prod(data);
      expect(result.result).toBeCloseTo(24);
    });

    it('handles a single-element input', async () => {
      const result = await pool.prod(new Float64Array([7]));
      expect(result.result).toBeCloseTo(7);
    });
  });

  describe('pow() — worker-dispatched', () => {
    it('matches the sequential ** oracle and reports parallelized', async () => {
      const a = new Float64Array([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const b = new Float64Array([2, 2, 2, 2, 2, 0.5, 0.5, 0.5, 1, 1]);
      const result = await pool.pow(a, b);

      expect(result.parallelized).toBe(true);
      for (let i = 0; i < a.length; i++) {
        expect(result.result[i]).toBeCloseTo(a[i] ** b[i], 9);
      }
    });
  });

  describe('sign() — worker-dispatched', () => {
    it('matches Math.sign element-wise and reports parallelized', async () => {
      const data = new Float64Array([-5, -0.1, 0, 0.1, 5, -3, 2, -8, 4, 0]);
      const result = await pool.sign(data);

      expect(result.parallelized).toBe(true);
      for (let i = 0; i < data.length; i++) {
        expect(result.result[i]).toBe(Math.sign(data[i]));
      }
    });
  });

  describe('applyKernel() / applyKernel2()', () => {
    it('applyKernel applies a unary kernel across workers', async () => {
      const data = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const result = await pool.applyKernel(data, '(x) => x * x + 1');
      for (let i = 0; i < data.length; i++) {
        expect(result.result[i]).toBeCloseTo(data[i] * data[i] + 1, 9);
      }
    });

    it('applyKernel2 applies a binary kernel across workers', async () => {
      const a = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const b = new Float64Array([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
      const result = await pool.applyKernel2(a, b, '(a, b) => a - b');
      for (let i = 0; i < a.length; i++) {
        expect(result.result[i]).toBeCloseTo(a[i] - b[i], 9);
      }
    });
  });

  describe('tensordot() — worker-dispatched', () => {
    it('parallel 2D matmul-equivalent matches the sequential oracle', async () => {
      // 2×3 @ 3×2 → 2×2, contracting axis 1 of A with axis 0 of B.
      const a = new Float64Array([1, 2, 3, 4, 5, 6]);
      const b = new Float64Array([7, 8, 9, 10, 11, 12]);
      const result = await pool.tensordot(a, [2, 3], b, [3, 2], [1], [0]);

      expect(result.parallelized).toBe(true);
      expect(result.result.shape).toEqual([2, 2]);
      expect(Array.from(result.result.data)).toEqual([58, 64, 139, 154]);
    });

    it('parallel path with multiple chunks aggregates correctly', async () => {
      // Larger result (4×4 = 16 elements) > chunkSize(8) → multiple chunks.
      const m = 4;
      const k = 4;
      const n = 4;
      const a = new Float64Array(m * k);
      const b = new Float64Array(k * n);
      for (let i = 0; i < a.length; i++) a[i] = i + 1;
      for (let i = 0; i < b.length; i++) b[i] = (i % 4) + 1;

      const result = await pool.tensordot(a, [m, k], b, [k, n], [1], [0]);
      expect(result.parallelized).toBe(true);
      expect(result.chunks).toBeGreaterThan(1);

      // Sequential reference matmul.
      const ref = new Float64Array(m * n);
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          let s = 0;
          for (let kk = 0; kk < k; kk++) s += a[i * k + kk] * b[kk * n + j];
          ref[i * n + j] = s;
        }
      }
      for (let i = 0; i < ref.length; i++) {
        expect(result.result.data[i]).toBeCloseTo(ref[i], 9);
      }
    });

    it('rejects out-of-range axesA', async () => {
      const a = new Float64Array([1, 2, 3, 4]);
      const b = new Float64Array([1, 2, 3, 4]);
      await expect(pool.tensordot(a, [2, 2], b, [2, 2], [5], [0])).rejects.toThrow(
        /out of range/
      );
    });

    it('rejects out-of-range axesB', async () => {
      const a = new Float64Array([1, 2, 3, 4]);
      const b = new Float64Array([1, 2, 3, 4]);
      await expect(pool.tensordot(a, [2, 2], b, [2, 2], [0], [5])).rejects.toThrow(
        /out of range/
      );
    });

    it('rejects a dimension mismatch on contracted axes', async () => {
      const a = new Float64Array([1, 2, 3, 4, 5, 6]); // [2,3]
      const b = new Float64Array([1, 2, 3, 4]); // [2,2]
      await expect(pool.tensordot(a, [2, 3], b, [2, 2], [1], [0])).rejects.toThrow(
        /dimension mismatch/
      );
    });
  });

  describe('integrateFanOut()', () => {
    it('approximates a definite integral by fanning out GL quadrature', async () => {
      // 2-point Gauss-Legendre nodes/weights on [-1, 1] (exact for cubics).
      const nodes = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)];
      const weights = [1, 1];
      // ∫_0^1 x^2 dx = 1/3
      const value = await pool.integrateFanOut('(x) => x * x', 0, 1, 4, nodes, weights);
      expect(value).toBeCloseTo(1 / 3, 6);
    });
  });

  describe('distributionSampleFanOut()', () => {
    it('returns the requested number of samples across workers', async () => {
      const n = 1000;
      const samples = await pool.distributionSampleFanOut('normal', [0, 1], n, 12345, 3);
      expect(samples.length).toBe(n);
      // Sample mean of a unit normal should be near 0 (loose bound).
      let mean = 0;
      for (let i = 0; i < n; i++) mean += samples[i];
      mean /= n;
      expect(Math.abs(mean)).toBeLessThan(0.5);
    });
  });

  describe('fftBatch()', () => {
    it('round-trips forward then inverse FFT back to the input', async () => {
      const frameCount = 2;
      const frameLength = 4;
      const total = frameCount * frameLength;
      const real = new Float64Array(total);
      const imag = new Float64Array(total);
      for (let i = 0; i < total; i++) real[i] = i + 1;

      const fwd = await pool.fftBatch(real, imag, frameCount, frameLength, false);
      const inv = await pool.fftBatch(
        fwd.result.real,
        fwd.result.imag,
        frameCount,
        frameLength,
        true
      );

      for (let i = 0; i < total; i++) {
        expect(inv.result.real[i]).toBeCloseTo(real[i], 6);
        expect(inv.result.imag[i]).toBeCloseTo(0, 6);
      }
    });
  });

  describe('distanceMatrix()', () => {
    it('computes the all-pairs Euclidean distance matrix', async () => {
      // 3 points in 2D: (0,0), (3,0), (0,4)
      const points = new Float64Array([0, 0, 3, 0, 0, 4]);
      const n = 3;
      const dim = 2;
      const result = await pool.distanceMatrix(points, n, dim);

      const d = result.result;
      expect(d[0 * n + 0]).toBeCloseTo(0);
      expect(d[0 * n + 1]).toBeCloseTo(3);
      expect(d[0 * n + 2]).toBeCloseTo(4);
      expect(d[1 * n + 2]).toBeCloseTo(5); // 3-4-5 triangle
    });
  });

  describe('workerCount getter', () => {
    it('reflects the configured maxWorkers', () => {
      expect(pool.workerCount).toBe(3);
    });
  });

  describe('bitwise length-mismatch guards', () => {
    // bitAnd/leftShift mismatches are covered in ComputePool.test.ts; cover the
    // remaining binary ops' guard clauses here.
    it('bitOr throws on length mismatch', async () => {
      await expect(
        pool.bitOr(Int32Array.from([1, 2, 3]), Int32Array.from([1, 2]))
      ).rejects.toThrow(/lengths must match/);
    });

    it('bitXor throws on length mismatch', async () => {
      await expect(
        pool.bitXor(Int32Array.from([1, 2, 3]), Int32Array.from([1, 2]))
      ).rejects.toThrow(/lengths must match/);
    });

    it('rightArithShift throws on Int32 length mismatch', async () => {
      await expect(
        pool.rightArithShift(Int32Array.from([1, 2, 3]), Int32Array.from([1, 2]))
      ).rejects.toThrow(/lengths must match/);
    });

    it('rightLogShift throws on Int32 length mismatch', async () => {
      await expect(
        pool.rightLogShift(Int32Array.from([1, 2, 3]), Int32Array.from([1, 2]))
      ).rejects.toThrow(/lengths must match/);
    });
  });
});
