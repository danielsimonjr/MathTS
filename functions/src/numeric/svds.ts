/**
 * Sparse / partial SVD — the top-`k` singular triplets via Lanczos.
 *
 * For large or sparse `A` where a full dense `svd` (which factors the whole
 * matrix, O(m n min(m,n))) is wasteful, `svds` returns only the `k` largest
 * singular values and their left/right singular vectors. It runs the Lanczos
 * iteration (via {@link eigsh}) on the smaller of the two normal operators —
 * `AᵀA` (`n×n`) when `m ≥ n`, else `A Aᵀ` (`m×m`) — never forming that product
 * explicitly: each Lanczos matvec is a matvec by `A` followed by one by `Aᵀ`.
 * The singular values are the square roots of the Ritz eigenvalues; the
 * complementary singular vectors come from the defining relations
 * `A vⱼ = σⱼ uⱼ` and `Aᵀ uⱼ = σⱼ vⱼ`.
 *
 * Because the top singular values are the *largest* eigenvalues of the normal
 * operator, squaring costs no accuracy there (unlike the smallest, where `κ²`
 * conditioning would bite) — this method targets the `'LM'` end only.
 *
 * @packageDocumentation
 */
import { eigsh } from './eigsh.js';

/** Options accepted by {@link svds}. */
export interface SvdsOptions {
  /** Convergence tolerance forwarded to the Lanczos eigensolver (default 1e-10). */
  tol?: number;
  /** Maximum Lanczos steps (default `min(max(2k + 20, 20), dim)`). */
  maxIter?: number;
}

/**
 * Result of {@link svds}. Singular values are returned **descending**
 * (`s[0]` largest — matching this library's full {@link svd}); note this is the
 * opposite of `scipy.sparse.linalg.svds`, which returns them ascending.
 * Singular vectors are stored as **columns**: `U[i][j]` is the `i`-th component
 * of the `j`-th left singular vector (for `s[j]`), and likewise `V` for the
 * right singular vectors.
 */
export interface SvdsResult {
  /** Left singular vectors, `m × k`, as columns. */
  U: number[][];
  /** The `k` largest singular values, descending. */
  s: number[];
  /** Right singular vectors, `n × k`, as columns. */
  V: number[][];
}

function matvecA(A: number[][], x: number[]): number[] {
  return A.map((row) => {
    let s = 0;
    for (let j = 0; j < row.length; j++) s += row[j] * x[j];
    return s;
  });
}

function matvecAt(A: number[][], y: number[], n: number): number[] {
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < A.length; i++) {
    const yi = y[i];
    const row = A[i];
    for (let j = 0; j < n; j++) out[j] += row[j] * yi;
  }
  return out;
}

function norm2(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

/**
 * The `k` largest singular triplets of `A` (dense `m × n`) via Lanczos on the
 * smaller normal operator.
 *
 * @example
 * svds([[1,2,0],[0,3,1],[4,0,2]], 2) // => { U, s: [σ₁, σ₂] (descending), V }
 */
export function svds(A: number[][], k = 1, opts?: SvdsOptions): SvdsResult {
  const m = A.length;
  const n = A[0]?.length ?? 0;
  if (m === 0 || n === 0 || A.some((row) => row.length !== n)) {
    throw new Error('svds: A must be a non-empty rectangular matrix');
  }
  const minDim = Math.min(m, n);
  if (!Number.isInteger(k) || k < 1 || k > minDim) {
    throw new Error(`svds: k must be an integer between 1 and min(m,n)=${minDim}, got ${k}`);
  }

  const tol = opts?.tol ?? 1e-10;
  const useAtA = m >= n; // eigensolve on the smaller of AᵀA (n×n) / AAᵀ (m×m)
  const dim = useAtA ? n : m;

  // Normal-operator matvec (AᵀA·x or AAᵀ·x) — never forms the product.
  const normalOp = useAtA
    ? (x: number[]) => matvecAt(A, matvecA(A, x), n)
    : (x: number[]) => matvecA(A, matvecAt(A, x, n));

  const { eigenvalues, eigenvectors } = eigsh(normalOp, k, {
    which: 'LM',
    n: dim,
    tol,
    maxIter: opts?.maxIter,
  });

  const s = eigenvalues.map((lambda) => Math.sqrt(Math.max(0, lambda)));

  // `primary` holds the eigenvectors of the normal operator (V if useAtA, else
  // U); derive the complementary factor from A vⱼ = σⱼ uⱼ (or Aᵀ uⱼ = σⱼ vⱼ).
  const primaryDim = dim;
  const otherDim = useAtA ? m : n;
  const primary: number[][] = Array.from({ length: primaryDim }, () =>
    new Array<number>(k).fill(0)
  );
  const other: number[][] = Array.from({ length: otherDim }, () => new Array<number>(k).fill(0));

  for (let col = 0; col < k; col++) {
    const pvec = eigenvectors.map((row) => row[col]); // length primaryDim
    for (let i = 0; i < primaryDim; i++) primary[i][col] = pvec[i];

    // Complementary vector = (A·pvec)/σ  (useAtA) or (Aᵀ·pvec)/σ  (else).
    let ovec = useAtA ? matvecA(A, pvec) : matvecAt(A, pvec, n);
    const nrm = norm2(ovec);
    ovec = nrm > 1e-300 ? ovec.map((v) => v / nrm) : ovec;
    for (let i = 0; i < otherDim; i++) other[i][col] = ovec[i];
  }

  return useAtA ? { U: other, s, V: primary } : { U: primary, s, V: other };
}
