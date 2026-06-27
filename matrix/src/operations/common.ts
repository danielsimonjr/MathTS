/**
 * Shared decomposition helpers (number[][] dense algebra)
 *
 * Canonical home for small matrix utilities that were previously duplicated
 * across the decomposition modules (eig, svd, schur, expm, logm, sqrtm). All
 * functions operate on plain 2-D `number[][]` arrays and are behavior-identical
 * to the per-file copies they replace.
 *
 * NOTE on `householder`: the degenerate "x is a negative multiple of e_1"
 * branch returns a parameterized `beta`. eig/svd use `beta = -2` (the default);
 * schur deliberately uses `beta = 2` (H = I − 2·e_1·e_1ᵀ = diag(−1, 1, …, 1)).
 * This intentional divergence is preserved by passing the desired value.
 */

// ---------------------------------------------------------------------------
// Structural helpers
// ---------------------------------------------------------------------------

/** Create an n × n identity matrix. */
export function eye(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

/** Clone a matrix (deep copy of rows). */
export function cloneMatrix(A: number[][]): number[][] {
  return A.map((row) => [...row]);
}

/** Transpose a matrix. */
export function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  return Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

/**
 * Check if a matrix is symmetric to within tolerance.
 * Returns true for empty matrices; false for non-square matrices.
 */
export function isSymmetric(matrix: number[][], tolerance: number = 1e-10): boolean {
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

// ---------------------------------------------------------------------------
// Dense algebra
// ---------------------------------------------------------------------------

/** Matrix multiply C = A × B. */
export function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const p = A[0].length;
  const n = B[0].length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < p; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < n; j++) C[i][j] += aik * B[k][j];
    }
  }
  return C;
}

/** Matrix addition A + B (square inputs). */
export function matAdd(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => A[i][j] + B[i][j])
  );
}

/** Matrix subtraction A − B (square inputs). */
export function matSub(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => A[i][j] - B[i][j])
  );
}

/** Scalar multiply: c · A. */
export function matScale(A: number[][], c: number): number[][] {
  return A.map((row) => row.map((v) => v * c));
}

/** Infinity-norm proxy (max absolute entry). */
export function normInf(A: number[][]): number {
  let mx = 0;
  for (const row of A) for (const v of row) if (Math.abs(v) > mx) mx = Math.abs(v);
  return mx;
}

/** 1-norm of a matrix (max column sum of absolute values). */
export function norm1(A: number[][]): number {
  const m = A.length;
  const n = A[0].length;
  let maxColSum = 0;
  for (let j = 0; j < n; j++) {
    let colSum = 0;
    for (let i = 0; i < m; i++) colSum += Math.abs(A[i][j]);
    if (colSum > maxColSum) maxColSum = colSum;
  }
  return maxColSum;
}

// ---------------------------------------------------------------------------
// Householder reflections
// ---------------------------------------------------------------------------

/**
 * Compute the Householder reflection vector for a column.
 *
 * For the degenerate case where `x` is a negative multiple of e_1
 * (`sigma === 0 && x[0] < 0`), the returned `beta` is `degenerateBeta`:
 *   - eig / svd use the default `-2`.
 *   - schur passes `2` (its deliberate divergence — see module header).
 */
export function householder(
  x: number[],
  degenerateBeta: number = -2
): { v: number[]; beta: number } {
  const n = x.length;
  let sigma = 0;
  for (let i = 1; i < n; i++) {
    sigma += x[i] * x[i];
  }

  const v = [...x];
  v[0] = 1;

  if (sigma === 0 && x[0] >= 0) {
    return { v, beta: 0 };
  } else if (sigma === 0 && x[0] < 0) {
    return { v, beta: degenerateBeta };
  } else {
    const mu = Math.sqrt(x[0] * x[0] + sigma);
    if (x[0] <= 0) {
      v[0] = x[0] - mu;
    } else {
      v[0] = -sigma / (x[0] + mu);
    }
    const beta = (2 * v[0] * v[0]) / (sigma + v[0] * v[0]);
    const v0 = v[0];
    for (let i = 0; i < n; i++) {
      v[i] /= v0;
    }
    return { v, beta };
  }
}

/**
 * Apply Householder reflection from the left: H = I − beta·v·vᵀ, computing
 * H·A in-place over columns [startCol, A[0].length) and rows starting at
 * `startRow` for `v.length` rows.
 */
export function applyHouseholderLeft(
  A: number[][],
  v: number[],
  beta: number,
  startRow: number,
  startCol: number
): void {
  const n = A[0].length;
  const len = v.length;

  for (let j = startCol; j < n; j++) {
    let dot = 0;
    for (let i = 0; i < len; i++) {
      dot += v[i] * A[startRow + i][j];
    }
    dot *= beta;
    for (let i = 0; i < len; i++) {
      A[startRow + i][j] -= dot * v[i];
    }
  }
}

/**
 * Apply Householder reflection from the right: H = I − beta·v·vᵀ, computing
 * A·H in-place over rows [startRow, A.length) and columns starting at
 * `startCol` for `v.length` columns.
 */
export function applyHouseholderRight(
  A: number[][],
  v: number[],
  beta: number,
  startRow: number,
  startCol: number
): void {
  const m = A.length;
  const len = v.length;

  for (let i = startRow; i < m; i++) {
    let dot = 0;
    for (let j = 0; j < len; j++) {
      dot += A[i][startCol + j] * v[j];
    }
    dot *= beta;
    for (let j = 0; j < len; j++) {
      A[i][startCol + j] -= dot * v[j];
    }
  }
}
