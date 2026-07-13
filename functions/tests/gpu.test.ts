/**
 * Tests for the WebGPU-accelerated matrix operations.
 *
 * No WebGPU device is available under Node, so these exercise the CPU
 * fallback path — they verify the wrappers return correct results and the
 * fallback is wired. The GPU compute-shader path itself only runs in a
 * browser with `navigator.gpu`.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { gpuMatmul, gpuAdd, gpuTranspose, gpuScale } from '../src/typed/gpu.js';
import { DenseMatrix, gpuMatrixBackend } from '@danielsimonjr/mathts-matrix';

describe('WebGPU-accelerated matrix operations (CPU fallback)', () => {
  it('gpuMatmul computes the matrix product', async () => {
    const a = DenseMatrix.fromFlat(2, 3, [1, 2, 3, 4, 5, 6]);
    const b = DenseMatrix.fromFlat(3, 2, [7, 8, 9, 10, 11, 12]);
    const r = await gpuMatmul(a, b);
    expect(Array.from(r.toFloat64Array())).toEqual([58, 64, 139, 154]);
  });

  it('gpuAdd computes the element-wise sum', async () => {
    const a = DenseMatrix.fromFlat(2, 2, [1, 2, 3, 4]);
    const b = DenseMatrix.fromFlat(2, 2, [10, 20, 30, 40]);
    const r = await gpuAdd(a, b);
    expect(Array.from(r.toFloat64Array())).toEqual([11, 22, 33, 44]);
  });

  it('gpuTranspose transposes the matrix', async () => {
    const a = DenseMatrix.fromFlat(2, 3, [1, 2, 3, 4, 5, 6]);
    const r = await gpuTranspose(a);
    expect(r.rows).toBe(3);
    expect(r.cols).toBe(2);
    expect(Array.from(r.toFloat64Array())).toEqual([1, 4, 2, 5, 3, 6]);
  });

  it('gpuScale multiplies every element by the scalar', async () => {
    const a = DenseMatrix.fromFlat(2, 2, [1, 2, 3, 4]);
    const r = await gpuScale(a, 3);
    expect(Array.from(r.toFloat64Array())).toEqual([3, 6, 9, 12]);
  });
});

describe('WebGPU device-init failure degrades to the CPU path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Simulate an environment that advertises WebGPU but whose device
   * initialization fails (lost adapter, driver refusal, revoked permission).
   * The GPU is a best-effort fast path, never a hard dependency: the wrappers
   * must degrade to the CPU implementation, not reject.
   */
  const withFailingDevice = (): void => {
    vi.spyOn(gpuMatrixBackend, 'isAvailable').mockReturnValue(true);
    vi.spyOn(gpuMatrixBackend, 'initialize').mockRejectedValue(new Error('device init failed'));
  };

  it('gpuMatmul falls back to the CPU product', async () => {
    withFailingDevice();
    const a = DenseMatrix.fromFlat(2, 3, [1, 2, 3, 4, 5, 6]);
    const b = DenseMatrix.fromFlat(3, 2, [7, 8, 9, 10, 11, 12]);
    const r = await gpuMatmul(a, b);
    expect(Array.from(r.toFloat64Array())).toEqual([58, 64, 139, 154]);
  });

  it('gpuAdd falls back to the CPU sum', async () => {
    withFailingDevice();
    const a = DenseMatrix.fromFlat(2, 2, [1, 2, 3, 4]);
    const b = DenseMatrix.fromFlat(2, 2, [10, 20, 30, 40]);
    const r = await gpuAdd(a, b);
    expect(Array.from(r.toFloat64Array())).toEqual([11, 22, 33, 44]);
  });

  it('gpuTranspose falls back to the CPU transpose', async () => {
    withFailingDevice();
    const a = DenseMatrix.fromFlat(2, 3, [1, 2, 3, 4, 5, 6]);
    const r = await gpuTranspose(a);
    expect(Array.from(r.toFloat64Array())).toEqual([1, 4, 2, 5, 3, 6]);
  });

  it('gpuScale falls back to the CPU scale', async () => {
    withFailingDevice();
    const a = DenseMatrix.fromFlat(2, 2, [1, 2, 3, 4]);
    const r = await gpuScale(a, 3);
    expect(Array.from(r.toFloat64Array())).toEqual([3, 6, 9, 12]);
  });
});
