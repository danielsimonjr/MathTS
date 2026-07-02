/**
 * WASM-accelerated Eigendecomposition
 *
 * Provides eigenvalue/eigenvector computation with optional WASM acceleration
 * via the AssemblyScript-compiled Jacobi eigenvalue algorithm. Falls back to the pure
 * JavaScript QR-based implementation when WASM is unavailable.
 *
 * WASM acceleration path:
 *   - Symmetric matrices: Jacobi eigenvalue algorithm (AssemblyScript
 *     `matrix_eig_symmetric`, `assembly/src/ops/eig.ts`)
 *   - Non-symmetric matrices: Hessenberg reduction + Francis double-shift
 *     implicit QR to the real Schur form, with eigenvector back-substitution
 *     (AssemblyScript `matrix_eig_general`, `assembly/src/ops/eig.ts`)
 *
 * JS fallback path (wasm unavailable, n < threshold, or missing export):
 *   - Full QR algorithm with implicit shifts (eig.ts)
 *
 * Packing of the AS return values (both decoded via `readReturnedFloat64Array`):
 *   - matrix_eig_symmetric: `[ eigenvalues(n) | eigenvectors(n*n) ]`
 *   - matrix_eig_general:   `[ re(n) | im(n) | eigenvectors(n*n) ]`
 * Eigenvectors are stored as COLUMNS (`V[i*n+j]` = component `i` of
 * eigenvector `j`). Complex-eigenvalue columns are zero (the real `number[][]`
 * vector contract cannot represent complex eigenvectors).
 *
 * @packageDocumentation
 */

import { eig, type EigResult, type EigOptions } from './eig.js';
import { isSymmetric } from './common.js';
import { wasmLoader } from '../backends/WasmLoader.js';

/**
 * Threshold: minimum matrix dimension for WASM to be beneficial.
 * Below this size, the overhead of copying data to/from WASM memory
 * exceeds the computational savings.
 */
const WASM_EIG_THRESHOLD = 8;

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
 * Uses the AssemblyScript Jacobi eigenvalue algorithm when WASM is loaded,
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

  // WASM eig RETIRED (2026-07-01): the AS Jacobi / Francis kernels are scalar + async and
  // measured 0.2–0.7× of the JS path, worsening with size (~5× slower at 128²) — see
  // tools/benchmarks/decomp-audit. So we skip the WASM path (module stays null → JS fallback
  // below). The eligibility logic is kept behind the flag for when the kernels are
  // SIMD-optimized (as matmul was). WASM's proven win is compute-dense SIMD matmul only.
  const WASM_EIG_ENABLED = false;
  let module = WASM_EIG_ENABLED ? wasmLoader.getModule() : null;
  if (WASM_EIG_ENABLED && !module) {
    try {
      module = await wasmLoader.load();
    } catch {
      module = null;
    }
  }
  const symmetric = isSymmetric(matrix);

  // Decide whether a WASM kernel is available for this matrix:
  //   symmetric     -> matrix_eig_symmetric (Jacobi)
  //   non-symmetric -> matrix_eig_general   (Hessenberg + Francis double-shift QR)
  const useSymWasm =
    !!module &&
    n >= WASM_EIG_THRESHOLD &&
    symmetric &&
    typeof module.matrix_eig_symmetric === 'function';
  const useGenWasm =
    !!module &&
    n >= WASM_EIG_THRESHOLD &&
    !symmetric &&
    typeof module.matrix_eig_general === 'function';

  if (!useSymWasm && !useGenWasm) {
    // JS fallback: use the existing QR-based implementation. Covers
    // wasm-unavailable, small matrices, and the missing-export case.
    return eig(matrix, options);
  }

  const computeVectors = options?.computeVectors ?? true;
  const identityVectors = (): number[][] =>
    Array.from({ length: n }, (_, i) => {
      const row = new Array(n).fill(0);
      row[i] = 1;
      return row;
    });

  // Flatten matrix to row-major order
  const flatMatrix = flattenMatrix(matrix);
  const matrixAlloc = wasmLoader.allocateFloat64Array(Array.from(flatMatrix));

  try {
    if (useSymWasm) {
      // matrix_eig_symmetric returns a managed Float64Array header packing
      // [ eigenvalues(n) | eigenvectors(n*n) ], eigenvectors as columns.
      const packedPtr = module!.matrix_eig_symmetric!(matrixAlloc.ptr, n);
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
        vectors = identityVectors();
      }

      return { values, vectors, isSymmetric: true };
    }

    // Non-symmetric WASM path: matrix_eig_general returns a managed
    // Float64Array header packing [ re(n) | im(n) | eigenvectors(n*n) ],
    // eigenvectors as columns (real eigenvectors unit-normalised; complex
    // eigenvalue columns zero-filled — matching the real-valued `number[][]`
    // contract the JS reference uses, where complex eigenvectors are zero).
    const packedPtr = module!.matrix_eig_general!(matrixAlloc.ptr, n);
    const packed = wasmLoader.readReturnedFloat64Array(packedPtr);
    if (packed.length < 2 * n + n * n) {
      // Unexpected shape — fall back to JS.
      return eig(matrix, options);
    }

    const values: Array<{ re: number; im: number }> = [];
    for (let j = 0; j < n; j++) {
      values.push({ re: packed[j], im: packed[n + j] });
    }

    let vectors: number[][];
    if (computeVectors) {
      // Eigenvector j is column j: component i is packed[2n + i*n + j].
      vectors = [];
      for (let j = 0; j < n; j++) {
        const vec: number[] = [];
        for (let i = 0; i < n; i++) {
          vec.push(packed[2 * n + i * n + j]);
        }
        vectors.push(vec);
      }
    } else {
      vectors = identityVectors();
    }

    return { values, vectors, isSymmetric: false };
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
 * Uses AssemblyScript power iteration when WASM is available.
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

  // WASM power-iteration retired alongside eig/svd (scalar + async, loses to JS — see
  // tools/benchmarks/decomp-audit). Skip WASM; the JS fallback below runs.
  const WASM_SPECTRAL_ENABLED = false;
  let module = WASM_SPECTRAL_ENABLED ? wasmLoader.getModule() : null;
  if (WASM_SPECTRAL_ENABLED && !module) {
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
