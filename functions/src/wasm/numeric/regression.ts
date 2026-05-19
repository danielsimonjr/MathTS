// functions/src/wasm/numeric/regression.ts

/**
 * Fit a polynomial of the given degree to a set of data points using
 * least-squares regression (normal equations with a Vandermonde matrix).
 *
 * Returns coefficients [c0, c1, c2, ...] such that:
 *   p(x) = c0 + c1*x + c2*x^2 + ... + cdegree*x^degree
 *
 * @param xPtr    Pointer to f64 array of x-coordinates
 * @param yPtr    Pointer to f64 array of y-coordinates
 * @param n       Number of data points
 * @param degree  Degree of the polynomial to fit
 * @param outPtr  Pointer to f64 output array of length (degree+1)
 * @return        0 on success, -1 if x/y length mismatch (n < 1), -2 if not enough points, -3 if singular
 */
export function polyfit(
  xPtr: usize,
  yPtr: usize,
  n: i32,
  degree: i32,
  outPtr: usize
): i32 {
  const m: i32 = degree + 1;

  if (n < m) {
    return -2;
  }

  // Allocate Vandermonde matrix V (n x m) as flat f64 array
  const vSize: usize = <usize>(n * m) << 3;
  const V: usize = heap.alloc(vSize);

  // Build Vandermonde matrix: V[i*m + j] = x[i]^j
  for (let i: i32 = 0; i < n; i++) {
    const xi: f64 = load<f64>(xPtr + (<usize>i << 3));
    let xpow: f64 = 1.0;
    for (let j: i32 = 0; j < m; j++) {
      store<f64>(V + (<usize>(i * m + j) << 3), xpow);
      xpow *= xi;
    }
  }

  // Allocate A = V^T * V (m x m) as flat f64 array
  const aSize: usize = <usize>(m * m) << 3;
  const A: usize = heap.alloc(aSize);

  for (let r: i32 = 0; r < m; r++) {
    for (let c: i32 = 0; c < m; c++) {
      let sum: f64 = 0.0;
      for (let i: i32 = 0; i < n; i++) {
        const vir: f64 = load<f64>(V + (<usize>(i * m + r) << 3));
        const vic: f64 = load<f64>(V + (<usize>(i * m + c) << 3));
        sum += vir * vic;
      }
      store<f64>(A + (<usize>(r * m + c) << 3), sum);
    }
  }

  // Allocate b = V^T * y (m x 1)
  const bSize: usize = <usize>m << 3;
  const b: usize = heap.alloc(bSize);

  for (let r: i32 = 0; r < m; r++) {
    let sum: f64 = 0.0;
    for (let i: i32 = 0; i < n; i++) {
      const vir: f64 = load<f64>(V + (<usize>(i * m + r) << 3));
      const yi: f64 = load<f64>(yPtr + (<usize>i << 3));
      sum += vir * yi;
    }
    store<f64>(b + (<usize>r << 3), sum);
  }

  heap.free(V);

  // Build augmented matrix M (m x (m+1)): [A | b]
  // M[r*(m+1) + c] for c in [0..m-1] = A[r*m+c], M[r*(m+1)+m] = b[r]
  const mp1: i32 = m + 1;
  const mSize: usize = <usize>(m * mp1) << 3;
  const M: usize = heap.alloc(mSize);

  for (let r: i32 = 0; r < m; r++) {
    for (let c: i32 = 0; c < m; c++) {
      const val: f64 = load<f64>(A + (<usize>(r * m + c) << 3));
      store<f64>(M + (<usize>(r * mp1 + c) << 3), val);
    }
    const bval: f64 = load<f64>(b + (<usize>r << 3));
    store<f64>(M + (<usize>(r * mp1 + m) << 3), bval);
  }

  heap.free(A);
  heap.free(b);

  // Gaussian elimination with partial pivoting
  for (let col: i32 = 0; col < m; col++) {
    // Find pivot row
    let maxRow: i32 = col;
    let maxVal: f64 = abs<f64>(load<f64>(M + (<usize>(col * mp1 + col) << 3)));
    for (let row: i32 = col + 1; row < m; row++) {
      const val: f64 = abs<f64>(load<f64>(M + (<usize>(row * mp1 + col) << 3)));
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    // Swap rows col and maxRow
    if (maxRow != col) {
      for (let k: i32 = 0; k <= m; k++) {
        const tmp: f64 = load<f64>(M + (<usize>(col * mp1 + k) << 3));
        const src: f64 = load<f64>(M + (<usize>(maxRow * mp1 + k) << 3));
        store<f64>(M + (<usize>(col * mp1 + k) << 3), src);
        store<f64>(M + (<usize>(maxRow * mp1 + k) << 3), tmp);
      }
    }

    const pivot: f64 = load<f64>(M + (<usize>(col * mp1 + col) << 3));
    if (abs<f64>(pivot) < 1e-14) {
      heap.free(M);
      return -3;
    }

    // Eliminate below
    for (let row: i32 = col + 1; row < m; row++) {
      const factor: f64 = load<f64>(M + (<usize>(row * mp1 + col) << 3)) / pivot;
      for (let k: i32 = col; k <= m; k++) {
        const mrowk: f64 = load<f64>(M + (<usize>(row * mp1 + k) << 3));
        const mcolk: f64 = load<f64>(M + (<usize>(col * mp1 + k) << 3));
        store<f64>(M + (<usize>(row * mp1 + k) << 3), mrowk - factor * mcolk);
      }
    }
  }

  // Back substitution
  for (let i: i32 = m - 1; i >= 0; i--) {
    let xi: f64 = load<f64>(M + (<usize>(i * mp1 + m) << 3));
    for (let j: i32 = i + 1; j < m; j++) {
      const mij: f64 = load<f64>(M + (<usize>(i * mp1 + j) << 3));
      const xj: f64 = load<f64>(outPtr + (<usize>j << 3));
      xi -= mij * xj;
    }
    const mii: f64 = load<f64>(M + (<usize>(i * mp1 + i) << 3));
    store<f64>(outPtr + (<usize>i << 3), xi / mii);
  }

  heap.free(M);
  return 0;
}