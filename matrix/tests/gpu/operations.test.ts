/**
 * GPU Matrix Operations Tests
 *
 * Tests for GPU-accelerated matrix operations.
 * Verifies correctness by comparing GPU results with CPU reference implementations.
 * Note: Many tests are skipped in Node.js as WebGPU requires a browser.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GPUBackend,
  getGlobalGPUBackend,
  destroyGlobalGPUBackend,
} from '../../src/backends/GPUBackend.js';

/**
 * CPU reference implementations for verification
 */
const cpuOps = {
  /**
   * Matrix addition
   */
  add(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] + b[i];
    }
    return result;
  },

  /**
   * Matrix multiplication (row-major)
   */
  matmul(
    a: Float32Array,
    b: Float32Array,
    M: number,
    K: number,
    N: number
  ): Float32Array {
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

  /**
   * Matrix transpose
   */
  transpose(
    a: Float32Array,
    rows: number,
    cols: number
  ): Float32Array {
    const result = new Float32Array(rows * cols);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[j * rows + i] = a[i * cols + j];
      }
    }
    return result;
  },

  /**
   * Scalar multiplication
   */
  scale(a: Float32Array, scalar: number): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] * scalar;
    }
    return result;
  },

  /**
   * Sum reduction
   */
  sum(a: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i];
    }
    return sum;
  },

  /**
   * Max reduction
   */
  max(a: Float32Array): number {
    let max = a[0];
    for (let i = 1; i < a.length; i++) {
      if (a[i] > max) max = a[i];
    }
    return max;
  },

  /**
   * Min reduction
   */
  min(a: Float32Array): number {
    let min = a[0];
    for (let i = 1; i < a.length; i++) {
      if (a[i] < min) min = a[i];
    }
    return min;
  },
};

/**
 * Generate random matrix
 */
function randomMatrix(rows: number, cols: number): Float32Array {
  const data = new Float32Array(rows * cols);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 10 - 5;
  }
  return data;
}

/**
 * Check if two arrays are equal within tolerance
 */
function arraysClose(
  a: Float32Array,
  b: Float32Array,
  tolerance: number = 1e-5
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > tolerance) {
      return false;
    }
  }
  return true;
}

describe('GPU Matrix Operations', () => {
  let backend: GPUBackend;

  beforeEach(() => {
    backend = new GPUBackend();
  });

  afterEach(() => {
    destroyGlobalGPUBackend();
  });

  describe('Backend Initialization', () => {
    it('should start uninitialized', () => {
      expect(backend.status).toBe('uninitialized');
      expect(backend.isReady).toBe(false);
    });

    it('should fail initialization in Node.js', async () => {
      const success = await backend.initialize();
      expect(success).toBe(false);
      expect(backend.status).toBe('unsupported');
    });
  });

  describe('Workgroup calculations', () => {
    it('should calculate correct workgroups for square matrices', () => {
      const calculateWorkgroups = (backend as unknown as {
        calculateWorkgroups: (rows: number, cols: number) => [number, number, number];
      }).calculateWorkgroups.bind(backend);

      // 32x32 matrix with 16x16 workgroups = 2x2 workgroups
      expect(calculateWorkgroups(32, 32)).toEqual([2, 2, 1]);
    });

    it('should ceil workgroups for non-divisible sizes', () => {
      const calculateWorkgroups = (backend as unknown as {
        calculateWorkgroups: (rows: number, cols: number) => [number, number, number];
      }).calculateWorkgroups.bind(backend);

      // 17x17 matrix needs ceil(17/16) = 2 workgroups per dimension
      expect(calculateWorkgroups(17, 17)).toEqual([2, 2, 1]);

      // 33x33 matrix needs ceil(33/16) = 3 workgroups
      expect(calculateWorkgroups(33, 33)).toEqual([3, 3, 1]);
    });

    it('should handle rectangular matrices', () => {
      const calculateWorkgroups = (backend as unknown as {
        calculateWorkgroups: (rows: number, cols: number) => [number, number, number];
      }).calculateWorkgroups.bind(backend);

      // 256x128 matrix
      expect(calculateWorkgroups(256, 128)).toEqual([8, 16, 1]);
    });
  });

  describe('shouldUseGPU threshold', () => {
    it('should return false when not ready', () => {
      expect(backend.shouldUseGPU(1000, 1000)).toBe(false);
    });

    it('should check size threshold', () => {
      // Access private threshold for testing
      const threshold = 100000; // Default threshold

      // Below threshold (assuming backend were ready)
      expect(backend.shouldUseGPU(100, 100)).toBe(false); // 10000 < 100000

      // At threshold - still false because not initialized
      expect(backend.shouldUseGPU(1000, 1000)).toBe(false);
    });
  });

  describe('CPU Reference Operations', () => {
    // These tests verify our CPU reference implementations
    // that we use to validate GPU results

    it('should compute correct matrix addition', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);
      const expected = new Float32Array([6, 8, 10, 12]);

      const result = cpuOps.add(a, b);
      expect(arraysClose(result, expected)).toBe(true);
    });

    it('should compute correct matrix multiplication', () => {
      // 2x2 matrices
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);
      // [[1,2],[3,4]] * [[5,6],[7,8]] = [[19,22],[43,50]]
      const expected = new Float32Array([19, 22, 43, 50]);

      const result = cpuOps.matmul(a, b, 2, 2, 2);
      expect(arraysClose(result, expected)).toBe(true);
    });

    it('should compute correct transpose', () => {
      // 2x3 matrix -> 3x2 matrix
      const a = new Float32Array([1, 2, 3, 4, 5, 6]);
      // [[1,2,3],[4,5,6]] -> [[1,4],[2,5],[3,6]]
      const expected = new Float32Array([1, 4, 2, 5, 3, 6]);

      const result = cpuOps.transpose(a, 2, 3);
      expect(arraysClose(result, expected)).toBe(true);
    });

    it('should compute correct scalar multiplication', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const expected = new Float32Array([2, 4, 6, 8]);

      const result = cpuOps.scale(a, 2);
      expect(arraysClose(result, expected)).toBe(true);
    });

    it('should compute correct sum', () => {
      const a = new Float32Array([1, 2, 3, 4, 5]);
      expect(cpuOps.sum(a)).toBe(15);
    });

    it('should compute correct max', () => {
      const a = new Float32Array([3, 1, 4, 1, 5, 9, 2, 6]);
      expect(cpuOps.max(a)).toBe(9);
    });

    it('should compute correct min', () => {
      const a = new Float32Array([3, 1, 4, 1, 5, 9, 2, 6]);
      expect(cpuOps.min(a)).toBe(1);
    });
  });

  describe('Backend statistics', () => {
    it('should provide stats when uninitialized', () => {
      const stats = backend.getStats();

      expect(stats.status).toBe('uninitialized');
      expect(stats.capabilities).toBeNull();
      expect(stats.bufferPool).toBeNull();
      expect(stats.shaders).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should throw when getting context before initialization', () => {
      expect(() => backend.getContext()).toThrow('GPUBackend not initialized');
    });

    it('should throw when getting buffer pool before initialization', () => {
      expect(() => backend.getBufferPool()).toThrow('GPUBackend not initialized');
    });

    it('should throw when getting shader manager before initialization', () => {
      expect(() => backend.getShaderManager()).toThrow('GPUBackend not initialized');
    });
  });

  // These tests would pass in a browser with WebGPU support
  describe.skip('GPU Operations (requires WebGPU)', () => {
    beforeEach(async () => {
      const success = await backend.initialize();
      if (!success) {
        console.log('WebGPU not available, skipping GPU tests');
      }
    });

    it('should compute matrix addition matching CPU', async () => {
      const rows = 64;
      const cols = 64;
      const a = randomMatrix(rows, cols);
      const b = randomMatrix(rows, cols);

      const cpuResult = cpuOps.add(a, b);
      const gpuResult = await backend.add(a, b, rows, cols);

      expect(arraysClose(gpuResult, cpuResult, 1e-5)).toBe(true);
    });

    it('should compute matrix multiplication matching CPU', async () => {
      const M = 32;
      const K = 32;
      const N = 32;
      const a = randomMatrix(M, K);
      const b = randomMatrix(K, N);

      const cpuResult = cpuOps.matmul(a, b, M, K, N);
      const gpuResult = await backend.matmul(a, b, M, K, N);

      // Matmul can have more numerical error due to FMA operations
      expect(arraysClose(gpuResult, cpuResult, 1e-4)).toBe(true);
    });

    it('should compute transpose matching CPU', async () => {
      const rows = 32;
      const cols = 48;
      const a = randomMatrix(rows, cols);

      const cpuResult = cpuOps.transpose(a, rows, cols);
      const gpuResult = await backend.transpose(a, rows, cols);

      expect(arraysClose(gpuResult, cpuResult, 1e-6)).toBe(true);
    });

    it('should compute scalar multiplication matching CPU', async () => {
      const rows = 64;
      const cols = 64;
      const a = randomMatrix(rows, cols);
      const scalar = 2.5;

      const cpuResult = cpuOps.scale(a, scalar);
      const gpuResult = await backend.scale(a, scalar, rows, cols);

      expect(arraysClose(gpuResult, cpuResult, 1e-6)).toBe(true);
    });
  });

  describe('Large Matrix Operations (CPU reference)', () => {
    // These test our reference implementations on larger matrices
    // to ensure they can handle sizes we'd use with GPU

    it('should handle 128x128 matmul', () => {
      const size = 128;
      const a = randomMatrix(size, size);
      const b = randomMatrix(size, size);

      const result = cpuOps.matmul(a, b, size, size, size);

      expect(result.length).toBe(size * size);
    });

    it('should handle 256x256 addition', () => {
      const size = 256;
      const a = randomMatrix(size, size);
      const b = randomMatrix(size, size);

      const result = cpuOps.add(a, b);

      expect(result.length).toBe(size * size);
    });

    it('should handle non-square matmul', () => {
      const M = 64;
      const K = 128;
      const N = 32;
      const a = randomMatrix(M, K);
      const b = randomMatrix(K, N);

      const result = cpuOps.matmul(a, b, M, K, N);

      expect(result.length).toBe(M * N);
    });
  });
});

describe('WGSL Shader Content', () => {
  // These tests verify our WGSL shader sources contain expected constructs

  describe('ShaderManager builtin shaders', () => {
    it('should have properly formatted elementwise shaders', async () => {
      const { BUILTIN_SHADERS } = await import('../../src/backends/gpu/ShaderManager.js');

      expect(BUILTIN_SHADERS.matrixAdd).toContain('@compute');
      expect(BUILTIN_SHADERS.matrixAdd).toContain('@workgroup_size');
      expect(BUILTIN_SHADERS.matrixAdd).toContain('var<storage');
    });

    it('should have properly formatted matmul shader', async () => {
      const { BUILTIN_SHADERS } = await import('../../src/backends/gpu/ShaderManager.js');

      expect(BUILTIN_SHADERS.matmul).toContain('@compute');
      // Params are accessed via vec4 components: x=M, y=N, z=K
      expect(BUILTIN_SHADERS.matmul).toContain('params.x');
      expect(BUILTIN_SHADERS.matmul).toContain('params.y');
      expect(BUILTIN_SHADERS.matmul).toContain('params.z');
    });

    it('should have properly formatted reduce shader', async () => {
      const { BUILTIN_SHADERS } = await import('../../src/backends/gpu/ShaderManager.js');

      expect(BUILTIN_SHADERS.sumReduce).toContain('@compute');
      expect(BUILTIN_SHADERS.sumReduce).toContain('workgroupBarrier');
      expect(BUILTIN_SHADERS.sumReduce).toContain('var<workgroup>');
    });

    it('should have properly formatted transpose shader', async () => {
      const { BUILTIN_SHADERS } = await import('../../src/backends/gpu/ShaderManager.js');

      expect(BUILTIN_SHADERS.transpose).toContain('@compute');
      // Uses params.x for rows and params.y for cols
      expect(BUILTIN_SHADERS.transpose).toContain('params.x');
    });
  });
});
