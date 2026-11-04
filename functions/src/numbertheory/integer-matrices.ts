/**
 * Integer normal forms: row-style Hermite normal form, Smith normal form (with
 * invariant factors) and the LLL lattice-basis reduction over floats.
 */

type IntMatrix = bigint[][];

function toBigMatrix(A: ReadonlyArray<readonly (number | bigint)[]>): IntMatrix {
  const cols = A.length === 0 ? 0 : A[0].length;
  return A.map((row) => {
    if (row.length !== cols) throw new RangeError('matrix rows must have equal length');
    return row.map((x) => {
      if (typeof x === 'number' && !Number.isSafeInteger(x)) {
        throw new RangeError('matrix entries must be integers');
      }
      return BigInt(x);
    });
  });
}

/** Floor division for bigints (rounds toward negative infinity). */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

function absBig(x: bigint): bigint {
  return x < 0n ? -x : x;
}

/** row_i -= q * row_j */
function rowSub(M: IntMatrix, i: number, j: number, q: bigint): void {
  if (q === 0n) return;
  for (let c = 0; c < M[i].length; c++) M[i][c] -= q * M[j][c];
}

/**
 * Row-style Hermite normal form (upper-triangular echelon form obtained by
 * unimodular row operations): positive pivots, and entries above each pivot
 * reduced into [0, pivot).
 */
export function hermiteNormalForm(A: ReadonlyArray<readonly (number | bigint)[]>): bigint[][] {
  const M = toBigMatrix(A);
  const rows = M.length;
  const cols = rows === 0 ? 0 : M[0].length;
  const pivots: Array<{ row: number; col: number }> = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    // Euclid on column c among rows r..rows-1.
    for (;;) {
      let best = -1;
      for (let i = r; i < rows; i++) {
        if (M[i][c] !== 0n && (best < 0 || absBig(M[i][c]) < absBig(M[best][c]))) best = i;
      }
      if (best < 0) break;
      [M[r], M[best]] = [M[best], M[r]];
      let done = true;
      for (let i = r + 1; i < rows; i++) {
        if (M[i][c] !== 0n) {
          rowSub(M, i, r, M[i][c] / M[r][c]);
          if (M[i][c] !== 0n) done = false;
        }
      }
      if (done) break;
    }
    if (M[r][c] === 0n) continue;
    if (M[r][c] < 0n) M[r] = M[r].map((x) => -x);
    pivots.push({ row: r, col: c });
    r++;
  }
  // Reduce entries above each pivot into [0, pivot).
  for (const { row, col } of pivots) {
    const p = M[row][col];
    for (let i = 0; i < row; i++) {
      rowSub(M, i, row, floorDiv(M[i][col], p));
    }
  }
  return M;
}

/**
 * Smith normal form: diagonal matrix D with d1 | d2 | ... (positive, zero
 * padding allowed) equivalent to A under unimodular row and column operations.
 * `invariants` lists the diagonal entries d1..d_min(m,n).
 */
export function smithNormalForm(A: ReadonlyArray<readonly (number | bigint)[]>): {
  D: bigint[][];
  invariants: bigint[];
} {
  const M = toBigMatrix(A);
  const m = M.length;
  const n = m === 0 ? 0 : M[0].length;
  const minDim = Math.min(m, n);

  for (let t = 0; t < minDim; t++) {
    // Move the smallest nonzero entry of the submatrix to (t, t).
    let found = false;
    let bi = t;
    let bj = t;
    let best = 0n;
    for (let i = t; i < m; i++) {
      for (let j = t; j < n; j++) {
        const v = absBig(M[i][j]);
        if (v !== 0n && (!found || v < best)) {
          found = true;
          best = v;
          bi = i;
          bj = j;
        }
      }
    }
    if (!found) break;
    [M[t], M[bi]] = [M[bi], M[t]];
    for (let i = 0; i < m; i++) [M[i][t], M[i][bj]] = [M[i][bj], M[i][t]];

    let clean = false;
    while (!clean) {
      clean = true;
      // Clear column t below the pivot.
      for (let i = t + 1; i < m; i++) {
        if (M[i][t] !== 0n) {
          rowSub(M, i, t, M[i][t] / M[t][t]);
          if (M[i][t] !== 0n) {
            [M[t], M[i]] = [M[i], M[t]];
            clean = false;
          }
        }
      }
      // Clear row t to the right of the pivot.
      for (let j = t + 1; j < n; j++) {
        if (M[t][j] !== 0n) {
          const q = M[t][j] / M[t][t];
          for (let i = t; i < m; i++) M[i][j] -= q * M[i][t];
          if (M[t][j] !== 0n) {
            for (let i = 0; i < m; i++) [M[i][t], M[i][j]] = [M[i][j], M[i][t]];
            clean = false;
          }
        }
      }
      if (!clean) continue;
      // Divisibility: the pivot must divide every remaining entry.
      const p = M[t][t];
      for (let i = t + 1; i < m && clean; i++) {
        for (let j = t + 1; j < n && clean; j++) {
          if (M[i][j] % p !== 0n) {
            rowSub(M, t, i, -1n); // row_t += row_i brings the offending entry into row t
            clean = false;
          }
        }
      }
    }
    if (M[t][t] < 0n) M[t] = M[t].map((x) => -x);
  }

  const D: bigint[][] = Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j && i < minDim ? M[i][j] : 0n))
  );
  const invariants: bigint[] = [];
  for (let t = 0; t < minDim; t++) invariants.push(D[t][t]);
  return { D, invariants };
}

/**
 * LLL reduction of a lattice basis given as row vectors (Lenstra–Lenstra–Lovász
 * with Lovász parameter `delta`, default 0.75), in floating point with
 * Gram–Schmidt recomputed after each change.
 */
export function lll(basis: ReadonlyArray<readonly number[]>, delta = 0.75): number[][] {
  if (!(delta > 0.25 && delta < 1)) throw new RangeError('delta must lie in (0.25, 1)');
  const b: number[][] = basis.map((row) => [...row]);
  const n = b.length;
  if (n === 0) return [];
  const dim = b[0].length;
  if (b.some((row) => row.length !== dim))
    throw new RangeError('basis vectors must have equal length');

  const dot = (x: readonly number[], y: readonly number[]): number => {
    let s = 0;
    for (let i = 0; i < x.length; i++) s += x[i] * y[i];
    return s;
  };

  // Gram–Schmidt: returns mu (lower-triangular) and squared norms B*.
  const gramSchmidt = (): { mu: number[][]; bStar: number[][]; norm2: number[] } => {
    const bStar: number[][] = [];
    const mu: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const norm2: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = [...b[i]];
      for (let j = 0; j < i; j++) {
        mu[i][j] = dot(b[i], bStar[j]) / norm2[j];
        for (let c = 0; c < dim; c++) v[c] -= mu[i][j] * bStar[j][c];
      }
      bStar.push(v);
      norm2.push(dot(v, v));
    }
    return { mu, bStar, norm2 };
  };

  let k = 1;
  while (k < n) {
    let gs = gramSchmidt();
    for (let j = k - 1; j >= 0; j--) {
      const mu0 = gs.mu[k][j];
      // Ties (|mu| = 1/2) round toward zero; any integer q with |mu - q| <= 1/2 keeps the LLL size bound.
      const q = Math.sign(mu0) * Math.ceil(Math.abs(mu0) - 0.5);
      if (q !== 0) {
        for (let c = 0; c < dim; c++) b[k][c] -= q * b[j][c];
        gs = gramSchmidt();
      }
    }
    if (gs.norm2[k] === 0) throw new RangeError('basis vectors are linearly dependent');
    const mu = gs.mu[k][k - 1];
    if (gs.norm2[k] >= (delta - mu * mu) * gs.norm2[k - 1]) {
      k++;
    } else {
      [b[k], b[k - 1]] = [b[k - 1], b[k]];
      k = Math.max(1, k - 1);
    }
  }
  return b;
}
