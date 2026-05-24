/**
 * QR Decomposition (DenseMatrix primitive)
 *
 * Classical Gram-Schmidt with re-orthogonalisation. Adequate for the
 * well-conditioned matrices that arise in the tensor wrappers + the
 * `randomTensor` orthogonal-distribution code path. For pathological
 * matrices the Householder QR implemented in `WASMBackend.qrDecompositionJS`
 * is preferable, but Gram-Schmidt suffices for the current call sites.
 *
 * Two modes:
 *   - 'reduced' (thin QR): Q is (m × k), R is (k × n), k = min(m, n).
 *   - 'full'             : Q is (m × m), R is (m × n).
 *
 * In 'reduced' mode A = Q · R reconstructs A to within `1e-12`.
 * Q's columns are orthonormal (Qᵀ · Q = I_k); R is upper-triangular.
 */

import { DenseMatrix } from '../types/DenseMatrix.js';

export interface QRResult {
  /** Orthonormal Q factor. Reduced: (m × k); full: (m × m). */
  Q: DenseMatrix;
  /** Upper-triangular R factor. Reduced: (k × n); full: (m × n). */
  R: DenseMatrix;
}

export interface QROptions {
  /** 'reduced' (default, thin QR) or 'full'. */
  mode?: 'reduced' | 'full';
}

/**
 * Compute the QR decomposition of `A` such that `A = Q · R`.
 *
 * @param A    - Input matrix (m × n, m ≥ 0, n ≥ 0).
 * @param opts - Optional mode selector (`'reduced'` thin QR or `'full'` square Q).
 */
export function qr(A: DenseMatrix, opts?: QROptions): QRResult {
  const mode = opts?.mode ?? 'reduced';
  const m = A.rows;
  const n = A.cols;

  if (m === 0 || n === 0) {
    if (mode === 'full') {
      return {
        Q: DenseMatrix.identity(m),
        R: DenseMatrix.zeros(m, n),
      };
    }
    const k = Math.min(m, n);
    return {
      Q: DenseMatrix.zeros(m, k),
      R: DenseMatrix.zeros(k, n),
    };
  }

  const aFlat = A.toFloat64Array();
  const k = Math.min(m, n);

  // Column-major scratch space for Q: index Qcm[i + j * m] for row i, col j.
  // We allocate width `m` for full mode (need m × m), else `k` (m × k).
  const qWidth = mode === 'full' ? m : k;
  const Qcm = new Float64Array(m * qWidth);
  // R is upper-triangular (k × n) in reduced mode, (m × n) in full mode.
  const rRows = mode === 'full' ? m : k;
  const R = new Float64Array(rRows * n);

  // ---------------------------------------------------------------------------
  // Step 1: Orthonormalise the first `k` columns of A via classical
  // Gram-Schmidt with one re-orthogonalisation pass.
  // ---------------------------------------------------------------------------
  for (let j = 0; j < k; j++) {
    // Copy column j of A (row-major aFlat) into column j of Qcm.
    for (let i = 0; i < m; i++) {
      Qcm[i + j * m] = aFlat[i * n + j];
    }

    // First Gram-Schmidt pass: orthogonalise against previously computed
    // q columns and accumulate the inner-product into R.
    for (let q = 0; q < j; q++) {
      let dot = 0;
      for (let i = 0; i < m; i++) dot += Qcm[i + q * m] * Qcm[i + j * m];
      R[q * n + j] = dot;
      for (let i = 0; i < m; i++) Qcm[i + j * m] -= dot * Qcm[i + q * m];
    }

    // Re-orthogonalisation pass for numerical stability. Add corrections
    // into R as well (so A = Q·R holds to high precision).
    for (let q = 0; q < j; q++) {
      let dot = 0;
      for (let i = 0; i < m; i++) dot += Qcm[i + q * m] * Qcm[i + j * m];
      R[q * n + j] += dot;
      for (let i = 0; i < m; i++) Qcm[i + j * m] -= dot * Qcm[i + q * m];
    }

    // Normalise and record the diagonal of R.
    let norm = 0;
    for (let i = 0; i < m; i++) norm += Qcm[i + j * m] * Qcm[i + j * m];
    norm = Math.sqrt(norm);
    R[j * n + j] = norm;

    if (norm < 1e-14) {
      // Rank-deficient column: choose a unit vector orthogonal to the
      // previously computed q columns.  Try canonical basis vectors and
      // re-orthogonalise.
      for (let trial = 0; trial < m; trial++) {
        // Reset to e_trial.
        for (let i = 0; i < m; i++) Qcm[i + j * m] = i === trial ? 1 : 0;
        // Orthogonalise against q_0 .. q_{j-1} (twice).
        for (let pass = 0; pass < 2; pass++) {
          for (let q = 0; q < j; q++) {
            let dot = 0;
            for (let i = 0; i < m; i++) dot += Qcm[i + q * m] * Qcm[i + j * m];
            for (let i = 0; i < m; i++) Qcm[i + j * m] -= dot * Qcm[i + q * m];
          }
        }
        let n2 = 0;
        for (let i = 0; i < m; i++) n2 += Qcm[i + j * m] * Qcm[i + j * m];
        const nrm = Math.sqrt(n2);
        if (nrm > 1e-12) {
          for (let i = 0; i < m; i++) Qcm[i + j * m] /= nrm;
          break;
        }
      }
      // R[j*n+j] stays at 0 for the rank-deficient column.
    } else {
      for (let i = 0; i < m; i++) Qcm[i + j * m] /= norm;
    }

    // Fill in R[j, j+1..n-1] by projecting the *remaining* columns of A
    // through the current q_j.  This is the explicit upper triangular
    // entries of R that classical GS would otherwise miss.
    for (let c = j + 1; c < n; c++) {
      let dot = 0;
      for (let i = 0; i < m; i++) dot += Qcm[i + j * m] * aFlat[i * n + c];
      // Subtract previously-applied projections from this entry.
      // Actually we want R[j,c] = q_j · (A[:,c] - sum_{q<j} R[q,c] q_q).
      // Easier: R[j,c] = q_j · A[:,c] directly works because q_j is
      // orthogonal to q_0..q_{j-1}, so the projection components vanish
      // under the dot product with q_j.
      R[j * n + c] = dot;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2 (full mode only): extend Q with extra orthonormal columns to
  // make Q square (m × m).
  // ---------------------------------------------------------------------------
  if (mode === 'full' && k < m) {
    // Add canonical basis vectors and re-orthogonalise against existing columns.
    let nextCol = k;
    for (let trial = 0; trial < m && nextCol < m; trial++) {
      // Reset target column to e_trial.
      for (let i = 0; i < m; i++) Qcm[i + nextCol * m] = i === trial ? 1 : 0;
      // Orthogonalise against q_0..q_{nextCol-1} (twice).
      for (let pass = 0; pass < 2; pass++) {
        for (let q = 0; q < nextCol; q++) {
          let dot = 0;
          for (let i = 0; i < m; i++) dot += Qcm[i + q * m] * Qcm[i + nextCol * m];
          for (let i = 0; i < m; i++) Qcm[i + nextCol * m] -= dot * Qcm[i + q * m];
        }
      }
      let norm = 0;
      for (let i = 0; i < m; i++) norm += Qcm[i + nextCol * m] * Qcm[i + nextCol * m];
      norm = Math.sqrt(norm);
      if (norm > 1e-12) {
        for (let i = 0; i < m; i++) Qcm[i + nextCol * m] /= norm;
        nextCol++;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Convert Qcm (column-major, m × qWidth) back to row-major Float64Array.
  // ---------------------------------------------------------------------------
  const qRowMajor = new Float64Array(m * qWidth);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < qWidth; j++) {
      qRowMajor[i * qWidth + j] = Qcm[i + j * m];
    }
  }

  return {
    Q: new DenseMatrix(m, qWidth, qRowMajor),
    R: new DenseMatrix(rRows, n, R),
  };
}
