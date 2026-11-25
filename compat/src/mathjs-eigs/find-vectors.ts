import type BigNumber from 'bignumber.js';
import type { Complex } from 'complex.js';

/** Scalar types supported by the eigenvector solve */
type Scalar = number | BigNumber | Complex;

/** Result for a single eigenvector with its corresponding eigenvalue */
interface EigenvectorResult {
  value: Scalar;
  vector: Scalar[];
}

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
  usolve: (A: Scalar[][], b: Scalar[]) => Scalar[];
  equalScalar: (a: Scalar, b: Scalar) => boolean;
  complex: (re: number | Scalar, im?: number) => Complex;
  larger: (a: Scalar, b: Scalar) => boolean;
  smaller: (a: Scalar, b: Scalar) => boolean;
  dot: (a: Scalar[], b: Scalar[]) => Scalar;
}

/** Supported data types for eigenvalue computation */
type DataType = 'number' | 'BigNumber' | 'Complex';

/**
 * The eigenvector half of `eigs` (#1561): the mathjs 15.3.0 back-substitution
 * pipeline (U = C⁻¹·A·C, one solve per distinct eigenvalue, inverse iteration
 * for the copies of a repeated one), shared by both general solvers so the
 * vector quality cannot drift between them.
 *
 * The zero test of the triangular solve is the eigs `prec`, not an exact zero:
 * a coupling that the solver deflated leaves rounding noise on the diagonal of
 * U − λE, and treating that noise as a nonzero pivot collapses a repeated
 * eigenvalue's eigenvectors onto one direction (#1186). A pivot of magnitude
 * `prec` or below is singular here, which reproduces the deterministic
 * free-variable solutions mathjs gets from its `isZero` (nearly-equal) test.
 */
export function createEigsFindEigenvectors({
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
}: Dependencies) {
  function findEigenvectors(
    A: Scalar[][],
    N: number,
    C: Scalar[][],
    R: Scalar[][],
    values: Scalar[],
    prec: number | BigNumber,
    type: DataType
  ): EigenvectorResult[] {
    seedFrom(A);
    const Cinv = inv(C);
    const U = multiply(multiply(Cinv, A) as unknown as Scalar[][], C) as unknown as Scalar[][];
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';
    const zero = big ? bignumber(0) : cplx ? complex(0) : 0;
    const one = big ? bignumber(1) : cplx ? complex(1) : 1;

    // turn values into a kind of "multiset"
    // this way it is easier to find eigenvectors
    const uniqueValues: Scalar[] = [];
    const multiplicities: number[] = [];
    for (const lambda of values) {
      const i = indexOf(uniqueValues, lambda, equalScalar as (a: Scalar, b: Scalar) => boolean);
      if (i === -1) {
        uniqueValues.push(lambda);
        multiplicities.push(1);
      } else {
        multiplicities[i] += 1;
      }
    }

    // find eigenvectors by solving U − lambdaE = 0
    const vectors: EigenvectorResult[] = [];
    const len = uniqueValues.length;
    const b = Array<Scalar>(N).fill(zero as Scalar);
    const E = diag(Array<Scalar>(N).fill(one as Scalar));
    const hasComplexValue = values.some((x) => typeof x === 'object' && x !== null && 'im' in x);
    for (let i = 0; i < len; i++) {
      const lambda = uniqueValues[i];
      const S = subtract(
        U,
        multiply(lambda as Scalar, E) as unknown as Scalar[][]
      ) as unknown as Scalar[][]; // the characteristic matrix

      const solutions = usolveAll(S, b, prec, type);
      solutions.shift(); // ignore the null vector

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

      // Transform back into original array coordinates
      const correction = multiply(inv(R), C) as unknown as Scalar[][];
      const back = solutions.map((v) => multiply(correction, v) as unknown as Scalar[][]);
      vectors.push(
        ...back.map((v) => {
          const flat = flatten(v) as Scalar[];
          // One complex eigenvalue makes every eigenvector a Complex[], as in
          // mathjs (#978): the vectors of the real eigenvalues ride the same
          // complex correction matrix there; make that explicit for the
          // solves that stayed real.
          const vector =
            type === 'number' && hasComplexValue
              ? flat.map((x) => (typeof x === 'number' ? complex(x, 0) : x))
              : flat;
          return { value: lambda, vector };
        })
      );
    }
    return vectors;
  }

  /**
   * A value at or below the threshold is negligible for the eigenvector solve.
   * The comparison is exact: the typed `larger` carries the nearly-equal
   * tolerance of the relational surface, which reads a BigNumber below absTol
   * as equal to zero — wrong for a numerical cut at a small matrix scale.
   */
  function isNegligible(x: Scalar, threshold: Scalar): boolean {
    const a = abs(x) as Scalar;
    return !gtExact(a, threshold);
  }

  function gtExact(a: Scalar, b: Scalar): boolean {
    if (typeof a === 'number' && typeof b === 'number') return a > b;
    const toBig = (x: Scalar): BigNumber =>
      typeof x === 'number' ? (bignumber(x) as BigNumber) : (x as BigNumber);
    return toBig(a).gt(toBig(b));
  }

  /**
   * All solutions of U·x = b for an upper triangular U: mathjs's backward
   * substitution with its free-variable branches. The singular test is the
   * `prec` of the eigs call, not an exact zero and not config.absTol: a
   * coupling that the solver deflated leaves a pivot of the order of `prec` on
   * the diagonal of U − λE, and the free-variable planting at that pivot is
   * what makes the eigenvectors of a repeated or split eigenvalue independent
   * and deterministic (#1186, #1561).
   *
   * A pivot at or below `prec` is singular when the accumulated right-hand
   * side v[i] is negligible against the row (max(|pivot|, upper entries)): the
   * row imposes no condition, so the first solution plants a free variable
   * there and the later solutions keep theirs. A significant v[i] on a
   * negligible pivot is an inconsistent system: mathjs drops that branch (the
   * whole solve fails for the first solution). A pivot at or below `prec`
   * beside entries above `prec` with a negligible v[i] is still planted — the
   * row is dominated by its off-diagonal part, and the plant plus the
   * lower-column divisions recover the near-null direction.
   */
  function usolveAll(
    S: Scalar[][],
    b: Scalar[],
    prec: number | BigNumber,
    type: DataType
  ): Scalar[][] {
    const B: Scalar[][] = [b.slice()];
    const n = S.length;
    for (let i = n - 1; i >= 0; i--) {
      let L = B.length;
      for (let k = 0; k < L; k++) {
        const v = B[k]!;
        const pivot = S[i]![i]!;
        if (!isNegligible(pivot, prec)) {
          // non-singular row
          v[i] = divideScalar(v[i]!, pivot) as Scalar;
          for (let j = i - 1; j >= 0; j--) {
            // v[j] -= v[i] * S[j,i]
            v[j] = subtract(v[j]!, multiplyScalar(v[i]!, S[j]![i]!) as Scalar) as Scalar;
          }
          continue;
        }
        // the pivot is negligible: compare the accumulated RHS with the row
        let rowMax = abs(pivot) as Scalar;
        for (let j = i + 1; j < n; j++) {
          const entry = abs(S[i]![j]!) as Scalar;
          if (gtExact(entry, rowMax)) rowMax = entry;
        }
        const bound = multiplyScalar(prec as Scalar, rowMax) as Scalar;
        if (!isNegligible(v[i]!, bound)) {
          if (typeof pivot === 'number' ? pivot === 0 : (pivot as BigNumber).isZero()) {
            // structurally singular row with a significant RHS: no solution
            if (k === 0) {
              return [];
            }
            // This RHS is invalid but other solutions may still exist
            B.splice(k, 1);
            k -= 1;
            L -= 1;
          } else {
            // a relatively singular row: the ratio of its entries still fixes
            // x[i], so divide by the small pivot; the amplification is the
            // near-null direction the eigenvector solve is after (#1186)
            v[i] = divideScalar(v[i]!, pivot) as Scalar;
            for (let j = i - 1; j >= 0; j--) {
              v[j] = subtract(v[j]!, multiplyScalar(v[i]!, S[j]![i]!) as Scalar) as Scalar;
            }
          }
        } else if (k === 0) {
          // singular row, negligible RHS: a free variable
          const bNew = v.slice();
          bNew[i] = oneOf(type) as Scalar;
          for (let j = i - 1; j >= 0; j--) {
            bNew[j] = subtract(bNew[j]!, S[j]![i]!) as Scalar;
          }
          B.push(bNew);
        }
      }
    }
    return B;
  }

  function oneOf(type: DataType): number | BigNumber | Complex {
    return type === 'BigNumber' ? bignumber(1) : type === 'Complex' ? complex(1) : 1;
  }

  /**
   * Provided a near-singular upper-triangular matrix A and a list of vectors,
   * finds an eigenvector of A with the smallest eigenvalue, which is orthogonal
   * to each vector in the list.
   */
  function inverseIterate(
    A: Scalar[][],
    N: number,
    orthog: Scalar[][],
    prec: number | BigNumber,
    type: DataType
  ): Scalar[] | null {
    const largeNum = type === 'BigNumber' ? bignumber(1000) : 1000;
    let b: Scalar[]; // the vector

    // you better choose a vector before I count to five
    let i = 0;
    for (; i < 5; ++i) {
      b = deterministicOrthogonalVector(N, orthog, type);
      try {
        b = usolve(A, b);
      } catch {
        // That direction didn't work, likely because the original matrix
        // was defective. But still make the full number of tries...
        continue;
      }
      if (larger(norm(b) as Scalar, largeNum as Scalar)) {
        break;
      }
    }
    if (i >= 5) {
      return null; // couldn't find any orthogonal vector in the image
    }

    // you better converge before I count to ten
    i = 0;
    while (true) {
      const c = usolve(A, b!);
      if (smaller(norm(orthogonalComplement(b!, [c]) as Scalar[]) as Scalar, prec as Scalar)) {
        break;
      }
      if (++i >= 10) {
        return null;
      }
      b = normalize(c, type) as Scalar[];
    }
    return b!;
  }

  /**
   * A fixed deterministic pseudo-random sequence (mulberry32 with a fixed
   * seed). The `Math.random` start of the mathjs original makes the whole
   * solve — and any acceptance test built on it — nondeterministic; a fixed
   * sequence keeps the generic, unaligned start directions while every run of
   * the same input follows the same steps (#1561).
   */
  let pseudoState = 0x2f6e2b1;
  /** Re-seed the stream from the matrix, so every input follows its own
   * deterministic sequence of start directions. */
  function seedFrom(arr: Scalar[][]): void {
    let h = 0x9e3779b9;
    for (const row of arr) {
      for (const x of row) {
        h = Math.imul(h ^ Math.imul((Number(abs(x)) * 1000) | 0, 0x85ebca6b), 0x27d4eb2f) >>> 0;
      }
    }
    pseudoState = h === 0 ? 0x2f6e2b1 : h;
  }
  function nextPseudo(): number {
    pseudoState =
      (Math.imul(pseudoState ^ (pseudoState >>> 15), pseudoState | 1) ^
        (pseudoState + Math.imul(pseudoState ^ (pseudoState >>> 7), pseudoState | 61))) >>>
      0;
    return ((pseudoState ^ (pseudoState >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates a deterministic pseudo-random unit vector of dimension N,
   * orthogonal to each vector in the list.
   */
  function deterministicOrthogonalVector(N: number, orthog: Scalar[][], type: DataType): Scalar[] {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';
    let v: Scalar[] = Array<Scalar>(N)
      .fill(0 as unknown as Scalar)
      .map(() => (2 * nextPseudo() - 1) as unknown as Scalar);
    if (big) {
      v = v.map((n) => bignumber(n as unknown as number));
    }
    if (cplx) {
      v = v.map((n) => complex(n as unknown as number));
    }
    const projected = orthogonalComplement(v, orthog) as Scalar[];
    return normalize(projected, type) as Scalar[];
  }

  /**
   * Project vector v to the orthogonal complement of an array of vectors
   */
  function orthogonalComplement(v: Scalar[], orthog: Scalar[][]): Scalar[] {
    const vectorShape = size(v);
    for (let w of orthog) {
      w = reshape(w, vectorShape) as Scalar[]; // make sure this is just a vector computation
      // v := v − (w, v)/|w|^2 w
      v = subtract(
        v,
        multiply(divideScalar(dot(w, v) as Scalar, dot(w, w) as Scalar) as Scalar, w) as Scalar[]
      ) as Scalar[];
    }
    return v;
  }

  /**
   * Calculate the norm of a vector.
   * We can't use math.norm because factory can't handle circular dependency.
   */
  function norm(v: Scalar[]): Scalar {
    return abs(sqrt(dot(v, v) as Scalar) as Scalar) as Scalar;
  }

  /**
   * Normalize a vector
   */
  function normalize(v: Scalar[], type: DataType): Scalar[] {
    const one = oneOf(type);
    return multiply(divideScalar(one as Scalar, norm(v)) as Scalar, v) as Scalar[];
  }

  /**
   * Finds the index of an element in an array using a custom equality function
   */
  function indexOf<T>(arr: T[], el: T, fn: (a: T, b: T) => boolean): number {
    for (let i = 0; i < arr.length; i++) {
      if (fn(arr[i]!, el)) {
        return i;
      }
    }
    return -1;
  }

  return findEigenvectors;
}
