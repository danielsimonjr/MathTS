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

/**
 * Transpose a nested `number[][]` matrix (rows become columns).
 *
 * Reads `A[0].length` for the column count, so an empty `A` throws. Jagged rows
 * yield `undefined` at missing entries. This is the nested-array helper; the
 * DenseMatrix typed function is `transpose`. The public name is
 * `transposeNestedArray`.
 *
 * @param A - Input matrix with at least one row
 * @returns Transposed nested array of shape `n × m` when `A` is `m × n`
 *
 * @example
 * ```ts
 * import { transposeNestedArray } from '@danielsimonjr/mathts-matrix';
 *
 * const T = transposeNestedArray([
 *   [1, 2],
 *   [3, 4],
 * ]);
 * // T[0] === [1, 3], T[1] === [2, 4]
 * ```
 */
export function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  return Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

/**
 * Matrix inverse via Gauss-Jordan. Returns null on singular input.
 *
 * Pivot `|a| < 1e-15` is treated as singular. Not on the package barrel;
 * `logm` and `sqrtm` import it from this module.
 *
 * @internal
 */
export function matInv(A: number[][]): number[][] | null {
  const n = A.length;
  const identity = Array.from({ length: n }, (_, i) => {
    const row = new Array<number>(n).fill(0);
    row[i] = 1;
    return row;
  });
  return gaussJordanSolve(A, identity);
}

/**
 * Solve `A X = B` by Gauss–Jordan elimination with partial pivoting.
 *
 * `rhs[row]` is one row of `B` (one column, or the identity). Returns `null`
 * when a pivot satisfies `|pivot| < 1e-15`. A zero elimination factor is
 * skipped. Columns to the left of the pivot are already eliminated and are
 * not rewritten; the returned right-hand block matches a loop that rewrites
 * those columns too (checked on random systems before this helper replaced
 * the two copies).
 *
 * `matInv` passes the identity. `sqrtm`'s column solver passes one column.
 * {@link gaussJordanContinue} is a different policy: it skips a tiny pivot
 * instead of returning null, and its cutoff is a parameter.
 *
 * @param a - Square coefficient matrix. Not modified.
 * @param rhs - Right-hand side, one array per row, each of the same width.
 * @returns `X` with the same shape as `rhs`, or `null` when `A` is singular
 *   at the 1e-15 pivot cutoff. An empty `a` returns an empty array.
 */
export function gaussJordanSolve(a: number[][], rhs: number[][]): number[][] | null {
  const n = a.length;
  if (n === 0) return [];
  const width = rhs[0]?.length ?? 0;
  const M = a.map((row, i) => {
    const r = new Array<number>(n + width);
    for (let j = 0; j < n; j++) r[j] = row[j];
    const b = rhs[i] ?? [];
    for (let j = 0; j < width; j++) r[n + j] = b[j] ?? 0;
    return r;
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-15) return null;

    for (let j = col; j < n + width; j++) M[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = M[row][col];
      if (f === 0) continue;
      for (let j = col; j < n + width; j++) M[row][j] -= f * M[col][j];
    }
  }

  return M.map((row) => row.slice(n));
}

/**
 * In-place Gauss–Jordan elimination on an augmented matrix. Partial pivoting;
 * columns whose pivot satisfies `|pivot| < pivotTol` are skipped (no row scale);
 * zero elimination factors are skipped. Used by `matSolve` and `solveCol` with
 * different tolerances and RHS widths.
 *
 * @internal
 */
export function gaussJordanContinue(aug: number[][], n: number, pivotTol: number): void {
  const width = aug[0].length;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < pivotTol) continue;

    for (let j = col; j < width; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      if (factor === 0) continue;
      for (let j = col; j < width; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
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

/**
 * Dense matrix product **C = A × B** for nested `number[][]` arrays (row-major).
 *
 * Uses an i–k–j accumulation loop and skips multiplications when `A[i][k] === 0`.
 * Dimensions are `(m × p) · (p × n) → (m × n)`; `A` must be non-empty (`A[0]` is read
 * for the inner dimension). `B` must have at least one row so `B[0].length` is defined.
 *
 * @param A - Left factor, `m` rows × `p` columns
 * @param B - Right factor, `p` rows × `n` columns
 * @returns Product `C` with shape `m × n`
 *
 * @example
 * ```ts
 * import { matMul } from '@danielsimonjr/mathts-matrix';
 *
 * const C = matMul([[1, 2], [3, 4]], [[5, 6], [7, 8]]);
 * // C[0] === [19, 22], C[1] === [43, 50]
 * ```
 */
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
