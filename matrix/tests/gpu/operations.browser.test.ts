/**
 * GPU Matrix Operations — browser WebGPU suite.
 *
 * Verifies GPU kernels against CPU reference implementations on a real
 * WebGPU adapter. Runs only under `vitest.config.browser.ts`
 * (its `include` pattern matches files named `*.browser.test.ts`).
 *
 * Gate: with no adapter, the suite is skipped locally. In CI (`process.env.CI`
 * set), a missing adapter FAILS the file, so a GPU-less runner cannot pass
 * silently.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GPUBackend, destroyGlobalGPUBackend } from '../../src/backends/GPUBackend.js';

/**
 * Relative f32 tolerance: the software-adapter bound of `F32_REL_TOL` in
 * `functions/tests/helpers/gpu-hardware.ts`. A test of one package cannot import
 * the test helpers of another (tsc rootDir), so the value is copied. 1e-3 holds
 * on a software adapter and on real silicon.
 */
const F32_REL_TOL = 1e-3;

/** Set by `define` in vitest.config.browser.ts; a browser has no process.env. */
declare const __MATHTS_CI__: boolean;
const IS_CI = typeof __MATHTS_CI__ !== 'undefined' && __MATHTS_CI__;

const adapter =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? await navigator.gpu.requestAdapter().catch(() => null)
    : null;
const HAS_GPU = adapter !== null;

/** Seeded PRNG (mulberry32). Same seed gives the same inputs on every run. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic matrix with values in [-5, 5). */
function seededMatrix(rows: number, cols: number, seed: number): Float32Array {
  const next = mulberry32(seed);
  const data = new Float32Array(rows * cols);
  for (let i = 0; i < data.length; i++) {
    data[i] = next() * 10 - 5;
  }
  return data;
}

const cpuOps = {
  add(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] + b[i];
    }
    return result;
  },

  matmul(a: Float32Array, b: Float32Array, M: number, K: number, N: number): Float32Array {
    const result = new Float32Array(M * N);
    for (let i = 0; i < M; i++) {
      for (let j = 0; j < N; j++) {
        let sum = 0;
        for (let k = 0; k < K; k++) {
          sum += a[i * K + k] * b[k * N + j];
        }
        result[i * N + j] = sum;
      }
    }
    return result;
  },

  transpose(a: Float32Array, rows: number, cols: number): Float32Array {
    const result = new Float32Array(rows * cols);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[j * rows + i] = a[i * cols + j];
      }
    }
    return result;
  },

  scale(a: Float32Array, scalar: number): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] * scalar;
    }
    return result;
  },
};

/** True when every element matches the reference within the relative tolerance. */
function relClose(actual: Float32Array, expected: Float32Array): boolean {
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i++) {
    const scale = Math.max(1, Math.abs(expected[i]));
    if (Math.abs(actual[i] - expected[i]) > F32_REL_TOL * scale) {
      return false;
    }
  }
  return true;
}

describe('GPU Matrix Operations (browser WebGPU)', () => {
  let backend: GPUBackend;

  beforeAll(() => {
    if (IS_CI && !HAS_GPU) {
      throw new Error(
        'No WebGPU adapter in CI: navigator.gpu.requestAdapter() returned null. ' +
          'The browser GPU suite must not skip silently in CI.'
      );
    }
  });

  it('is gated on a WebGPU adapter', () => {
    expect(HAS_GPU || !IS_CI).toBe(true);
  });

  describe.skipIf(!HAS_GPU)('GPU Operations', () => {
    beforeAll(async () => {
      backend = new GPUBackend();
      const success = await backend.initialize();
      expect(success).toBe(true);
    });

    afterAll(() => {
      destroyGlobalGPUBackend();
    });

    it('should compute matrix addition matching CPU', async () => {
      const rows = 64;
      const cols = 64;
      const a = seededMatrix(rows, cols, 1);
      const b = seededMatrix(rows, cols, 2);

      const cpuResult = cpuOps.add(a, b);
      const gpuResult = await backend.add(a, b, rows, cols);

      expect(relClose(gpuResult, cpuResult)).toBe(true);
    });

    it('should compute matrix multiplication matching CPU', async () => {
      const M = 32;
      const K = 32;
      const N = 32;
      const a = seededMatrix(M, K, 3);
      const b = seededMatrix(K, N, 4);

      const cpuResult = cpuOps.matmul(a, b, M, K, N);
      const gpuResult = await backend.matmul(a, b, M, K, N);

      expect(relClose(gpuResult, cpuResult)).toBe(true);
    });

    it('should compute transpose matching CPU', async () => {
      const rows = 32;
      const cols = 48;
      const a = seededMatrix(rows, cols, 5);

      const cpuResult = cpuOps.transpose(a, rows, cols);
      const gpuResult = await backend.transpose(a, rows, cols);

      expect(relClose(gpuResult, cpuResult)).toBe(true);
    });

    it('should compute scalar multiplication matching CPU', async () => {
      const rows = 64;
      const cols = 64;
      const a = seededMatrix(rows, cols, 6);
      const scalar = 2.5;

      const cpuResult = cpuOps.scale(a, scalar);
      const gpuResult = await backend.scale(a, scalar);

      expect(relClose(gpuResult, cpuResult)).toBe(true);
    });
  });
});
