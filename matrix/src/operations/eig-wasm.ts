/**
 * WASM-accelerated Eigendecomposition
 *
 * Provides eigenvalue/eigenvector computation with optional WASM acceleration
 * via the Rust-compiled Jacobi eigenvalue algorithm. Falls back to the pure
 * JavaScript QR-based implementation when WASM is unavailable.
 *
 * WASM acceleration path:
 *   - Symmetric matrices: Jacobi eigenvalue algorithm (Rust WASM)
 *   - Non-symmetric matrices: falls back to JS QR algorithm
 *
 * JS fallback path:
 *   - Full QR algorithm with implicit shifts (eig.ts)
 *
 * @packageDocumentation
 */

import { eig, type EigResult, type EigOptions } from './eig.js';
import { wasmLoader } from '../backends/WasmLoader.js';

/**
 * Threshold: minimum matrix dimension for WASM to be beneficial.
 * Below this size, the overhead of copying data to/from WASM memory
 * exceeds the computational savings.
 */
const WASM_EIG_THRESHOLD = 8;

/**
 * Check if a matrix is symmetric within tolerance
 */
function isSymmetric(matrix: number[][], tolerance: number = 1e-10): boolean {
  const n = matrix.length;
  if (n === 0) return true;
  if (matrix[0].length !== n) return false;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(matrix[i][j] - matrix[j][i]) > tolerance) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Flatten a 2D matrix to row-major Float64Array
 */
function flattenMatrix(matrix: number[][]): Float64Array {
  const n = matrix.length;
  const flat = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      flat[i * n + j] = matrix[i][j];
    }
  }
  return flat;
}

/**
 * WASM-accelerated eigendecomposition for symmetric matrices.
 *
 * Uses the Rust Jacobi eigenvalue algorithm when WASM is loaded,
 * otherwise falls back to the JavaScript QR algorithm.
 *
 * @param matrix - Square matrix as 2D array
 * @param options - Computation options
 * @returns Eigenvalues and eigenvectors
 */
export async function eigWasm(
  matrix: number[][],
  options?: EigOptions
): Promise<EigResult> {
  const n = matrix.length;

  // Validate
  if (n === 0) {
    return { values: [], vectors: [], isSymmetric: true };
  }

  for (let i = 0; i < n; i++) {
    if (matrix[i].length !== n) {
      throw new Error('Matrix must be square');
    }
  }

  // For small matrices or when WASM is not loaded, use JS fallback
  const wasmModule = wasmLoader.getModule();
  const symmetric = isSymmetric(matrix);

  if (!wasmModule || n < WASM_EIG_THRESHOLD || !symmetric) {
    // JS fallback: use the existing QR-based implementation
    return eig(matrix, options);
  }

  // WASM path: Jacobi eigenvalue algorithm for symmetric matrices
  const tolerance = options?.tolerance ?? 1e-12;
  const computeVectors = options?.computeVectors ?? true;

  // Flatten matrix to row-major order
  const flatMatrix = flattenMatrix(matrix);

  // Allocate WASM memory
  const matrixAlloc = wasmLoader.allocateFloat64Array(Array.from(flatMatrix));
  const eigenvaluesAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
  const eigenvectorsAlloc = computeVectors
    ? wasmLoader.allocateFloat64ArrayEmpty(n * n)
    : { ptr: 0, array: new Float64Array(0) };
  const workAlloc = wasmLoader.allocateFloat64ArrayEmpty(2 * n);

  try {
    // Call WASM eigsSymmetric
    const iterations = wasmModule.eigsSymmetric(
      matrixAlloc.ptr,
      n,
      tolerance,
      eigenvaluesAlloc.ptr,
      computeVectors ? eigenvectorsAlloc.ptr : 0,
      workAlloc.ptr
    );

    if (iterations < 0) {
      // WASM failed to converge, fall back to JS
      return eig(matrix, options);
    }

    // Read results from WASM memory - re-create views since buffer may have moved
    const module = wasmLoader.getModule()!;
    const eigenvaluesResult = new Float64Array(
      module.memory.buffer,
      eigenvaluesAlloc.ptr,
      n
    );
    const values: Array<{ re: number; im: number }> = [];
    for (let i = 0; i < n; i++) {
      values.push({ re: eigenvaluesResult[i], im: 0 });
    }

    let vectors: number[][];
    if (computeVectors) {
      const eigenvectorsResult = new Float64Array(
        module.memory.buffer,
        eigenvectorsAlloc.ptr,
        n * n
      );
      vectors = [];
      for (let i = 0; i < n; i++) {
        const vec: number[] = [];
        for (let j = 0; j < n; j++) {
          vec.push(eigenvectorsResult[i * n + j]);
        }
        vectors.push(vec);
      }
    } else {
      vectors = Array.from({ length: n }, (_, i) => {
        const row = new Array(n).fill(0);
        row[i] = 1;
        return row;
      });
    }

    return {
      values,
      vectors,
      isSymmetric: true,
    };
  } catch {
    // If WASM call fails for any reason, fall back to JS
    return eig(matrix, options);
  } finally {
    wasmLoader.free(matrixAlloc.ptr);
    wasmLoader.free(eigenvaluesAlloc.ptr);
    if (computeVectors && eigenvectorsAlloc.ptr !== 0) {
      wasmLoader.free(eigenvectorsAlloc.ptr);
    }
    wasmLoader.free(workAlloc.ptr);
  }
}

/**
 * WASM-accelerated eigenvalues only (no eigenvectors).
 * Faster than full eigWasm when only eigenvalues are needed.
 *
 * @param matrix - Square matrix as 2D array
 * @param options - Computation options (computeVectors is ignored)
 * @returns Array of eigenvalues
 */
export async function eigvalsWasm(
  matrix: number[][],
  options?: Omit<EigOptions, 'computeVectors'>
): Promise<Array<{ re: number; im: number }>> {
  const result = await eigWasm(matrix, { ...options, computeVectors: false });
  return result.values;
}

/**
 * WASM-accelerated spectral radius.
 * Uses Rust power iteration when WASM is available.
 *
 * @param matrix - Square matrix as 2D array
 * @param options - Iteration options
 * @returns Spectral radius (absolute value of largest eigenvalue)
 */
export async function spectralRadiusWasm(
  matrix: number[][],
  options?: { maxIterations?: number; tolerance?: number }
): Promise<number> {
  const n = matrix.length;
  const wasmModule = wasmLoader.getModule();

  if (!wasmModule || n < WASM_EIG_THRESHOLD) {
    // JS fallback: use power iteration from eig.ts
    const { powerIteration } = await import('./eig.js');
    const result = powerIteration(matrix, options);
    return Math.abs(result.value);
  }

  const maxIterations = options?.maxIterations ?? 1000;
  const tolerance = options?.tolerance ?? 1e-12;

  const flatMatrix = flattenMatrix(matrix);
  const matrixAlloc = wasmLoader.allocateFloat64Array(Array.from(flatMatrix));
  const workAlloc = wasmLoader.allocateFloat64ArrayEmpty(2 * n);

  try {
    const radius = wasmModule.spectralRadius(
      matrixAlloc.ptr,
      n,
      workAlloc.ptr,
      maxIterations,
      tolerance
    );

    return radius;
  } catch {
    const { powerIteration } = await import('./eig.js');
    const result = powerIteration(matrix, options);
    return Math.abs(result.value);
  } finally {
    wasmLoader.free(matrixAlloc.ptr);
    wasmLoader.free(workAlloc.ptr);
  }
}
