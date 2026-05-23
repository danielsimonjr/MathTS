/**
 * Eigenvalue and Eigenvector Decomposition
 *
 * Implements eigenvalue computation using QR algorithm and
 * eigenvector extraction using inverse iteration.
 */

/**
 * Result of eigenvalue decomposition
 */
export interface EigResult {
  /** Eigenvalues (may be complex for non-symmetric matrices) */
  values: Array<{ re: number; im: number }>;
  /** Eigenvectors as columns (each column is an eigenvector) */
  vectors: number[][];
  /** Whether the matrix was symmetric */
  isSymmetric: boolean;
}

/**
 * Options for eigenvalue computation
 */
export interface EigOptions {
  /** Maximum number of QR iterations */
  maxIterations?: number;
  /** Convergence tolerance */
  tolerance?: number;
  /** Whether to compute eigenvectors */
  computeVectors?: boolean;
}

const DEFAULT_MAX_ITERATIONS = 1000;
const DEFAULT_TOLERANCE = 1e-12;

/**
 * Check if a matrix is symmetric
 */
function isSymmetric(matrix: number[][], tolerance: number = 1e-10): boolean {
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

/**
 * Create identity matrix
 */
function eye(n: number): number[][] {
  const I = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    I[i][i] = 1;
  }
  return I;
}

/**
 * Clone a matrix
 */
function cloneMatrix(A: number[][]): number[][] {
  return A.map((row) => [...row]);
}

/**
 * Compute Householder reflection vector for a column
 */
function householder(x: number[]): { v: number[]; beta: number } {
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
    return { v, beta: -2 };
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
 * Apply Householder reflection: H = I - beta*v*v'
 * Computes H*A in-place
 */
function applyHouseholderLeft(
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
 * Apply Householder reflection: H = I - beta*v*v'
 * Computes A*H in-place
 */
function applyHouseholderRight(
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

/**
 * Reduce matrix to upper Hessenberg form using Householder reflections
 * Returns H and Q where A = Q*H*Q'
 */
function hessenberg(A: number[][]): { H: number[][]; Q: number[][] } {
  const n = A.length;
  const H = cloneMatrix(A);
  const Q = eye(n);

  for (let k = 0; k < n - 2; k++) {
    // Extract column below diagonal
    const x: number[] = [];
    for (let i = k + 1; i < n; i++) {
      x.push(H[i][k]);
    }

    const { v, beta } = householder(x);

    if (beta !== 0) {
      // H = P*H*P where P = I - beta*v*v'
      applyHouseholderLeft(H, v, beta, k + 1, k);
      applyHouseholderRight(H, v, beta, 0, k + 1);

      // Accumulate Q = Q*P
      applyHouseholderRight(Q, v, beta, 0, k + 1);
    }
  }

  // Clean up small values below subdiagonal
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i - 1; j++) {
      H[i][j] = 0;
    }
  }

  return { H, Q };
}

/**
 * Compute Givens rotation parameters for a 2x2 block
 */
function givens(a: number, b: number): { c: number; s: number } {
  if (b === 0) {
    return { c: 1, s: 0 };
  } else if (Math.abs(b) > Math.abs(a)) {
    const t = -a / b;
    const s = 1 / Math.sqrt(1 + t * t);
    return { c: s * t, s };
  } else {
    const t = -b / a;
    const c = 1 / Math.sqrt(1 + t * t);
    return { c, s: c * t };
  }
}

/**
 * Apply Givens rotation to rows i and k
 */
function applyGivensLeft(
  A: number[][],
  c: number,
  s: number,
  i: number,
  k: number,
  startCol: number
): void {
  const n = A[0].length;
  for (let j = startCol; j < n; j++) {
    const temp = c * A[i][j] - s * A[k][j];
    A[k][j] = s * A[i][j] + c * A[k][j];
    A[i][j] = temp;
  }
}

/**
 * Apply Givens rotation to columns i and k
 */
function applyGivensRight(
  A: number[][],
  c: number,
  s: number,
  i: number,
  k: number,
  startRow: number
): void {
  const m = A.length;
  for (let j = startRow; j < m; j++) {
    const temp = c * A[j][i] - s * A[j][k];
    A[j][k] = s * A[j][i] + c * A[j][k];
    A[j][i] = temp;
  }
}

/**
 * QR step with implicit shift for Hessenberg matrix
 */
function qrStep(H: number[][], Q: number[][], start: number, end: number): void {
  const n = end - start + 1;
  if (n < 2) return;

  // Wilkinson shift - eigenvalue of bottom 2x2 closer to H[end][end]
  const a = H[end - 1][end - 1];
  const b = H[end - 1][end];
  const c = H[end][end - 1];
  const d = H[end][end];

  const trace = a + d;
  const det = a * d - b * c;
  const disc = trace * trace - 4 * det;

  let shift: number;
  if (disc >= 0) {
    const sqrtDisc = Math.sqrt(disc);
    const e1 = (trace + sqrtDisc) / 2;
    const e2 = (trace - sqrtDisc) / 2;
    shift = Math.abs(e1 - d) < Math.abs(e2 - d) ? e1 : e2;
  } else {
    shift = d;
  }

  // First column of H - shift*I
  let x = H[start][start] - shift;
  let y = H[start + 1][start];

  for (let k = start; k < end; k++) {
    const { c, s } = givens(x, y);

    // Apply G from left: G' * H
    applyGivensLeft(H, c, s, k, k + 1, Math.max(0, k - 1));

    // Apply G from right: H * G
    applyGivensRight(H, c, s, k, k + 1, 0);

    // Accumulate Q = Q * G
    applyGivensRight(Q, c, s, k, k + 1, 0);

    if (k < end - 1) {
      x = H[k + 1][k];
      y = H[k + 2][k];
    }
  }
}

/**
 * Francis double-shift QR step for complex eigenvalues
 */
function doubleShiftQR(H: number[][], Q: number[][], start: number, end: number): void {
  // Get shifts from bottom 2x2
  const n = H.length;
  const a = H[end - 1][end - 1];
  const b = H[end - 1][end];
  const c = H[end][end - 1];
  const d = H[end][end];

  const s = a + d; // trace
  const t = a * d - b * c; // determinant

  // First column of (H - s1*I)(H - s2*I) = H^2 - s*H + t*I
  let x =
    H[start][start] * H[start][start] +
    H[start][start + 1] * H[start + 1][start] -
    s * H[start][start] +
    t;
  let y = H[start + 1][start] * (H[start][start] + H[start + 1][start + 1] - s);
  let z = H[start + 1][start] * H[start + 2][start + 1];

  for (let k = start; k <= end - 2; k++) {
    // Householder to zero out y and z
    const { v, beta } = householder([x, y, z]);

    const q = Math.max(start, k - 1);

    // Apply from left
    for (let j = q; j < n; j++) {
      let dot = v[0] * H[k][j] + v[1] * H[k + 1][j] + v[2] * H[k + 2][j];
      dot *= beta;
      H[k][j] -= dot * v[0];
      H[k + 1][j] -= dot * v[1];
      H[k + 2][j] -= dot * v[2];
    }

    // Apply from right
    const r = Math.min(k + 4, end + 1);
    for (let i = 0; i < r; i++) {
      let dot = v[0] * H[i][k] + v[1] * H[i][k + 1] + v[2] * H[i][k + 2];
      dot *= beta;
      H[i][k] -= dot * v[0];
      H[i][k + 1] -= dot * v[1];
      H[i][k + 2] -= dot * v[2];
    }

    // Accumulate Q
    for (let i = 0; i < n; i++) {
      let dot = v[0] * Q[i][k] + v[1] * Q[i][k + 1] + v[2] * Q[i][k + 2];
      dot *= beta;
      Q[i][k] -= dot * v[0];
      Q[i][k + 1] -= dot * v[1];
      Q[i][k + 2] -= dot * v[2];
    }

    // Prepare next bulge
    x = H[k + 1][k];
    y = H[k + 2][k];
    if (k < end - 2) {
      z = H[k + 3][k];
    }
  }

  // Final 2x2 Givens
  const { c: cFinal, s: sFinal } = givens(x, y);
  applyGivensLeft(H, cFinal, sFinal, end - 1, end, end - 2);
  applyGivensRight(H, cFinal, sFinal, end - 1, end, 0);
  applyGivensRight(Q, cFinal, sFinal, end - 1, end, 0);
}

/**
 * Extract eigenvalues from quasi-upper-triangular Schur form
 */
function extractEigenvalues(H: number[][], tolerance: number): Array<{ re: number; im: number }> {
  const n = H.length;
  const eigenvalues: Array<{ re: number; im: number }> = [];

  let i = 0;
  while (i < n) {
    if (i === n - 1 || Math.abs(H[i + 1][i]) <= tolerance) {
      // Real eigenvalue
      eigenvalues.push({ re: H[i][i], im: 0 });
      i++;
    } else {
      // Complex conjugate pair from 2x2 block
      const a = H[i][i];
      const b = H[i][i + 1];
      const c = H[i + 1][i];
      const d = H[i + 1][i + 1];

      const trace = a + d;
      const det = a * d - b * c;
      const disc = trace * trace - 4 * det;

      if (disc >= 0) {
        // Two real eigenvalues
        const sqrtDisc = Math.sqrt(disc);
        eigenvalues.push({ re: (trace + sqrtDisc) / 2, im: 0 });
        eigenvalues.push({ re: (trace - sqrtDisc) / 2, im: 0 });
      } else {
        // Complex conjugate pair
        const realPart = trace / 2;
        const imagPart = Math.sqrt(-disc) / 2;
        eigenvalues.push({ re: realPart, im: imagPart });
        eigenvalues.push({ re: realPart, im: -imagPart });
      }
      i += 2;
    }
  }

  return eigenvalues;
}

/**
 * Inverse iteration to find eigenvector for a given eigenvalue
 */
function inverseIteration(
  A: number[][],
  eigenvalue: { re: number; im: number },
  tolerance: number,
  maxIterations: number
): number[] {
  const n = A.length;

  if (eigenvalue.im !== 0) {
    // For complex eigenvalues, return zero vector (would need complex arithmetic)
    return new Array(n).fill(0);
  }

  const lambda = eigenvalue.re;

  // Create (A - lambda*I)
  const shifted = cloneMatrix(A);
  for (let i = 0; i < n; i++) {
    shifted[i][i] -= lambda;
  }

  // Add small perturbation to avoid singularity
  for (let i = 0; i < n; i++) {
    shifted[i][i] += tolerance * 1e3;
  }

  // LU decomposition with partial pivoting
  const LU = cloneMatrix(shifted);
  const perm = Array.from({ length: n }, (_, i) => i);

  for (let k = 0; k < n; k++) {
    // Find pivot
    let maxVal = Math.abs(LU[k][k]);
    let maxIdx = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(LU[i][k]) > maxVal) {
        maxVal = Math.abs(LU[i][k]);
        maxIdx = i;
      }
    }

    // Swap rows
    if (maxIdx !== k) {
      [LU[k], LU[maxIdx]] = [LU[maxIdx], LU[k]];
      [perm[k], perm[maxIdx]] = [perm[maxIdx], perm[k]];
    }

    if (Math.abs(LU[k][k]) < tolerance) {
      LU[k][k] = tolerance;
    }

    // Eliminate
    for (let i = k + 1; i < n; i++) {
      LU[i][k] /= LU[k][k];
      for (let j = k + 1; j < n; j++) {
        LU[i][j] -= LU[i][k] * LU[k][j];
      }
    }
  }

  // Inverse iteration
  const v = new Array(n).fill(1);
  let prevNorm = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Solve LU*x = v
    const y = new Array(n).fill(0);

    // Apply permutation
    const b = new Array(n);
    for (let i = 0; i < n; i++) {
      b[i] = v[perm[i]];
    }

    // Forward substitution (L*y = b)
    for (let i = 0; i < n; i++) {
      y[i] = b[i];
      for (let j = 0; j < i; j++) {
        y[i] -= LU[i][j] * y[j];
      }
    }

    // Back substitution (U*x = y)
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = y[i];
      for (let j = i + 1; j < n; j++) {
        x[i] -= LU[i][j] * x[j];
      }
      x[i] /= LU[i][i];
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < n; i++) {
      norm += x[i] * x[i];
    }
    norm = Math.sqrt(norm);

    if (norm < tolerance) {
      return x;
    }

    for (let i = 0; i < n; i++) {
      v[i] = x[i] / norm;
    }

    // Check convergence
    if (Math.abs(norm - prevNorm) < tolerance * norm) {
      break;
    }
    prevNorm = norm;
  }

  return v;
}

/**
 * Compute eigenvalues and eigenvectors of a square matrix
 * Uses QR algorithm with implicit shifts
 *
 * @param matrix - Square matrix (n x n)
 * @param options - Computation options
 * @returns Eigenvalues and eigenvectors
 */
export function eig(matrix: number[][] | Float64Array, options: EigOptions = {}): EigResult {
  const {
    maxIterations = DEFAULT_MAX_ITERATIONS,
    tolerance = DEFAULT_TOLERANCE,
    computeVectors = true,
  } = options;

  // Convert to 2D array if needed
  let A: number[][];
  if (matrix instanceof Float64Array) {
    const n = Math.sqrt(matrix.length);
    if (n !== Math.floor(n)) {
      throw new Error('Float64Array length must be a perfect square');
    }
    A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => matrix[i * n + j]));
  } else {
    A = matrix;
  }

  const n = A.length;
  if (n === 0) {
    return { values: [], vectors: [], isSymmetric: true };
  }

  // Check dimensions
  for (let i = 0; i < n; i++) {
    if (A[i].length !== n) {
      throw new Error('Matrix must be square');
    }
  }

  const symmetric = isSymmetric(A);

  // Special cases
  if (n === 1) {
    return {
      values: [{ re: A[0][0], im: 0 }],
      vectors: [[1]],
      isSymmetric: symmetric,
    };
  }

  if (n === 2) {
    const a = A[0][0],
      b = A[0][1],
      c = A[1][0],
      d = A[1][1];
    const trace = a + d;
    const det = a * d - b * c;
    const disc = trace * trace - 4 * det;

    let values: Array<{ re: number; im: number }>;
    let vectors: number[][];

    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      const e1 = (trace + sqrtDisc) / 2;
      const e2 = (trace - sqrtDisc) / 2;
      values = [
        { re: e1, im: 0 },
        { re: e2, im: 0 },
      ];

      if (computeVectors) {
        // Compute eigenvectors for 2x2
        vectors = [];
        for (const e of [e1, e2]) {
          if (Math.abs(b) > tolerance) {
            const v = [b, e - a];
            const norm = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
            vectors.push([v[0] / norm, v[1] / norm]);
          } else if (Math.abs(c) > tolerance) {
            const v = [e - d, c];
            const norm = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
            vectors.push([v[0] / norm, v[1] / norm]);
          } else {
            vectors.push(e === a ? [1, 0] : [0, 1]);
          }
        }
      } else {
        vectors = eye(2);
      }
    } else {
      const realPart = trace / 2;
      const imagPart = Math.sqrt(-disc) / 2;
      values = [
        { re: realPart, im: imagPart },
        { re: realPart, im: -imagPart },
      ];
      vectors = eye(2); // Complex eigenvectors not computed
    }

    return { values, vectors, isSymmetric: symmetric };
  }

  // Reduce to Hessenberg form
  const { H, Q } = hessenberg(A);

  // QR iteration
  let end = n - 1;
  let iter = 0;

  while (end > 0 && iter < maxIterations) {
    // Find largest subdiagonal element that is negligible
    let start = end;
    while (start > 0) {
      const scale = Math.abs(H[start - 1][start - 1]) + Math.abs(H[start][start]);
      if (Math.abs(H[start][start - 1]) <= tolerance * scale) {
        H[start][start - 1] = 0;
        break;
      }
      start--;
    }

    if (start === end) {
      // Eigenvalue found
      end--;
    } else if (start === end - 1) {
      // 2x2 block - eigenvalues from this block
      end -= 2;
    } else {
      // Apply QR step
      if (iter % 30 === 29) {
        // Exceptional shift to break stagnation (shift value used implicitly in qrStep)
        qrStep(H, Q, start, end);
      } else if (symmetric) {
        qrStep(H, Q, start, end);
      } else {
        doubleShiftQR(H, Q, start, end);
      }
    }
    iter++;
  }

  // Extract eigenvalues
  const values = extractEigenvalues(H, tolerance);

  // Compute eigenvectors if requested
  let vectors: number[][];
  if (computeVectors) {
    vectors = [];
    for (const eigenvalue of values) {
      const v = inverseIteration(A, eigenvalue, tolerance, 100);
      vectors.push(v);
    }
  } else {
    vectors = eye(n);
  }

  return { values, vectors, isSymmetric: symmetric };
}

/**
 * Compute only eigenvalues (faster, no eigenvector computation)
 */
export function eigvals(
  matrix: number[][] | Float64Array,
  options?: Omit<EigOptions, 'computeVectors'>
): Array<{ re: number; im: number }> {
  return eig(matrix, { ...options, computeVectors: false }).values;
}

/**
 * Power iteration for dominant eigenvalue
 * Faster than full eigendecomposition when only largest eigenvalue needed
 */
export function powerIteration(
  matrix: number[][],
  options: { maxIterations?: number; tolerance?: number } = {}
): { value: number; vector: number[] } {
  const { maxIterations = 1000, tolerance = 1e-12 } = options;
  const n = matrix.length;

  // Random initial vector
  let v = Array.from({ length: n }, () => Math.random() - 0.5);

  // Normalize
  let norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  v = v.map((x) => x / norm);

  let eigenvalue = 0;
  let prevEigenvalue = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Matrix-vector multiply
    const w = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        w[i] += matrix[i][j] * v[j];
      }
    }

    // Rayleigh quotient
    eigenvalue = v.reduce((sum, vi, i) => sum + vi * w[i], 0);

    // Normalize
    norm = Math.sqrt(w.reduce((sum, x) => sum + x * x, 0));
    v = w.map((x) => x / norm);

    // Check convergence
    if (Math.abs(eigenvalue - prevEigenvalue) < tolerance * Math.abs(eigenvalue)) {
      break;
    }
    prevEigenvalue = eigenvalue;
  }

  return { value: eigenvalue, vector: v };
}
