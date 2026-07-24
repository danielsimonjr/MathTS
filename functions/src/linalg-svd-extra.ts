/**
 * `orth` — orthonormal basis for the column space of a matrix.
 *
 * Built directly on the matrix package's full `svd` (imported from
 * `@danielsimonjr/mathts-matrix`, NOT from this package's own `./index.js`,
 * to avoid a module cycle): the numerical rank `r` is the count of singular
 * values exceeding a tolerance (numpy/MATLAB `orth` convention), and the
 * result is the leading `r` columns of `U`.
 */
import { svd } from '@danielsimonjr/mathts-matrix';

/** Options for {@link orth}. */
export interface OrthOptions {
  /**
   * Rank-determination tolerance. Singular values `> tol` count toward the
   * rank. Default: `max(m, n) * S[0] * 2.22e-16` (machine epsilon scaled by
   * matrix size and the largest singular value).
   */
  tol?: number;
}

/**
 * Orthonormal basis for the column space of `A`.
 *
 * Computes `{ U, S } = svd(A)` and returns the first `r` columns of `U`,
 * where `r` is the number of singular values above `tol`. For the all-zero
 * matrix (`r = 0`), returns an `m x 0` matrix (each row an empty array).
 *
 * @example
 * orth([[1,0,1],[0,1,1],[1,1,2]])  // rank 2 -> 3x2 matrix, U^T U = I
 */
export function orth(A: number[][], opts: OrthOptions = {}): number[][] {
  const { U, S } = svd(A);
  const m = A.length;
  const n = A[0]?.length ?? 0;
  const s0 = S[0] ?? 0;
  const tol = opts.tol ?? Math.max(m, n) * s0 * 2.22e-16;
  const rank = S.filter((s) => s > tol).length;
  return U.map((row) => row.slice(0, rank));
}
