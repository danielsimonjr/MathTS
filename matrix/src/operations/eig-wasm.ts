/**
 * WASM-accelerated Eigendecomposition
 *
 * Provides eigenvalue/eigenvector computation with optional WASM acceleration
 * via the Rust-compiled Jacobi eigenvalue algorithm. Falls back to the pure
 * JavaScript QR-based implementation when WASM is unavailable.
 *
 * WASM acceleration path:
 *   - Symmetric matrices: Jacobi eigenvalue algorithm (AssemblyScript
 *     `matrix_eig_symmetric`, `assembly/src/ops/eig.ts`)
 *   - Non-symmetric matrices: falls back to JS QR algorithm
 *
 * JS fallback path:
 *   - Full QR algorithm with implicit shifts (eig.ts)
 *
 * Phase 7b: repointed off the retired Rust crate. The AS kernel packs its
 * result as `[ eigenvalues(n) | eigenvectors(n*n) ]` with eigenvectors as
 * COLUMNS (`V[i*n+j]` = component `i` of eigenvector `j`).
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
export async function eigWasm(matrix: number[][], options?: EigOptions): Promise<EigResult> {
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

  // For small matrices or when WASM is not loaded, use JS fallback.
  // Load the shared (AS-default) loader on first use; failures drop to JS.
  let module = wasmLoader.getModule();
  if (!module) {
    try {
      module = await wasmLoader.load();
    } catch {
      module = null;
    }
  }
  const symmetric = isSymmetric(matrix);

  if (
    !module ||
    n < WASM_EIG_THRESHOLD ||
    !symmetric ||
    typeof module.matrix_eig_symmetric !== 'function'
  ) {
    // JS fallback: use the existing QR-based implementation
    return eig(matrix, options);
  }

  const computeVectors = options?.computeVectors ?? true;

  // Flatten matrix to row-major order
  const flatMatrix = flattenMatrix(matrix);
  const matrixAlloc = wasmLoader.allocateFloat64Array(Array.from(flatMatrix));

  try {
    // matrix_eig_symmetric returns a managed Float64Array header packing
    // [ eigenvalues(n) | eigenvectors(n*n) ], eigenvectors as columns.
    const packedPtr = module.matrix_eig_symmetric(matrixAlloc.ptr, n);
    const packed = wasmLoader.readReturnedFloat64Array(packedPtr);
    if (packed.length < n + n * n) {
      // Unexpected shape — fall back to JS.
      return eig(matrix, options);
    }

    const values: Array<{ re: number; im: number }> = [];
    for (let j = 0; j < n; j++) {
      values.push({ re: packed[j], im: 0 });
    }

    let vectors: number[][];
    if (computeVectors) {
      // Eigenvector j is column j: component i is packed[n + i*n + j].
      // Emit vectors[j] = the j-th eigenvector (row of components), matching
      // the JS `eig` contract where vectors[k] is the k-th eigenvector.
      vectors = [];
      for (let j = 0; j < n; j++) {
        const vec: number[] = [];
        for (let i = 0; i < n; i++) {
          vec.push(packed[n + i * n + j]);
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

  let module = wasmLoader.getModule();
  if (!module) {
    try {
      module = await wasmLoader.load();
    } catch {
      module = null;
    }
  }

  if (!module || n < WASM_EIG_THRESHOLD || typeof module.matrix_spectral_radius !== 'function') {
    // JS fallback: use power iteration from eig.ts
    const { powerIteration } = await import('./eig.js');
    const result = powerIteration(matrix, options);
    return Math.abs(result.value);
  }

  const flatMatrix = flattenMatrix(matrix);
  const matrixAlloc = wasmLoader.allocateFloat64Array(Array.from(flatMatrix));

  try {
    return module.matrix_spectral_radius(matrixAlloc.ptr, n);
  } catch {
    const { powerIteration } = await import('./eig.js');
    const result = powerIteration(matrix, options);
    return Math.abs(result.value);
  } finally {
    wasmLoader.free(matrixAlloc.ptr);
  }
}
