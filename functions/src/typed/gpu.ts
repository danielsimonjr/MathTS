/**
 * WebGPU-Accelerated Matrix Operations
 *
 * Thin wrappers over the matrix package's WebGPU backend. Each function runs
 * its core operation on the GPU via compute shaders when a WebGPU device is
 * available and the matrix is large enough to amortize the dispatch cost;
 * otherwise it transparently falls back to the sequential CPU implementation.
 *
 * Precision note: WebGPU shaders operate in 32-bit float (WGSL has no f64), so
 * results carry f32 precision (~7 significant digits) — unlike the f64 CPU
 * path. Use these functions when throughput on large matrices matters more
 * than precision; use the standard `multiply` / `transpose` for full f64
 * accuracy.
 *
 * @packageDocumentation
 */

import { gpuMatrixBackend } from '@danielsimonjr/mathts-matrix';
import type { DenseMatrix } from '@danielsimonjr/mathts-matrix';

/** Initialize the WebGPU backend once, when a device is actually present. */
async function ensureGpu(): Promise<void> {
  if (gpuMatrixBackend.isAvailable()) {
    await gpuMatrixBackend.initialize();
  }
}

/**
 * Matrix multiplication on the WebGPU backend.
 *
 * Runs a WGSL compute shader when a WebGPU device is available and the product
 * is large enough to be worth the dispatch; otherwise falls back to the CPU
 * matrix product.
 *
 * @param a - Left matrix (m × k)
 * @param b - Right matrix (k × n)
 * @returns Product matrix (m × n); f32 precision on the GPU path
 */
export async function gpuMatmul(
  a: DenseMatrix,
  b: DenseMatrix
): Promise<DenseMatrix> {
  await ensureGpu();
  return gpuMatrixBackend.multiplyAsync(a, b);
}

/**
 * Matrix addition on the WebGPU backend.
 *
 * Runs a WGSL compute shader when a WebGPU device is available and the matrix
 * is large enough; otherwise falls back to the CPU element-wise sum.
 *
 * @param a - First matrix
 * @param b - Second matrix (same shape as `a`)
 * @returns Element-wise sum; f32 precision on the GPU path
 */
export async function gpuAdd(
  a: DenseMatrix,
  b: DenseMatrix
): Promise<DenseMatrix> {
  await ensureGpu();
  return gpuMatrixBackend.addAsync(a, b);
}

/**
 * Matrix transpose on the WebGPU backend.
 *
 * Runs a WGSL compute shader when a WebGPU device is available and the matrix
 * is large enough; otherwise falls back to the CPU transpose.
 *
 * @param a - Matrix to transpose
 * @returns Transposed matrix; f32 precision on the GPU path
 */
export async function gpuTranspose(a: DenseMatrix): Promise<DenseMatrix> {
  await ensureGpu();
  return gpuMatrixBackend.transposeAsync(a);
}

/**
 * Scalar multiplication on the WebGPU backend.
 *
 * Runs a WGSL compute shader when a WebGPU device is available and the matrix
 * is large enough; otherwise falls back to the CPU scale.
 *
 * @param a - Matrix to scale
 * @param scalar - Scalar multiplier
 * @returns Scaled matrix; f32 precision on the GPU path
 */
export async function gpuScale(
  a: DenseMatrix,
  scalar: number
): Promise<DenseMatrix> {
  await ensureGpu();
  return gpuMatrixBackend.scaleAsync(a, scalar);
}
