import { gemmF64 } from '../types/dense/gemm-f64.js';

/**
 * Shared decomposition helpers (number[][] dense algebra)
 *
 * Canonical home for small matrix utilities that were previously duplicated
 * across the decomposition modules (eig, svd, schur, expm, logm, sqrtm). All
 * functions operate on plain 2-D `number[][]` arrays and are behavior-identical
 * to the per-file copies they replace.
 *
 * NOTE on `householder`: the degenerate "x is a negative multiple of e_1"
 * branch returns a parameterized `beta`. The default is `beta = 2`
 * (H = I − 2·e_1·e_1ᵀ = diag(−1, 1, …, 1)). H = I − beta·v·vᵀ is orthogonal only for
 * `beta` 0 or 2, so no other value is valid here (#1082).
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
  const ad = new Float64Array(m * p);
  const bd = new Float64Array(p * n);
  for (let i = 0; i < m; i++) {
    const row = A[i];
    const off = i * p;
    for (let k = 0; k < p; k++) ad[off + k] = row[k];
  }
  for (let k = 0; k < p; k++) {
    const row = B[k];
    const off = k * n;
    for (let j = 0; j < n; j++) bd[off + j] = row[j];
  }
  const flat = gemmF64(ad, bd, m, p, n, undefined, { skipZeroInA: true });
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    const row = C[i];
    const off = i * n;
    for (let j = 0; j < n; j++) row[j] = flat[off + j];
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

/**
 * Scale windows for the largest entry |a|max of a matrix, as exponents of 2 (#1104).
 * - `SQUARED`: a kernel that squares entries (norms, Householder and Givens vectors)
 *   overflows above about 2^512 and loses digits below about 2^-512.
 * - `FOURTH`: a kernel that forms fourth powers (the Wilkinson shift, sigma^2 of a
 *   bidiagonal step) overflows above about 2^256.
 * - `ABS_CUTOFF_LO`: a kernel with absolute cutoffs (1e-8 symmetry test, 1e-14 pivot
 *   floors) reads a tiny matrix as zero, so its window starts at 2^-20.
 */
export const SQUARED = 400;
export const FOURTH = 128;
export const ABS_CUTOFF_LO = -20;

/**
 * The exponent `e` that moves `amax` into the window [2^lo, 2^hi]. It is 0 inside the
 * window and for a zero or non-finite `amax`. A larger `amax` goes to the top of the
 * window, [2^(hi-1), 2^hi); a smaller one goes to [1, 2). The edges are compared
 * directly, so a value at an edge is inside the window.
 */
export function pow2ScaleExponent(amax: number, lo: number, hi: number): number {
  if (!(amax > 0) || amax === Infinity) return 0;
  if (amax >= 2 ** lo && amax <= 2 ** hi) return 0;
  const k = Math.floor(Math.log2(amax));
  return amax > 2 ** hi ? hi - 1 - k : -k;
}

/** `x · 2^e`, exact; the factor is split in two so that 2^e itself cannot overflow. */
export function ldexp(x: number, e: number): number {
  const h = Math.trunc(e / 2);
  return x * 2 ** h * 2 ** (e - h);
}

/** Scale every entry of `A` by 2^e in place. */
export function ldexpMatrix(A: number[][], e: number): void {
  for (const row of A) for (let j = 0; j < row.length; j++) row[j] = ldexp(row[j], e);
}

/** The largest and the smallest nonzero |entry|; `finite` is false when an entry is NaN or infinite. */
export interface EntryRange {
  amax: number;
  amin: number;
  finite: boolean;
}

/** The entry range of a nested matrix or a flat array. It stops at the first NaN or infinite entry. */
export function entryRange(values: readonly (readonly number[])[] | ArrayLike<number>): EntryRange {
  let amax = 0;
  let amin = Infinity;
  const visit = (v: number): boolean => {
    const x = Math.abs(v);
    if (!(x < Infinity)) return false;
    if (x > amax) amax = x;
    if (x > 0 && x < amin) amin = x;
    return true;
  };
  const len = values.length;
  for (let i = 0; i < len; i++) {
    const item = (values as ArrayLike<number | readonly number[]>)[i];
    if (typeof item === 'number') {
      if (!visit(item)) return { amax, amin, finite: false };
    } else {
      for (let j = 0; j < item.length; j++)
        if (!visit(item[j])) return { amax, amin, finite: false };
    }
  }
  return { amax, amin, finite: true };
}

/** True when every number in a result (number, array, typed array or plain object) is finite. */
export function allFinite(x: unknown): boolean {
  if (typeof x === 'number') return Number.isFinite(x);
  if (x === null || typeof x !== 'object') return true;
  const t = x as { toFloat64Array?: () => Float64Array };
  if (typeof t.toFloat64Array === 'function') return allFinite(t.toFloat64Array());
  if (Array.isArray(x) || ArrayBuffer.isView(x)) {
    const a = x as unknown as ArrayLike<unknown>;
    for (let i = 0; i < a.length; i++) if (!allFinite(a[i])) return false;
    return true;
  }
  return Object.values(x).every(allFinite);
}

/**
 * Run a kernel with the input scaled into the window [2^lo, 2^hi] (#1104).
 * `run(e)` computes the result for the input times 2^e and returns it scaled back;
 * `run(0)` is the unscaled kernel. The rules:
 * - A matrix with a NaN or infinite entry, or one inside the window, takes `run(0)`.
 * - `even` makes `e` even (lower by one), so a square root of 2^e is exact.
 * - When 2^e would push a nonzero entry below 2^-1022 (the entries span more than the
 *   double range), the unscaled result is kept when it is finite; else `run(e)`.
 */
export function withPow2Scale<T>(
  range: EntryRange,
  lo: number,
  hi: number,
  run: (e: number) => T,
  even = false
): T {
  if (!range.finite) return run(0);
  let e = pow2ScaleExponent(range.amax, lo, hi);
  if (even && e % 2 !== 0) e -= 1;
  if (e === 0) return run(0);
  if (e < 0 && ldexp(range.amin, e) < 2 ** -1022) {
    let unscaled: T | undefined;
    let ok = true;
    try {
      unscaled = run(0);
    } catch {
      ok = false;
    }
    if (ok && allFinite(unscaled)) return unscaled as T;
  }
  return run(e);
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
 * (`sigma === 0 && x[0] < 0`), the returned `beta` is `degenerateBeta`. The default is `2`,
 * the only orthogonal reflection besides the identity (beta 0). Before #1082 the default was
 * `-2`, which scaled the row by 3 and gave wrong singular values.
 */
export function householder(
  x: number[],
  degenerateBeta: number = 2
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
