/**
 * Structured-matrix constructors + log-determinant (Wave C / bridges C2, C5).
 *
 * The constructors are pure index math; `logdet` reuses the matrix package's LU
 * (the same primitive `det`/`inv` acceleration uses) rather than re-implementing
 * elimination. These are the connectors the gap analysis flagged: Vandermonde ↔
 * interpolation, circulant ↔ FFT, companion ↔ polynomial roots, `logdet` ↔
 * Gaussian likelihoods (stats).
 */
import { DenseMatrix, lu, matrixSchur } from '@danielsimonjr/mathts-matrix';
import { inv as _invRaw, eigs as _eigsRaw, qr as _qrRaw } from './factories/index.js';
import { multiply as _multiplyRaw } from './typed/arithmetic.js';

const _inv = _invRaw as unknown as (m: number[][]) => number[][];
const _eigs = _eigsRaw as unknown as (m: number[][]) => {
  values: Array<number | { re: number; im: number }>;
  eigenvectors?: unknown;
};
const _multiply = _multiplyRaw as unknown as (a: number[][], b: number[][]) => number[][];
const _qr = _qrRaw as unknown as (m: number[][]) => { Q: number[][]; R: number[][] };

const transposeArr = (A: number[][]): number[][] => A[0].map((_, j) => A.map((r) => r[j]));

/**
 * Real Schur decomposition `M = U S Uᵀ` (U orthogonal, S quasi-upper-triangular),
 * delegated to the matrix package's hardened `matrixSchur` — Householder reduction
 * to upper Hessenberg followed by **Francis double-shift** implicit QR with
 * exceptional-shift stall breaking (Golub & Van Loan §7.5). The earlier homegrown
 * single-shift QR here (no Hessenberg reduction) stalled on non-symmetric `B⁻¹A`
 * pencils — e.g. it threw "failed to converge" on `A=[[1,2,0],[0,3,1],[1,0,4]]`,
 * `B=diag(2,1,3)` (all-real spectrum). Routing to the maintained, oracle-pinned
 * matrix-layer primitive is the native-accel pattern (prefer the matrix
 * decomposition over a second, weaker copy).
 */
function realSchur(M: number[][]): { U: number[][]; S: number[][] } {
  const { Q, T } = matrixSchur(DenseMatrix.fromArray(M));
  return { U: Q.toArray(), S: T.toArray() };
}

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/**
 * Generalized eigenvalues of the pencil `A x = λ B x` (B nonsingular), via the
 * eigendecomposition of `B⁻¹A` — reusing `inv`, `multiply`, and the corrected
 * `eigs` (Hessenberg + Francis double-shift). Eigenvalues match
 * `scipy.linalg.eig(A, B)` across real, complex-pair and clustered spectra. For
 * a *singular* or numerically near-singular `B` this squaring-free QZ formulation
 * breaks down; extracting the pencil eigenvalues directly from the {@link qz}
 * factors (`diag AA / diag BB`, with 2×2-block handling for complex pairs) is the
 * future enhancement for that regime.
 */
export function generalizedEig(
  A: readonly number[][],
  B: readonly number[][]
): { values: Array<number | { re: number; im: number }>; eigenvectors?: unknown } {
  const Binv = _inv(B as number[][]);
  const M = _multiply(Binv, A as number[][]);
  return _eigs(M);
}

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
  if (a[0] === 0) throw new Error('companion: leading coefficient must be nonzero');
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

/**
 * Generalized (QZ) Schur decomposition of the pencil `(A, B)` with `B` nonsingular:
 * returns orthogonal `Q`, `Z` and upper-(quasi-)triangular `AA`, `BB` with
 * `A = Q·AA·Zᵀ` and `B = Q·BB·Zᵀ`. Built from the real Schur of `B⁻¹A` (= Z S Zᵀ) and
 * the QR of `B·Z` (= Q·BB): then `AA = Qᵀ·A·Z`. The Schur step is the hardened
 * Hessenberg + Francis double-shift `matrixSchur` (see {@link realSchur}), so `qz`
 * no longer stalls on non-symmetric `B⁻¹A` pencils; matches the decomposition
 * contract of `scipy.linalg.qz` (the factors are not unique).
 */
export function qz(
  A: readonly number[][],
  B: readonly number[][]
): { AA: number[][]; BB: number[][]; Q: number[][]; Z: number[][] } {
  const Aa = A as number[][];
  const Bb = B as number[][];
  const M = _multiply(_inv(Bb), Aa);
  const { U: Z } = realSchur(M); // M = Z S Zᵀ
  const { Q, R } = _qr(_multiply(Bb, Z)); // B·Z = Q·R  ⇒ BB = Qᵀ·B·Z = R
  const Qt = transposeArr(Q);
  const AA = _multiply(_multiply(Qt, Aa), Z); // Qᵀ·A·Z
  return { AA, BB: R, Q, Z };
}
