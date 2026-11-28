import { isBigNumber } from '@danielsimonjr/mathts-core';
import type BigNumber from 'bignumber.js';
import type { Complex } from 'complex.js';
import { dedupeEigenpairs as dedupeEigenpairsShared } from './eigenvector-dedupe.js';

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
  usolveAll: (U: Scalar[][], b: Scalar[]) => unknown[];
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
  divideScalar,
  sqrt,
  abs,
  bignumber,
  diag,
  size,
  reshape,
  inv,
  usolve,
  usolveAll,
  equalScalar,
  complex,
  larger,
  smaller,
  dot,
}: Dependencies) {
  /** One column vector from a `usolveAll` branch or a `multiply` result. */
  function asColumnVector(v: unknown): Scalar[] {
    const raw =
      typeof v === 'object' && v !== null && 'valueOf' in v
        ? (v as { valueOf(): unknown }).valueOf()
        : v;
    const flat = flatten(raw as Scalar[] | Scalar[][]) as unknown;
    if (Array.isArray(flat) && flat.length > 0 && Array.isArray(flat[0])) {
      return (flat as Scalar[][]).map((row) =>
        Array.isArray(row) ? (row[0] as Scalar) : (row as unknown as Scalar)
      );
    }
    return flat as Scalar[];
  }

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

      let solutions = usolveAll(S, b).map(asColumnVector);
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
      solutions = dedupeIdenticalSolutions(solutions);
      solutions = pruneParallelSolutions(solutions, prec);
      if (solutions.length > 1) {
        const parallel = pruneParallelSolutions(solutions, 1e-6);
        if (parallel.length === 1) solutions = parallel;
      }
      solutions = sortEigenvectorTieBreak(solutions);

      // Transform back into original array coordinates
      const correction = multiply(inv(R), C) as unknown as Scalar[][];
      const back = solutions.map((v) => asColumnVector(multiply(correction, v)));
      vectors.push(
        ...back.map((flat) => {
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
    const precNum =
      typeof prec === 'number' ? prec : Number(isBigNumber(prec) ? prec.toNumber() : prec);
    return dedupeEigenpairsShared(
      vectors,
      precNum,
      (a, b) => subtract(a, b) as Scalar,
      abs,
      dot,
      norm
    );
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

  /** mathjs 15.3.0 inverse iteration start directions (#1791). */
  function seedFrom(_arr: Scalar[][]): void {
    // Present for call-site stability; mathjs uses Math.random here.
  }

  /**
   * Generates a random unit vector of dimension N, orthogonal to each vector in the list.
   */
  function deterministicOrthogonalVector(N: number, orthog: Scalar[][], type: DataType): Scalar[] {
    const big = type === 'BigNumber';
    const cplx = type === 'Complex';
    let v: Scalar[] = Array<Scalar>(N)
      .fill(0 as unknown as Scalar)
      .map(() => (2 * Math.random() - 1) as unknown as Scalar);
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

  /** Remove duplicate branches from `usolveAll` (same direction twice). */
  function dedupeIdenticalSolutions(solutions: Scalar[][]): Scalar[][] {
    const kept: Scalar[][] = [];
    for (const v of solutions) {
      const dup = kept.some(
        (w) => w.length === v.length && w.every((x, i) => equalScalar(x, v[i]!))
      );
      if (!dup) kept.push(v);
    }
    return kept;
  }

  /** mathjs 15.3.0 orders repeated-eigenvalue directions by leading index (#1791). */
  function sortEigenvectorTieBreak(solutions: Scalar[][]): Scalar[][] {
    const leadIndex = (v: Scalar[]): number => {
      for (let i = 0; i < v.length; i++) {
        if (Number(abs(v[i]!)) > 1e-12) return i;
      }
      return v.length;
    };
    return [...solutions].sort((u, v) => leadIndex(v) - leadIndex(u)); // larger lead index first (#1791)
  }

  /** Drop eigenvector candidates that are scalar multiples of an earlier one. */
  function pruneParallelSolutions(solutions: Scalar[][], prec: number | BigNumber): Scalar[][] {
    if (solutions.length <= 1) return solutions;
    const kept: Scalar[][] = [solutions[0]!];
    const tolRaw = typeof prec === 'number' ? prec : Number(prec);
    const tol = Number.isFinite(tolRaw) && tolRaw > 0 ? tolRaw : 1e-12;
    for (let k = 1; k < solutions.length; k++) {
      const v = solutions[k]!;
      const parallel = kept.some((w) => {
        const nu = Number(norm(w));
        const nv = Number(norm(v));
        if (!(nu > 0) || !(nv > 0)) return true;
        const cos = Math.abs(Number(dot(w, v))) / (nu * nv);
        return cos > 1 - tol;
      });
      if (!parallel) kept.push(v);
    }
    return kept;
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
