import { createEigenvalues2x2 } from './eigen-values-2x2.js';
import { clone } from '../../utils/object.js';
import { createEigsFindEigenvectors } from './find-vectors.js';
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
  subtract: (
    a: Scalar | Scalar[] | Scalar[][],
    b: Scalar | Scalar[] | Scalar[][]
  ) => Scalar | Scalar[] | Scalar[][];
  flatten: <T>(arr: T[][] | T[]) => T[];
  multiply: (
    a: Scalar | Scalar[] | Scalar[][],
    b: Scalar | Scalar[] | Scalar[][]
  ) => Scalar | Scalar[] | Scalar[][];
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
  usolveAll: (A: Scalar[][], b: Scalar[]) => Scalar[][];
  equalScalar: (a: Scalar, b: Scalar) => boolean;
  isZero: (x: Scalar) => boolean;
  complex: (re: number | Scalar, im?: number) => Complex;
  larger: (a: Scalar, b: Scalar) => boolean;
  smaller: (a: Scalar, b: Scalar) => boolean;
  matrixFromColumns: (...cols: Scalar[][]) => Scalar[][];
  dot: (a: Scalar[], b: Scalar[]) => Scalar;
}

/** Supported data types for eigenvalue computation */
type DataType = 'number' | 'BigNumber' | 'Complex';

/** A coupling of a fraction of a unit of `prec` still carries an eigenpair (#1186). */
const COUPLING_FRACTION_OF_PREC = 0.05;

const isExactZero = (x: Scalar): boolean =>
  typeof x === 'number' ? x === 0 : (x as BigNumber).isZero();

/**
 * Create the `complexEigs` function, which computes the eigenvalues and the optional
 * eigenvectors of a matrix that is not real symmetric.
 *
 * This is a faithful port of the mathjs 15.3.0 algorithm (balance → Hessenberg →
 * shifted QR → eigenvectors by back-substitution), so the results match the
 * mathjs oracle entry for entry on well-scaled matrices (#1561). The scale
 * adaptations for extreme entries live in `eigs.ts` (`doScaledComplexEigs`) and
 * in the symmetric solver.
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
  equalScalar,
  isZero,
  complex,
  larger,
  smaller,
  dot,
}: Dependencies) {
  /**
   * @param arr the matrix to find eigenvalues of
   * @param N size of the matrix
   * @param prec precision, anything lower will be considered zero
   * @param type data type of matrix elements
   * @param findVectors should we find eigenvectors?
   * @returns eigenvalues and optionally eigenvectors
   */
  const findEigenvectors = createEigsFindEigenvectors({
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
    usolve,
    equalScalar,
    complex,
    larger,
    smaller,
    dot,
  } as unknown as Parameters<typeof createEigsFindEigenvectors>[0]);

  function complexEigs(
    arr: Scalar[][],
    N: number,
    prec: number | BigNumber,
    type: DataType,
    findVectors: boolean = true
  ): ComplexEigsResult {
    // TODO check if any row/col are zero except the diagonal

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
    reduceToHessenberg(arr, N, prec, type, findVectors, R);
    // still true that original A = R^-1 arr R)

    // find eigenvalues
    const { values, C } = iterateUntilTriangular(arr, N, prec, type, findVectors);

    // values is the list of eigenvalues, C is the column
    // transformation matrix that transforms arr, the hessenberg
    // matrix, to upper triangular
    // (So U = C^-1 arr C and the relationship between current arr
    // and original A is unchanged.)

    if (findVectors) {
      const eigenvectors = findEigenvectors(arr, N, C!, R!, values, prec, type);
      return { values, eigenvectors };
    }

    return { values };
  }

  /**
   * Enlarge the matrix from nxn to NxN, setting the new
   * elements to 1 on diagonal and 0 elsewhere
   */
  function inflateMatrix(arr: Scalar[][], N: number, type: DataType): Scalar[][] {
    // add columns
    for (const row of arr) {
      while (row.length < N) row.push(zeroOf(type) as Scalar);
    }

    // add rows
    while (arr.length < N) {
      const row = Array<Scalar>(N).fill(zeroOf(type) as Scalar);
      row[arr.length] = oneOf(type) as Scalar;
      arr.push(row);
    }
    return arr;
  }

  function zeroOf(type: DataType): number | BigNumber | Complex {
    return type === 'BigNumber' ? bignumber(0) : type === 'Complex' ? complex(0) : 0;
  }

  /**
   * Is the subdiagonal entry H[k][k-1] of the active n x n window negligible?
   * The LAPACK dlahqr test relative to the two diagonal entries beside it, at a
   * fraction of `prec` (#1186): deflating a coupling makes the eigenvalue
   * beside it real, which loses a genuine complex pair whose imaginary part is
   * of the order of the coupling. Well-scaled matrices converge with
   * subdiagonals of a few machine epsilons, far below the fraction, so their
   * deflation points — and therefore their values — are the mathjs ones.
   */
  function negligible(H: Scalar[][], n: number, k: number, prec: Scalar): boolean {
    const h = abs(H[k]![k - 1]!) as Scalar;
    if (isExactZero(h)) return true;
    let tst = addScalar(abs(H[k - 1]![k - 1]!) as Scalar, abs(H[k]![k]!) as Scalar) as Scalar;
    if (isExactZero(tst)) {
      if (k >= 2) tst = addScalar(tst, abs(H[k - 1]![k - 2]!) as Scalar) as Scalar;
      if (k + 1 < n) tst = addScalar(tst, abs(H[k + 1]![k]!) as Scalar) as Scalar;
    }
    const bound = multiplyScalar(
      COUPLING_FRACTION_OF_PREC,
      multiplyScalar(prec, tst) as Scalar
    ) as Scalar;
    // Exact comparison: the typed `larger` carries the nearly-equal tolerance
    // of the relational surface, which reads a BigNumber (or a number) below
    // absTol as equal to zero and would deflate a live coupling.
    return !gtExact(h, bound);
  }

  function gtExact(a: Scalar, b: Scalar): boolean {
    if (typeof a === 'number' && typeof b === 'number') return a > b;
    const toBig = (x: Scalar): BigNumber =>
      typeof x === 'number' ? (bignumber(x) as BigNumber) : (x as BigNumber);
    return toBig(a).gt(toBig(b));
  }

  function oneOf(type: DataType): number | BigNumber | Complex {
    return type === 'BigNumber' ? bignumber(1) : type === 'Complex' ? complex(1) : 1;
  }

  /**
   * Create a block-diagonal matrix with the given square matrices on the diagonal
   * @param arr array of matrices to be placed on the diagonal
   * @param N the size of the resulting matrix
   */
  function blockDiag(arr: Scalar[][][], N: number): Scalar[][] {
    const M: Scalar[][] = [];
    for (let i = 0; i < N; i++) {
      M[i] = Array<Scalar>(N).fill(0 as unknown as Scalar);
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
   * Equalize the row and column taxicab norms of the matrix by powers of the
   * radix, mathjs's balance pass; it modifies `arr` in place.
   * @param arr the matrix
   * @param N size of the matrix
   * @param type data type of matrix elements
   * @param findVectors should we find eigenvectors?
   * @returns the diagonal row transformation matrix, or null
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
    const realzero = big ? bignumber(0) : 0;
    const one = big ? bignumber(1) : cplx ? complex(1) : 1;
    const realone = big ? bignumber(1) : 1;

    // base of the floating-point arithmetic
    const radix = big ? bignumber(10) : 2;
    const radixSq = multiplyScalar(radix as Scalar, radix as Scalar) as Scalar;

    // the diagonal transformation matrix R
    let Rdiag: Scalar[] | undefined;
    if (findVectors) {
      Rdiag = Array<Scalar>(N).fill(one as Scalar);
    }

    // this isn't the only time we loop thru the matrix...
    let last = false;
    while (!last) {
      // ...haha I'm joking! unless...
      last = true;
      for (let i = 0; i < N; i++) {
        // compute the taxicab norm of i-th column and row
        // TODO optimize for complex numbers
        let colNorm = realzero as Scalar;
        let rowNorm = realzero as Scalar;
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          colNorm = addScalar(colNorm, abs(arr[j][i]) as Scalar) as Scalar;
          rowNorm = addScalar(rowNorm, abs(arr[i][j]) as Scalar) as Scalar;
        }
        if (!isZero(colNorm) && !isZero(rowNorm)) {
          // find integer power closest to balancing the matrix
          // (we want to scale only by integer powers of radix,
          // so that we don't lose any precision due to round-off)

          let f = realone as Scalar;
          let c = colNorm;
          const rowDivRadix = divideScalar(rowNorm, radix as Scalar) as Scalar;
          const rowMulRadix = multiplyScalar(rowNorm, radix as Scalar) as Scalar;
          while (smaller(c, rowDivRadix)) {
            c = multiplyScalar(c, radixSq) as Scalar;
            f = multiplyScalar(f, radix as Scalar) as Scalar;
          }
          while (larger(c, rowMulRadix)) {
            c = divideScalar(c, radixSq) as Scalar;
            f = divideScalar(f, radix as Scalar) as Scalar;
          }

          // check whether balancing is needed
          // condition = (c + rowNorm) / f < 0.95 * (colNorm + rowNorm)
          const condition = smaller(
            divideScalar(addScalar(c, rowNorm) as Scalar, f) as Scalar,
            multiplyScalar(addScalar(colNorm, rowNorm) as Scalar, 0.95) as Scalar
          );

          // apply balancing similarity transformation
          if (condition) {
            // we should loop once again to check whether
            // another rebalancing is needed
            last = false;
            const g = divideScalar(1 as unknown as Scalar, f) as Scalar;
            for (let j = 0; j < N; j++) {
              if (i === j) {
                continue;
              }
              arr[i][j] = multiplyScalar(arr[i][j], g) as Scalar;
              arr[j][i] = multiplyScalar(arr[j][i], f) as Scalar;
            }

            // keep track of transformations
            if (findVectors) {
              Rdiag![i] = multiplyScalar(Rdiag![i], g) as Scalar;
            }
          }
        }
      }
    }

    // return the diagonal row transformation matrix
    return findVectors ? diag(Rdiag!) : null;
  }

  /**
   * @param arr the matrix to reduce
   * Reduce the matrix to upper Hessenberg form (zero below the first
   * subdiagonal) by Gaussian elimination with complete pivoting; it modifies
   * `arr` and `R` in place.
   * @param N size of the matrix
   * @param prec precision, anything lower will be considered zero
   * @param type data type of matrix elements
   * @param findVectors whether to compute eigenvectors
   * @param R the row transformation matrix that will be modified
   */
  function reduceToHessenberg(
    arr: Scalar[][],
    N: number,
    prec: number | BigNumber,
    type: DataType,
    findVectors: boolean,
    R: Scalar[][] | null
  ): Scalar[][] | null {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';
    const zero = big ? bignumber(0) : cplx ? complex(0) : 0;
    if (big) {
      prec = bignumber(prec as number);
    }
    for (let i = 0; i < N - 2; i++) {
      // Find the largest subdiag element in the i-th col

      let maxIndex = 0;
      let max = zero as Scalar;
      for (let j = i + 1; j < N; j++) {
        const el = arr[j][i];
        if (smaller(abs(max) as Scalar, abs(el) as Scalar)) {
          max = el;
          maxIndex = j;
        }
      }

      // This col is pivoted, no need to do anything
      if (smaller(abs(max) as Scalar, prec as Scalar)) {
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
        const n = divideScalar(arr[j][i], max) as Scalar;
        if (n === (0 as unknown as Scalar)) {
          continue;
        }

        // from j-th row subtract n-times (i+1)th row
        for (let k = 0; k < N; k++) {
          arr[j][k] = subtract(arr[j][k], multiplyScalar(n, arr[i + 1][k]) as Scalar) as Scalar;
        }

        // to (i+1)th column add n-times j-th column
        for (let k = 0; k < N; k++) {
          arr[k][i + 1] = addScalar(
            arr[k][i + 1],
            multiplyScalar(n, arr[k][j]) as Scalar
          ) as Scalar;
        }

        // keep track of transformations
        if (findVectors) {
          for (let k = 0; k < N; k++) {
            R![j][k] = subtract(R![j][k], multiplyScalar(n, R![i + 1][k]) as Scalar) as Scalar;
          }
        }
      }
    }
    return R;
  }

  /**
   * Iterate the shifted QR factorization until the matrix is block upper
   * triangular, and collect the converged eigenvalues in descending order of
   * discovery; see Press & Williams, Numerical Recipes, and the QR-algorithm
   * page on Wikipedia.
   * @param A the Hessenberg-form matrix
   * @param N size of A
   * @param prec precision, anything lower will be considered zero
   * @param type data type of matrix elements
   * @param findVectors whether to compute the transformation matrix
   * @returns the eigenvalues, and the column transformation matrix when found
   */
  function iterateUntilTriangular(
    A: Scalar[][],
    N: number,
    prec: number | BigNumber,
    type: DataType,
    findVectors: boolean
  ): TriangularResult {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';
    const one = big ? bignumber(1) : cplx ? complex(1) : 1;
    if (big) {
      prec = bignumber(prec as number);
    }

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

    // N×N matrix describing the overall transformation done during the QR algorithm
    let Qtotal = findVectors ? diag(Array<Scalar>(N).fill(one as Scalar)) : undefined;

    // nxn matrix describing the QR transformations done since last convergence
    let Qpartial = findVectors ? diag(Array<Scalar>(n).fill(one as Scalar)) : undefined;

    // last eigenvalue converged before this many steps
    let lastConvergenceBefore = 0;
    while (lastConvergenceBefore <= 100) {
      lastConvergenceBefore += 1;

      // TODO if the convergence is slow, do something clever

      // Perform the factorization

      const k = arr[n - 1][n - 1]; // TODO this is apparently a somewhat
      // old-fashioned choice; ideally set close to an eigenvalue, or
      // perhaps better yet switch to the implicit QR version that is sometimes
      // specifically called the "Francis algorithm" that is alluded to
      // in the following TODO. (Or perhaps we switch to an independently
      // optimized third-party package for the linear algebra operations...)

      for (let i = 0; i < n; i++) {
        arr[i][i] = subtract(arr[i][i], k) as Scalar;
      }

      // TODO do an implicit QR transformation
      const { Q, R } = qr(arr as Scalar[][]);
      arr = multiply(R, Q) as unknown as Scalar[][];
      for (let i = 0; i < n; i++) {
        arr[i][i] = addScalar(arr[i][i], k) as Scalar;
      }

      // keep track of transformations
      if (findVectors) {
        Qpartial = multiply(Qpartial!, Q) as unknown as Scalar[][];
      }

      // The rightmost diagonal element converged to an eigenvalue
      if (n === 1 || negligible(arr, n, n - 1, prec as Scalar)) {
        lastConvergenceBefore = 0;
        lambdas.push(arr[n - 1][n - 1]);

        // keep track of transformations
        if (findVectors) {
          Sdiag.unshift([[oneOf(type) as Scalar]]);
          inflateMatrix(Qpartial!, N, type);
          Qtotal = multiply(Qtotal!, Qpartial!) as unknown as Scalar[][];
          if (n > 1) {
            Qpartial = diag(Array<Scalar>(n - 1).fill(one as Scalar));
          }
        }

        // reduce the matrix size
        n -= 1;
        arr.pop();
        for (let i = 0; i < n; i++) {
          arr[i].pop();
        }

        // The rightmost diagonal 2x2 block converged
      } else if (n === 2 || negligible(arr, n, n - 2, prec as Scalar)) {
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
          inflateMatrix(Qpartial!, N, type);
          Qtotal = multiply(Qtotal!, Qpartial!) as unknown as Scalar[][];
          if (n > 2) {
            Qpartial = diag(Array<Scalar>(n - 2).fill(one as Scalar));
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
    lambdas.sort((a, b) => +(subtract(abs(a) as Scalar, abs(b) as Scalar) as unknown as number));

    // the algorithm didn't converge
    if (lastConvergenceBefore > 100) {
      const err = new Error(
        'The eigenvalues failed to converge. Only found these eigenvalues: ' + lambdas.join(', ')
      ) as Error & { values: Scalar[]; vectors: never[] };
      err.values = lambdas;
      err.vectors = [];
      throw err;
    }

    // combine the overall QR transformation Qtotal with the subsequent
    // transformation S that turns the diagonal 2x2 blocks to upper triangular
    const C = findVectors
      ? (multiply(Qtotal!, blockDiag(Sdiag, N)) as unknown as Scalar[][])
      : undefined;
    return { values: lambdas, C };
  }

  /**
   * Compute the eigenvalues of an 2x2 matrix
   */
  const eigenvalues2x2 = createEigenvalues2x2({
    addScalar,
    subtract,
    multiplyScalar,
    sqrt,
  } as unknown as Parameters<typeof createEigenvalues2x2>[0]);

  /**
   * For an 2x2 matrix compute the transformation matrix S,
   * so that SAS^-1 is an upper triangular matrix
   */
  function jordanBase2x2(
    a: Scalar,
    b: Scalar,
    c: Scalar,
    d: Scalar,
    l1: Scalar,
    l2: Scalar,
    prec: number | BigNumber,
    type: DataType
  ): Scalar[][] {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';
    const zero = big ? bignumber(0) : cplx ? complex(0) : 0;
    const one = big ? bignumber(1) : cplx ? complex(1) : 1;

    // matrix is already upper triangular
    // return an identity matrix
    if (smaller(abs(c) as Scalar, prec as Scalar)) {
      return [
        [one as Scalar, zero as Scalar],
        [zero as Scalar, one as Scalar],
      ];
    }

    // matrix is diagonalizable
    // return its eigenvectors as columns
    if (larger(abs(subtract(l1, l2) as Scalar) as Scalar, prec as Scalar)) {
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

    if (smaller(abs(b) as Scalar, prec as Scalar) && smaller(abs(nd) as Scalar, prec as Scalar)) {
      return [
        [na, one as Scalar],
        [c, zero as Scalar],
      ];
    } else {
      return [
        [b, zero as Scalar],
        [nd, one as Scalar],
      ];
    }
  }

  return complexEigs;
}
