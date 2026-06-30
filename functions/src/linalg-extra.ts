/**
 * Structured-matrix constructors + log-determinant (Wave C / bridges C2, C5).
 *
 * The constructors are pure index math; `logdet` reuses the matrix package's LU
 * (the same primitive `det`/`inv` acceleration uses) rather than re-implementing
 * elimination. These are the connectors the gap analysis flagged: Vandermonde ↔
 * interpolation, circulant ↔ FFT, companion ↔ polynomial roots, `logdet` ↔
 * Gaussian likelihoods (stats).
 */
import { DenseMatrix, lu } from '@danielsimonjr/mathts-matrix';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/** Lower-triangular part of `A`, zeroing entries above the `k`-th diagonal. */
export function tril(A: readonly number[][], k = 0): number[][] {
  return A.map((row, i) => row.map((v, j) => (j - i <= k ? v : 0)));
}

/** Upper-triangular part of `A`, zeroing entries below the `k`-th diagonal. */
export function triu(A: readonly number[][], k = 0): number[][] {
  return A.map((row, i) => row.map((v, j) => (j - i >= k ? v : 0)));
}

/**
 * Vandermonde matrix of `x`: column `j` is `xᵢ` to a power. With `increasing`
 * false (default, NumPy convention) column `j` is `xᵢ^(N-1-j)`; `N` defaults to
 * `x.length`.
 */
export function vander(x: Vec, n?: number, increasing = false): number[][] {
  const v = arr(x);
  const N = n ?? v.length;
  return v.map((xi) =>
    Array.from({ length: N }, (_, j) => Math.pow(xi, increasing ? j : N - 1 - j))
  );
}

/**
 * Toeplitz matrix: first column `c`, first row `r` (defaults to `c`). Constant
 * along each diagonal. `T[i][j] = c[i-j]` for `i ≥ j`, else `r[j-i]`.
 */
export function toeplitz(c: Vec, r?: Vec): number[][] {
  const col = arr(c);
  const row = r === undefined ? col : arr(r);
  const m = col.length;
  const n = row.length;
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i >= j ? col[i - j] : row[j - i]))
  );
}

/** Circulant matrix: each row is the previous one rotated right by one. */
export function circulant(c: Vec): number[][] {
  const col = arr(c);
  const n = col.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => col[(i - j + n) % n])
  );
}

/**
 * Companion matrix of a monic-normalized polynomial given by coefficients
 * `[a₀, a₁, …, a_n]` (highest degree first, NumPy `np.companion` convention).
 * Its eigenvalues are the polynomial's roots.
 */
export function companion(coeffs: Vec): number[][] {
  const a = arr(coeffs);
  const n = a.length - 1;
  if (n < 1) throw new Error('companion: need at least 2 coefficients');
  const C: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let j = 0; j < n; j++) C[0][j] = -a[j + 1] / a[0];
  for (let i = 1; i < n; i++) C[i][i - 1] = 1;
  return C;
}

/**
 * Graph Laplacian of an adjacency matrix (bridge graph ↔ linear algebra — spectral
 * graph theory). Combinatorial `L = D − A` by default (D = diagonal degree matrix);
 * with `{ normalized: true }`, the symmetric normalized Laplacian
 * `L_sym = I − D^(−1/2) A D^(−1/2)`. Eigen-analysis of `L` (via `eigs`) gives the
 * Fiedler vector / spectral clustering.
 */
export function laplacianMatrix(
  adjacency: readonly number[][],
  opts: { normalized?: boolean } = {}
): number[][] {
  const n = adjacency.length;
  const deg = adjacency.map((row) => row.reduce((s, v) => s + v, 0));
  if (opts.normalized) {
    const inv = deg.map((d) => (d > 0 ? 1 / Math.sqrt(d) : 0));
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0) - inv[i] * adjacency[i][j] * inv[j])
    );
  }
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? deg[i] : 0) - adjacency[i][j])
  );
}

/**
 * Natural log of the absolute determinant via LU (the `logabsdet` component of
 * `numpy.linalg.slogdet`), stable where `log(det(A))` would overflow. Returns
 * `{ sign, value }` with `det = sign · exp(value)`.
 */
export function logdet(A: readonly number[][]): { sign: number; value: number } {
  const { U, P } = lu(DenseMatrix.fromArray(A as number[][])) as {
    U: { toArray(): number[][] };
    P: number[];
  };
  const Ud = U.toArray();
  // permutation parity → sign
  const seen = new Array<boolean>(P.length).fill(false);
  let sign = 1;
  for (let i = 0; i < P.length; i++) {
    if (seen[i]) continue;
    let j = i;
    let len = 0;
    while (!seen[j]) {
      seen[j] = true;
      j = P[j];
      len++;
    }
    if (len % 2 === 0) sign = -sign;
  }
  let value = 0;
  for (let i = 0; i < Ud.length; i++) {
    const u = Ud[i][i];
    if (u < 0) sign = -sign;
    value += Math.log(Math.abs(u));
  }
  return { sign, value };
}
