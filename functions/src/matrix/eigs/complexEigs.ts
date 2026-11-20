import { clone } from '../../utils/object.js';
import { realScale } from '../../utils/real-scale.js';
import type BigNumber from 'bignumber.js';
import type { Complex } from 'complex.js';

/** Scalar types supported by complex eigenvalue computation */
type Scalar = number | BigNumber | Complex;

// Type definitions
/** Result for a single eigenvector with its corresponding eigenvalue */
interface EigenvectorResult {
  value: Scalar;
  vector: Scalar[];
}

/** Result of complex eigenvalue computation */
interface ComplexEigsResult {
  values: Scalar[];
  eigenvectors?: EigenvectorResult[];
}

/** Result of triangularization with optional column transformation matrix */
interface TriangularResult {
  values: Scalar[];
  C: Scalar[][] | undefined;
}

/** Result of QR decomposition */
interface QRResult {
  Q: Scalar[][];
  R: Scalar[][];
}

/** Dependencies for createComplexEigs */
interface Dependencies {
  addScalar: (a: Scalar, b: Scalar) => Scalar;
  subtract: (a: Scalar | Scalar[], b: Scalar | Scalar[]) => Scalar | Scalar[];
  flatten: <T>(arr: T[][] | T[]) => T[];
  multiply: (a: Scalar | Scalar[][], b: Scalar | Scalar[][]) => Scalar | Scalar[][];
  multiplyScalar: (a: Scalar, b: Scalar) => Scalar;
  divideScalar: (a: Scalar, b: Scalar) => Scalar;
  sqrt: (x: Scalar) => Scalar;
  abs: (x: Scalar) => number | BigNumber;
  bignumber: (x: number | string) => BigNumber;
  diag: (arr: Scalar[]) => Scalar[][];
  size: (arr: Scalar[]) => number[];
  reshape: (arr: Scalar[], shape: number[]) => Scalar[];
  inv: (x: Scalar[][]) => Scalar[][];
  qr: (x: Scalar[][]) => QRResult;
  usolve: (A: Scalar[][], b: Scalar[]) => Scalar[];
  complex: (re: number | Scalar, im?: number) => Complex;
  matrixFromColumns: (...cols: Scalar[][]) => Scalar[][];
  dot: (a: Scalar[], b: Scalar[]) => Scalar;
}

/** Supported data types for eigenvalue computation */
type DataType = 'number' | 'BigNumber' | 'Complex';

/**
 * A coupling of an upper triangular row is rounding noise when it is below this fraction of `prec`,
 * relative to the row (`nullSpaceUpper`). Measured: the rounding of a dense matrix with a double
 * eigenvalue is 5e-15 of the row for entries of type Complex (up to 2e-13 for a badly conditioned
 * one), and a coupling of 1e-13 is a coupling (a test of #1202). One hundredth of the default
 * precision 1e-12 lies between these. A larger noise drops an eigenvector, which inverse iteration
 * may find again; it never gives a false one, because the residual of a read zero is below the
 * tolerance.
 */
const COUPLING_FRACTION_OF_PREC = 0.01;

/**
 * Create the `complexEigs` function, which computes the eigenvalues and the optional
 * eigenvectors of a matrix that is not real symmetric.
 */
export function createComplexEigs({
  addScalar,
  subtract,
  flatten,
  multiply,
  multiplyScalar,
  divideScalar,
  sqrt,
  abs,
  bignumber,
  diag,
  size,
  reshape,
  inv,
  qr,
  usolve,
  complex,
  matrixFromColumns: _matrixFromColumns,
  dot,
}: Dependencies) {
  /** Real magnitudes (from abs) are numbers or BigNumbers; compare them exactly. */
  function toBig(x: Scalar): BigNumber {
    return (typeof x === 'number' ? bignumber(x) : x) as BigNumber;
  }
  function lt(a: Scalar, b: Scalar): boolean {
    return typeof a === 'number' && typeof b === 'number' ? a < b : toBig(a).lt(toBig(b));
  }
  function le(a: Scalar, b: Scalar): boolean {
    return typeof a === 'number' && typeof b === 'number' ? a <= b : toBig(a).lte(toBig(b));
  }
  function gt(a: Scalar, b: Scalar): boolean {
    return lt(b, a);
  }
  function isExactZero(x: Scalar): boolean {
    return typeof x === 'number' ? x === 0 : toBig(x).isZero();
  }

  /** |a - b| <= prec * max(|a|, |b|); two zeros are close */
  function close(a: Scalar, b: Scalar, prec: Scalar): boolean {
    const aa = abs(a) as Scalar;
    const ab = abs(b) as Scalar;
    return le(abs(subtract(a, b) as Scalar), multiplyScalar(prec, lt(aa, ab) ? ab : aa));
  }

  /**
   * Is the subdiagonal entry H[k][k-1] of the active n x n window negligible?
   * The LAPACK dlahqr test: compare it with prec times the two diagonal
   * entries beside it, or, when both are zero, the neighbouring subdiagonal
   * entries. A tolerance relative to the whole matrix would erase the coupling
   * of a small block beside a huge entry (#1202).
   */
  function negligible(H: Scalar[][], n: number, k: number, prec: Scalar): boolean {
    const h = abs(H[k][k - 1]) as Scalar;
    if (isExactZero(h)) return true;
    let tst = addScalar(abs(H[k - 1][k - 1]) as Scalar, abs(H[k][k]) as Scalar);
    if (isExactZero(tst)) {
      if (k >= 2) tst = addScalar(tst, abs(H[k - 1][k - 2]) as Scalar);
      if (k + 1 < n) tst = addScalar(tst, abs(H[k + 1][k]) as Scalar);
    }
    return le(h, multiplyScalar(prec, tst));
  }

  /**
   * The matrix scale: its largest entry magnitude. Every tolerance below is
   * `prec` times this scale, so the result does not depend on the units of the
   * matrix. A zero or non-finite scale falls back to 1.
   */
  function matrixScale(arr: Scalar[][], N: number, type: DataType): Scalar {
    const big = type === 'BigNumber';
    let scale: Scalar = big ? bignumber(0) : 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = abs(arr[i][j]) as Scalar;
        if (lt(scale, a)) scale = a;
      }
    }
    const finite = typeof scale === 'number' ? Number.isFinite(scale) : toBig(scale).isFinite();
    return finite && !isExactZero(scale) ? scale : big ? bignumber(1) : 1;
  }

  /**
   * Compute eigenvalues and optionally eigenvectors of a general matrix
   * @param arr the matrix to find eigenvalues of
   * @param N size of the matrix
   * @param prec precision, anything lower will be considered zero
   * @param type data type of matrix elements
   * @param findVectors should we find eigenvectors?
   * @returns eigenvalues and optionally eigenvectors
   */
  function complexEigs(
    arr: Scalar[][],
    N: number,
    prec: number | BigNumber,
    type: DataType,
    findVectors: boolean = true
  ): ComplexEigsResult {
    // TODO check if any row/col are zero except the diagonal

    // Every test below is relative to the entries it compares (#1202), so the
    // result does not depend on the units of the matrix, and a small block
    // beside a huge entry keeps its own eigenvalues.
    const rel: Scalar = type === 'BigNumber' ? bignumber(prec as number) : (prec as number);
    const scale = matrixScale(arr, N, type);

    // make sure corresponding rows and columns have similar magnitude
    // important because of numerical stability
    // MODIFIES arr by side effect!
    const R = balance(arr, N, prec, type, findVectors);

    // R is the row transformation matrix
    // arr = A' = R A R^-1, A is the original matrix
    // (if findVectors is false, R is undefined)
    // (And so to return to original matrix: A = R^-1 arr R)

    // TODO if magnitudes of elements vary over many orders,
    // move greatest elements to the top left corner

    // using similarity transformations, reduce the matrix
    // to Hessenberg form (upper triangular plus one subdiagonal row)
    // updates the transformation matrix R with new row operations
    // MODIFIES arr by side effect!
    reduceToHessenberg(arr, N, type, findVectors, R);
    // still true that original A = R^-1 arr R)

    // find eigenvalues
    const { values, C } = iterateUntilTriangular(arr, N, rel, type, findVectors);

    // values is the list of eigenvalues, C is the column
    // transformation matrix that transforms arr, the hessenberg
    // matrix, to upper triangular
    // (So U = C^-1 arr C and the relationship between current arr
    // and original A is unchanged.)

    if (findVectors) {
      const eigenvectors = findEigenvectors(arr, N, C!, R, values, rel, scale, type);
      return { values, eigenvectors };
    }

    return { values };
  }

  /**
   * Balance a matrix to improve numerical stability
   * @param arr the matrix to balance
   * @param N size of the matrix
   * @param _prec precision threshold (not used)
   * @param type data type
   * @param findVectors whether to compute transformation matrix
   * @returns diagonal transformation matrix or null
   */
  function balance(
    arr: Scalar[][],
    N: number,
    _prec: number | BigNumber,
    type: DataType,
    findVectors: boolean
  ): Scalar[][] | null {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';

    const realzero: Scalar = big ? bignumber(0) : 0;
    const one: Scalar = big ? bignumber(1) : cplx ? complex(1) : 1;
    const realone: Scalar = big ? bignumber(1) : 1;

    // base of the floating-point arithmetic
    const radix: Scalar = big ? bignumber(10) : 2;
    const radixSq = multiplyScalar(radix, radix);

    // the diagonal transformation matrix R
    let Rdiag: Scalar[] | undefined;
    if (findVectors) {
      Rdiag = Array(N).fill(one);
    }

    // this isn't the only time we loop thru the matrix...
    let last = false;

    while (!last) {
      // ...haha I'm joking! unless...
      last = true;

      for (let i = 0; i < N; i++) {
        // compute the taxicab norm of i-th column and row
        // TODO optimize for complex numbers
        let colNorm: Scalar = realzero;
        let rowNorm: Scalar = realzero;

        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          colNorm = addScalar(colNorm, abs(arr[j][i]) as Scalar);
          rowNorm = addScalar(rowNorm, abs(arr[i][j]) as Scalar);
        }

        if (!isExactZero(colNorm) && !isExactZero(rowNorm)) {
          // find integer power closest to balancing the matrix
          // (we want to scale only by integer powers of radix,
          // so that we don't lose any precision due to round-off)

          let f: Scalar = realone;
          let c: Scalar = colNorm;

          const rowDivRadix = divideScalar(rowNorm, radix);
          const rowMulRadix = multiplyScalar(rowNorm, radix);

          while (lt(c, rowDivRadix)) {
            c = multiplyScalar(c, radixSq);
            f = multiplyScalar(f, radix);
          }
          while (gt(c, rowMulRadix)) {
            c = divideScalar(c, radixSq);
            f = divideScalar(f, radix);
          }

          // check whether balancing is needed
          // condition = (c + rowNorm) / f < 0.95 * (colNorm + rowNorm)
          const condition = lt(
            divideScalar(addScalar(c, rowNorm), f),
            multiplyScalar(addScalar(colNorm, rowNorm), 0.95)
          );

          // apply balancing similarity transformation
          if (condition) {
            // we should loop once again to check whether
            // another rebalancing is needed
            last = false;

            const g = divideScalar(1, f);

            for (let j = 0; j < N; j++) {
              if (i === j) {
                continue;
              }
              arr[i][j] = multiplyScalar(arr[i][j], g);
              arr[j][i] = multiplyScalar(arr[j][i], f);
            }

            // keep track of transformations
            if (findVectors) {
              Rdiag![i] = multiplyScalar(Rdiag![i], g);
            }
          }
        }
      }
    }

    // return the diagonal row transformation matrix.
    // Rdiag is initialised whenever findVectors is true (same invariant the
    // Rdiag![i] writes above rely on).
    return findVectors ? diag(Rdiag!) : null;
  }

  /**
   * Reduce matrix to Hessenberg form using similarity transformations
   * @param arr the matrix to reduce (modified in place)
   * @param N size of the matrix
   * @param type data type
   * @param findVectors whether to track transformations
   * @param R the row transformation matrix that will be modified
   */
  function reduceToHessenberg(
    arr: Scalar[][],
    N: number,
    type: DataType,
    findVectors: boolean,
    R: Scalar[][] | null
  ): void {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';

    const zero: Scalar = big ? bignumber(0) : cplx ? complex(0) : 0;

    for (let i = 0; i < N - 2; i++) {
      // Find the largest subdiag element in the i-th col

      let maxIndex = 0;
      let max: Scalar = zero;

      for (let j = i + 1; j < N; j++) {
        const el = arr[j][i];
        if (lt(abs(max), abs(el))) {
          max = el;
          maxIndex = j;
        }
      }

      // This col is pivoted, no need to do anything. Only an exact zero skips:
      // the pivot is the largest entry, so the multipliers stay at most 1, and
      // a small nonzero entry beside a huge one is not dropped (#1202)
      if (isExactZero(abs(max) as Scalar)) {
        continue;
      }

      if (maxIndex !== i + 1) {
        // Interchange maxIndex-th and (i+1)-th row
        const tmp1 = arr[maxIndex];
        arr[maxIndex] = arr[i + 1];
        arr[i + 1] = tmp1;

        // Interchange maxIndex-th and (i+1)-th column
        for (let j = 0; j < N; j++) {
          const tmp2 = arr[j][maxIndex];
          arr[j][maxIndex] = arr[j][i + 1];
          arr[j][i + 1] = tmp2;
        }

        // keep track of transformations
        if (findVectors) {
          const tmp3 = R![maxIndex];
          R![maxIndex] = R![i + 1];
          R![i + 1] = tmp3;
        }
      }

      // Reduce following rows and columns
      for (let j = i + 2; j < N; j++) {
        const n = divideScalar(arr[j][i], max);

        if (n === 0) {
          continue;
        }

        // from j-th row subtract n-times (i+1)th row
        for (let k = 0; k < N; k++) {
          arr[j][k] = subtract(arr[j][k], multiplyScalar(n, arr[i + 1][k])) as Scalar;
        }

        // to (i+1)th column add n-times j-th column
        for (let k = 0; k < N; k++) {
          arr[k][i + 1] = addScalar(arr[k][i + 1], multiplyScalar(n, arr[k][j]));
        }

        // keep track of transformations
        if (findVectors) {
          for (let k = 0; k < N; k++) {
            R![j][k] = subtract(R![j][k], multiplyScalar(n, R![i + 1][k])) as Scalar;
          }
        }
      }
    }
  }

  /**
   * The Wilkinson shift: the eigenvalue of the trailing 2x2 block of the active window that is
   * nearer to its corner entry.
   */
  function wilkinsonShift(arr: Scalar[][], n: number): Scalar {
    const d = arr[n - 1][n - 1];
    const [l1, l2] = eigenvalues2x2(arr[n - 2][n - 2], arr[n - 2][n - 1], arr[n - 1][n - 2], d);
    return lt(abs(subtract(l1, d) as Scalar) as Scalar, abs(subtract(l2, d) as Scalar) as Scalar)
      ? l1
      : l2;
  }

  /**
   * One real double-shift QR step (Francis) on the n x n window `arr` of real entries, for a
   * trailing 2x2 block with a complex conjugate pair. The two shifts are the eigenvalues of that
   * block, so the step uses the real matrix M = arr^2 - s arr + t I, with s the trace and t the
   * determinant of the block. The step is A' = Q^T A Q with Q from the QR decomposition of M. It
   * returns `null` when the block has two real eigenvalues, and the caller takes the corner shift.
   *
   * The entries below the first subdiagonal of A' are zero in exact arithmetic; the rounding
   * left there is set to an exact zero, so A' stays an upper Hessenberg matrix.
   *
   * A square of an entry of type number can leave the double range. M is therefore formed from
   * `arr / c`, with `c` a power of 2: the scale is exact, and the QR decomposition of M / c^2
   * gives the same Q. A BigNumber has the range, and `doScaledComplexEigs` scales its entries.
   */
  function doubleShiftStep(
    arr: Scalar[][],
    n: number,
    big: boolean
  ): { arr: Scalar[][]; Q: Scalar[][] } | null {
    let down = (x: Scalar): Scalar => x;
    if (!big) {
      const scale = realScale(arr.flat());
      if (scale === undefined) return null;
      down = (x) => scale.down(x as number) as Scalar;
    }
    const zero: Scalar = big ? bignumber(0) : 0;

    const a = down(arr[n - 2][n - 2]);
    const b = down(arr[n - 2][n - 1]);
    const c = down(arr[n - 1][n - 2]);
    const d = down(arr[n - 1][n - 1]);
    const half = multiplyScalar(subtract(a, d) as Scalar, 0.5);
    const disc = addScalar(multiplyScalar(half, half), multiplyScalar(b, c));
    if (!lt(disc, zero)) return null;

    const s = addScalar(a, d);
    const t = subtract(multiplyScalar(a, d), multiplyScalar(b, c)) as Scalar;
    const scaled = arr.map((row) => row.map(down));
    const squared = multiply(scaled, scaled) as Scalar[][];
    const M = squared.map((row, i) =>
      row.map((x, j) => {
        const v = subtract(x, multiplyScalar(s, scaled[i][j])) as Scalar;
        return i === j ? addScalar(v, t) : v;
      })
    );

    const { Q }: QRResult = qr(M);
    const QT = Q.map((_, j) => Q.map((row) => row[j]));
    const next = multiply(QT, multiply(arr, Q) as Scalar[][]) as Scalar[][];
    for (let i = 2; i < n; i++) {
      for (let j = 0; j < i - 1; j++) next[i][j] = zero;
    }
    return { arr: next, Q };
  }

  /**
   * Iterate QR algorithm until matrix is block-upper-triangular
   * @see Press, Williams: Numerical recipes in Fortran 77
   * @see https://en.wikipedia.org/wiki/QR_algorithm
   */
  function iterateUntilTriangular(
    A: Scalar[][],
    N: number,
    prec: Scalar,
    type: DataType,
    findVectors: boolean
  ): TriangularResult {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';

    const one: Scalar = big ? bignumber(1) : cplx ? complex(1) : 1;

    // The Francis Algorithm
    // The core idea of this algorithm is that doing successive
    // A' = QtAQ transformations will eventually converge to block-
    // upper-triangular with diagonal blocks either 1x1 or 2x2.
    // The Q here is the one from the QR decomposition, A = QR.
    // Since the eigenvalues of a block-upper-triangular matrix are
    // the eigenvalues of its diagonal blocks and we know how to find
    // eigenvalues of a 2x2 matrix, we know the eigenvalues of A.

    let arr = clone(A) as Scalar[][];

    // the list of converged eigenvalues
    const lambdas: Scalar[] = [];

    // size of arr, which will get smaller as eigenvalues converge
    let n = N;

    // the diagonal of the block-diagonal matrix that turns
    // converged 2x2 matrices into upper triangular matrices
    const Sdiag: Scalar[][][] = [];

    // N*N matrix describing the overall transformation done during the QR algorithm
    let Qtotal: Scalar[][] | undefined = findVectors ? diag(Array(N).fill(one)) : undefined;

    // nxn matrix describing the QR transformations done since last convergence
    let Qpartial: Scalar[][] | undefined = findVectors ? diag(Array(n).fill(one)) : undefined;

    // last eigenvalue converged before this many steps
    let lastConvergenceBefore = 0;

    while (lastConvergenceBefore <= 100) {
      lastConvergenceBefore += 1;

      // TODO if the convergence is slow, do something clever

      // Perform the factorization

      // A real shift cannot separate a complex conjugate pair, so the corner shift alone does not
      // deflate a matrix with one in 100 steps (#1238). A real matrix whose trailing 2x2 block has
      // a complex pair takes a real double-shift step instead (Francis). A Complex matrix takes
      // the eigenvalue of the trailing block nearer to the corner (Wilkinson). A step that the
      // exceptional shift below owns keeps it, so a cyclic matrix still moves (#1202).
      const exceptional = n >= 3 && lastConvergenceBefore % 10 === 0;

      const doubleStep = !cplx && n >= 3 && !exceptional ? doubleShiftStep(arr, n, big) : null;
      if (doubleStep !== null) {
        arr = doubleStep.arr;
        if (findVectors) {
          Qpartial = multiply(Qpartial!, doubleStep.Q) as Scalar[][];
        }
      } else {
        let k = arr[n - 1][n - 1];

        if (exceptional) {
          // The corner is zero for a cyclic permutation matrix, which then
          // never moves (QR of a unitary matrix returns the matrix). Every tenth
          // step without convergence use an exceptional shift (EISPACK hqr, NR):
          // the corner plus 3/4 of the sum of the two trailing subdiagonal entries.
          const w = addScalar(abs(arr[n - 1][n - 2]) as Scalar, abs(arr[n - 2][n - 3]) as Scalar);
          k = addScalar(k, multiplyScalar(w, 0.75));
        } else if (cplx && n >= 3) {
          k = wilkinsonShift(arr, n);
        }

        for (let i = 0; i < n; i++) {
          arr[i][i] = subtract(arr[i][i], k) as Scalar;
        }

        // TODO do an implicit QR transformation
        const { Q, R }: QRResult = qr(arr);
        arr = multiply(R, Q) as Scalar[][];

        for (let i = 0; i < n; i++) {
          arr[i][i] = addScalar(arr[i][i], k);
        }

        // keep track of transformations
        if (findVectors) {
          Qpartial = multiply(Qpartial!, Q) as Scalar[][];
        }
      }

      // The rightmost diagonal element converged to an eigenvalue
      if (n === 1 || negligible(arr, n, n - 1, prec)) {
        lastConvergenceBefore = 0;
        lambdas.push(arr[n - 1][n - 1]);

        // keep track of transformations
        if (findVectors) {
          Sdiag.unshift([[1]]);
          inflateMatrix(Qpartial!, N);
          Qtotal = multiply(Qtotal!, Qpartial!) as Scalar[][];

          if (n > 1) {
            Qpartial = diag(Array(n - 1).fill(one));
          }
        }

        // reduce the matrix size
        n -= 1;
        arr.pop();
        for (let i = 0; i < n; i++) {
          arr[i].pop();
        }

        // The rightmost diagonal 2x2 block converged
      } else if (n === 2 || negligible(arr, n, n - 2, prec)) {
        lastConvergenceBefore = 0;
        const ll = eigenvalues2x2(
          arr[n - 2][n - 2],
          arr[n - 2][n - 1],
          arr[n - 1][n - 2],
          arr[n - 1][n - 1]
        );
        lambdas.push(...ll);

        // keep track of transformations
        if (findVectors) {
          Sdiag.unshift(
            jordanBase2x2(
              arr[n - 2][n - 2],
              arr[n - 2][n - 1],
              arr[n - 1][n - 2],
              arr[n - 1][n - 1],
              ll[0],
              ll[1],
              prec,
              type
            )
          );
          inflateMatrix(Qpartial!, N);
          Qtotal = multiply(Qtotal!, Qpartial!) as Scalar[][];
          if (n > 2) {
            Qpartial = diag(Array(n - 2).fill(one));
          }
        }

        // reduce the matrix size
        n -= 2;
        arr.pop();
        arr.pop();
        for (let i = 0; i < n; i++) {
          arr[i].pop();
          arr[i].pop();
        }
      }

      if (n === 0) {
        break;
      }
    }

    // standard sorting
    lambdas.sort((a, b) => +(subtract(abs(a), abs(b)) as number));

    // the algorithm didn't converge
    if (lastConvergenceBefore > 100) {
      const err = new Error(
        'The eigenvalues failed to converge. Only found these eigenvalues: ' + lambdas.join(', ')
      ) as Error & { values: Scalar[]; vectors: Scalar[][] };
      err.values = lambdas;
      err.vectors = [];
      throw err;
    }

    // combine the overall QR transformation Qtotal with the subsequent
    // transformation S that turns the diagonal 2x2 blocks to upper triangular
    const C = findVectors ? (multiply(Qtotal!, blockDiag(Sdiag, N)) as Scalar[][]) : undefined;

    return { values: lambdas, C };
  }

  /**
   * Find eigenvectors given the upper triangular form
   * @param A hessenberg-form matrix
   * @param N size of A
   * @param C column transformation matrix that turns A into upper triangular
   * @param R similarity that turns original matrix into A
   * @param values array of eigenvalues of A
   * @param prec precision threshold
   * @param type data type
   * @returns eigenvectors
   */
  function findEigenvectors(
    A: Scalar[][],
    N: number,
    C: Scalar[][],
    R: Scalar[][] | null,
    values: Scalar[],
    prec: Scalar,
    scale: Scalar,
    type: DataType
  ): EigenvectorResult[] {
    const Cinv = inv(C);
    const U = multiply(multiply(Cinv, A) as Scalar[][], C) as Scalar[][];

    const big = type === 'BigNumber';
    const cplx = type === 'Complex';

    const zero: Scalar = big ? bignumber(0) : cplx ? complex(0) : 0;
    const one: Scalar = big ? bignumber(1) : cplx ? complex(1) : 1;

    // turn values into a kind of "multiset"
    // this way it is easier to find eigenvectors
    const uniqueValues: Scalar[] = [];
    const multiplicities: number[] = [];

    for (const lambda of values) {
      const i = indexOf(uniqueValues, lambda, (a, b) => close(a, b, prec));

      if (i === -1) {
        uniqueValues.push(lambda);
        multiplicities.push(1);
      } else {
        multiplicities[i] += 1;
      }
    }

    // find eigenvectors by solving U - lambdaE = 0
    // TODO replace with an iterative eigenvector algorithm
    // (this one might fail for imprecise eigenvalues)

    const vectors: EigenvectorResult[] = [];
    const len = uniqueValues.length;
    const E = diag(Array(N).fill(one));

    for (let i = 0; i < len; i++) {
      const lambda = uniqueValues[i];
      // the characteristic matrix
      const T = subtract(
        U as unknown as Scalar[],
        multiply(lambda, E) as unknown as Scalar[]
      ) as unknown as Scalar[][];

      // The null space does not change when a row is divided by a number, so
      // give it a diagonal of exact zeros (where U_jj matches lambda, relative
      // to their size) and ones (every other row divided by its diagonal).
      // Then the diagonal test does not depend on the scale of the matrix
      // (#1202). The other entries of a matching row keep that scale, and
      // `nullSpaceUpper` reads them relative to the row (#1242).
      const Snull = T.map((row, j) =>
        close(U[j][j], lambda, prec)
          ? row.map((x, k) => (k === j ? zero : x))
          : row.map((x) => divideScalar(x, row[j]))
      );

      // inverse iteration compares with prec, so it works on the scale-1 matrix
      const S = T.map((row) => row.map((x) => divideScalar(x, scale)));

      let solutions = nullSpaceUpper(Snull, U, prec, zero, one);

      // looks like we missed something, try inverse iteration
      // But if that fails, just presume that the original matrix truly
      // was defective.
      while (solutions.length < multiplicities[i]) {
        const approxVec = inverseIterate(S, N, solutions, prec, type);
        if (approxVec === null) {
          break;
        } // no more vectors were found
        solutions.push(approxVec);
      }

      // Transform back into original array coordinates. The product needs a column.
      const correction = multiply(inv(R!), C) as Scalar[][];
      solutions = solutions.map((v) =>
        flatten(
          multiply(
            correction,
            v.map((x) => [x])
          ) as Scalar[][]
        )
      );

      vectors.push(...solutions.map((v) => ({ value: lambda, vector: v })));
    }

    return vectors;
  }

  /**
   * A basis of the null space of an upper triangular matrix `T`, by backward substitution with
   * a zero right-hand side: one vector for each zero diagonal entry whose row is consistent. A
   * diagonal entry is zero only when it is an exact zero (`findEigenvectors` gives the rows that
   * match lambda an exact zero and every other row a one).
   *
   * The row of a zero diagonal entry is consistent for a solution x when the residual of the row,
   * `|x_i|` after the substitution, is rounding noise: it is at most `COUPLING_FRACTION_OF_PREC *
   * prec` times the largest entry of that row of `U` times the largest component of x solved so
   * far. The test is relative, so a coupling of 1e-18 in a matrix of that scale is a coupling
   * (#1242), and the rounding of a dense row (about 1e-15 of the row) is not. A consistent row
   * sets x_i to an exact zero, so the rounding does not enter the vector. An inconsistent row
   * drops the vector.
   * @returns the vectors as plain arrays; the null vector is not among them
   */
  function nullSpaceUpper(
    T: Scalar[][],
    U: Scalar[][],
    prec: Scalar,
    zero: Scalar,
    one: Scalar
  ): Scalar[][] {
    const N = T.length;
    const tolerance = multiplyScalar(prec, COUPLING_FRACTION_OF_PREC);
    const rowTop = U.map((row) => {
      let top = abs(row[0]) as Scalar;
      for (const x of row) {
        const ax = abs(x) as Scalar;
        if (lt(top, ax)) top = ax;
      }
      return top;
    });

    // B[0] is the null vector; each later vector adds a free variable
    const B: Scalar[][] = [Array(N).fill(zero)];

    for (let i = N - 1; i >= 0; i--) {
      let L = B.length;

      for (let k = 0; k < L; k++) {
        const b = B[k];

        if (!isExactZero(abs(T[i][i]) as Scalar)) {
          b[i] = divideScalar(b[i], T[i][i]);
          for (let j = i - 1; j >= 0; j--) {
            b[j] = subtract(b[j], multiplyScalar(b[i], T[j][i])) as Scalar;
          }
          continue;
        }

        // zero diagonal entry: the row needs a residual of rounding size
        let solved = abs(zero) as Scalar;
        for (let m = i + 1; m < N; m++) {
          const am = abs(b[m]) as Scalar;
          if (lt(solved, am)) solved = am;
        }
        const limit = multiplyScalar(tolerance, multiplyScalar(rowTop[i], solved));
        if (!le(abs(b[i]) as Scalar, limit)) {
          // this vector has no solution, but other vectors may have one
          B.splice(k, 1);
          k -= 1;
          L -= 1;
          continue;
        }
        b[i] = zero;

        if (k === 0) {
          // a free variable: a new vector with x_i = 1
          const bNew = [...b];
          bNew[i] = one;
          for (let j = i - 1; j >= 0; j--) {
            bNew[j] = subtract(bNew[j], T[j][i]) as Scalar;
          }
          B.push(bNew);
        }
      }
    }

    return B.slice(1);
  }

  /**
   * Compute the eigenvalues of a 2x2 matrix
   */
  function eigenvalues2x2(a: Scalar, b: Scalar, c: Scalar, d: Scalar): [Scalar, Scalar] {
    // The squares below leave the double range for entries of type number or Complex above about
    // 1e154 or below about 1e-154, and the eigenvalues are then NaN or 0. The eigenvalues of
    // a block scaled by an exact power of 2 are the eigenvalues of the block, scaled the same way.
    const mags = [a, b, c, d].map((x) => abs(x));
    if (mags.every((m) => typeof m === 'number')) {
      const top = Math.max(...(mags as number[]));
      if (top > 0 && Number.isFinite(top) && (top > 2 ** 500 || top < 2 ** -500)) {
        const factor = 2 ** Math.floor(Math.log2(top));
        const [l1, l2] = eigenvalues2x2(
          divideScalar(a, factor),
          divideScalar(b, factor),
          divideScalar(c, factor),
          divideScalar(d, factor)
        );
        return [multiplyScalar(l1, factor), multiplyScalar(l2, factor)];
      }
    }

    // lambda_+- = 1/2 trA +- 1/2 sqrt( tr^2 A - 4 detA )
    const trA = addScalar(a, d);
    const detA = subtract(multiplyScalar(a, d), multiplyScalar(b, c)) as Scalar;
    const x = multiplyScalar(trA, 0.5);
    const y = multiplyScalar(
      sqrt(subtract(multiplyScalar(trA, trA), multiplyScalar(4, detA)) as Scalar),
      0.5
    );

    return [addScalar(x, y), subtract(x, y) as Scalar];
  }

  /**
   * For a 2x2 matrix compute the transformation matrix S,
   * so that SAS^-1 is an upper triangular matrix
   * @see https://math.berkeley.edu/~ogus/old/Math_54-05/webfoils/jordan.pdf
   * @see http://people.math.harvard.edu/~knill/teaching/math21b2004/exhibits/2dmatrices/index.html
   */
  function jordanBase2x2(
    a: Scalar,
    b: Scalar,
    c: Scalar,
    d: Scalar,
    l1: Scalar,
    l2: Scalar,
    prec: Scalar,
    type: DataType
  ): [[Scalar, Scalar], [Scalar, Scalar]] {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';

    const zero: Scalar = big ? bignumber(0) : cplx ? complex(0) : 0;
    const one: Scalar = big ? bignumber(1) : cplx ? complex(1) : 1;

    // tolerance relative to the largest entry of this block (#1202)
    let blockScale = abs(a) as Scalar;
    for (const x of [b, c, d]) {
      const ax = abs(x) as Scalar;
      if (lt(blockScale, ax)) blockScale = ax;
    }
    prec = multiplyScalar(prec, blockScale);

    // matrix is already upper triangular
    // return an identity matrix
    if (le(abs(c), prec)) {
      return [
        [one, zero],
        [zero, one],
      ];
    }

    // matrix is diagonalizable
    // return its eigenvectors as columns
    if (gt(abs(subtract(l1, l2) as Scalar), prec)) {
      return [
        [subtract(l1, d) as Scalar, subtract(l2, d) as Scalar],
        [c, c],
      ];
    }

    // matrix is not diagonalizable
    // compute diagonal elements of N = A - lambdaI
    const na = subtract(a, l1) as Scalar;
    const nd = subtract(d, l1) as Scalar;

    // col(N,2) = 0  implies  S = ( col(N,1), e_1 )
    // col(N,2) != 0 implies  S = ( col(N,2), e_2 )

    if (le(abs(b), prec) && le(abs(nd), prec)) {
      return [
        [na, one],
        [c, zero],
      ];
    } else {
      return [
        [b, zero],
        [nd, one],
      ];
    }
  }

  /**
   * Enlarge the matrix from nxn to NxN, setting the new
   * elements to 1 on diagonal and 0 elsewhere
   */
  function inflateMatrix(arr: Scalar[][], N: number): Scalar[][] {
    // add columns
    for (let i = 0; i < arr.length; i++) {
      arr[i].push(...Array(N - arr[i].length).fill(0));
    }

    // add rows
    for (let i = arr.length; i < N; i++) {
      arr.push(Array(N).fill(0));
      arr[i][i] = 1;
    }

    return arr;
  }

  /**
   * Create a block-diagonal matrix with the given square matrices on the diagonal
   * @param arr array of matrices to be placed on the diagonal
   * @param N the size of the resulting matrix
   */
  function blockDiag(arr: Scalar[][][], N: number): Scalar[][] {
    const M: Scalar[][] = [];
    for (let i = 0; i < N; i++) {
      M[i] = Array(N).fill(0);
    }

    let I = 0;
    for (const sub of arr) {
      const n = sub.length;

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          M[I + i][I + j] = sub[i][j];
        }
      }

      I += n;
    }

    return M;
  }

  /**
   * Finds the index of an element in an array using a custom equality function
   * @param arr array in which to search
   * @param el the element to find
   * @param fn the equality function
   * @returns the index of `el`, or -1 when it's not in `arr`
   */
  function indexOf<T>(arr: T[], el: T, fn: (a: T, b: T) => boolean): number {
    for (let i = 0; i < arr.length; i++) {
      if (fn(arr[i], el)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Provided a near-singular upper-triangular matrix A and a list of vectors,
   * finds an eigenvector of A with the smallest eigenvalue, which is orthogonal
   * to each vector in the list
   * @param A near-singular square matrix
   * @param N dimension
   * @param orthog list of vectors
   * @param prec epsilon
   * @param type data type
   * @return eigenvector or null
   *
   * @see Numerical Recipes for Fortran 77 - 11.7 Eigenvalues or Eigenvectors by Inverse Iteration
   */
  function inverseIterate(
    A: Scalar[][],
    N: number,
    orthog: Scalar[][],
    prec: Scalar,
    type: DataType
  ): Scalar[] | null {
    const largeNum: Scalar = type === 'BigNumber' ? bignumber(1000) : 1000;

    // Definitely assigned before use: the loop below runs at least once
    // (assigning b) and the `if (i >= 5) return` guard rules out the no-run case.
    let b!: Scalar[]; // the vector

    // you better choose a random vector before I count to five
    let i = 0;
    for (; i < 5; ++i) {
      b = randomOrthogonalVector(N, orthog, type);
      try {
        b = usolve(A, b);
      } catch {
        // That direction didn't work, likely because the original matrix
        // was defective. But still make the full number of tries...
        continue;
      }
      if (gt(norm(b), largeNum)) {
        break;
      }
    }
    if (i >= 5) {
      return null; // couldn't find any orthogonal vector in the image
    }

    // you better converge before I count to ten
    i = 0;
    while (true) {
      const c = usolve(A, b);

      if (lt(norm(orthogonalComplement(b, [c])), prec)) {
        break;
      }
      if (++i >= 10) {
        return null;
      }

      b = normalize(c, type);
    }

    return b;
  }

  /**
   * Generates a random unit vector of dimension N, orthogonal to each vector in the list
   * @param N dimension
   * @param orthog list of vectors
   * @param type data type
   * @returns random vector
   */
  function randomOrthogonalVector(N: number, orthog: Scalar[][], type: DataType): Scalar[] {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';

    // generate random vector with the correct type
    let v: Scalar[] = Array(N)
      .fill(0)
      .map(() => 2 * Math.random() - 1);
    if (big) {
      v = v.map((n) => bignumber(n as number));
    }
    if (cplx) {
      v = v.map((n) => complex(n));
    }

    // project to orthogonal complement
    v = orthogonalComplement(v, orthog);

    // normalize
    return normalize(v, type);
  }

  /**
   * Project vector v to the orthogonal complement of an array of vectors
   */
  function orthogonalComplement(v: Scalar[], orthog: Scalar[][]): Scalar[] {
    const vectorShape = size(v);
    for (let w of orthog) {
      w = reshape(w, vectorShape); // make sure this is just a vector computation
      // v := v - (w, v)/|w|^2 w
      v = subtract(
        v as unknown as Scalar[],
        multiply(
          divideScalar(dot(w, v), dot(w, w)),
          w as unknown as Scalar[][]
        ) as unknown as Scalar[]
      ) as unknown as Scalar[];
    }

    return v;
  }

  /**
   * Calculate the norm of a vector.
   * We can't use math.norm because factory can't handle circular dependency.
   */
  function norm(v: Scalar[]): Scalar {
    return abs(sqrt(dot(v, v))) as Scalar;
  }

  /**
   * Normalize a vector
   * @param v the vector to normalize
   * @param type data type
   * @returns normalized vector
   */
  function normalize(v: Scalar[], type: DataType): Scalar[] {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';
    const one: Scalar = big ? bignumber(1) : cplx ? complex(1) : 1;

    return multiply(divideScalar(one, norm(v)), v as unknown as Scalar[][]) as unknown as Scalar[];
  }

  return complexEigs;
}
