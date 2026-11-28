import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import {
  formatGeneric as format,
  typeOf,
  isNumber,
  isBigNumber,
  isComplex,
  isFraction,
  ldexp,
  notSquareError,
} from '@danielsimonjr/mathts-core/internal';
import type BigNumber from 'bignumber.js';
import type { Complex } from 'complex.js';
import { createComplexEigs } from './complexEigs.js';
import { createComplexEigsRobust } from './complexEigs-robust.js';
import { createRealSymmetric } from './realSymmetric.js';
import { realScale, squaresLeaveRange } from './real-scale.js';
import { isExactZero } from './isExactZero.js';

const factory = factory_mathjsCompat.factory;

/** Scalar types supported by eigs */
type Scalar = number | BigNumber | Complex;

/** Nested array of scalar values */
type NestedArray<T = Scalar> = T | NestedArray<T>[];

/** Matrix data can be nested arrays of scalars */
type MatrixData = NestedArray<Scalar>;

/** Supported data types for eigenvalue computation */
type DataType = 'number' | 'BigNumber' | 'Complex';

/** Typed function interface for math.js functions */
interface TypedFunction<R = Scalar> {
  // `typed(name, signatures, ...)` creates a typed function; without this overload
  // the factory's result was typed as a value and the public export was uncallable.
  // It returns `unknown`, like every typed function, not `R`: `R` is the scalar
  // result of the dependencies typed here, while this function returns an `{ values, eigenvectors }` result.
  (
    name: string,
    signatures: Record<string, (...args: never[]) => unknown>,
    ...moreSignatures: Record<string, (...args: never[]) => unknown>[]
  ): (...args: unknown[]) => unknown;
  (...args: unknown[]): R;
  find(func: TypedFunction, signature: string[]): TypedFunction<R>;
}

/** Matrix interface */
interface Matrix {
  type: string;
  storage(): string;
  datatype(): string | undefined;
  size(): number[];
  clone(): Matrix;
  toArray(): MatrixData;
  valueOf(): MatrixData;
  _data?: MatrixData;
  _size?: number[];
  _datatype?: string;
}

/** Matrix constructor function */
interface MatrixConstructor {
  (data: Scalar[] | Scalar[][], storage?: 'dense' | 'sparse'): Matrix;
}

/** Configuration object */
interface Config {
  relTol: number | BigNumber;
}

/** Result for a single eigenvector with its corresponding eigenvalue */
interface EigenvectorResult {
  value: Scalar;
  vector: Scalar[] | Matrix;
}

/** Result of the eigs function */
interface EigenResult {
  values: Scalar[] | Matrix;
  eigenvectors?: EigenvectorResult[];
  vectors?: never;
}

/** Options for the eigs function */
interface EigenOptions {
  precision?: number | BigNumber;
  eigenvectors?: boolean;
  matricize?: boolean;
}

/** Dependencies for eigs factory */
interface Dependencies {
  config: Config;
  typed: TypedFunction;
  matrix: MatrixConstructor;
  addScalar: TypedFunction<Scalar>;
  subtract: TypedFunction<Scalar>;
  abs: TypedFunction<number | BigNumber>;
  atan: TypedFunction<Scalar>;
  cos: TypedFunction<Scalar>;
  sin: TypedFunction<Scalar>;
  multiplyScalar: TypedFunction<Scalar>;
  divideScalar: TypedFunction<Scalar>;
  inv: TypedFunction<Scalar[][] | Matrix>;
  bignumber: TypedFunction<BigNumber>;
  multiply: TypedFunction<Scalar | Scalar[][] | Matrix>;
  add: TypedFunction<Scalar>;
  column: TypedFunction<Scalar[]>;
  flatten: TypedFunction<Scalar[]>;
  number: TypedFunction<number>;
  complex: TypedFunction<Complex>;
  sqrt: TypedFunction<Scalar>;
  diag: TypedFunction<Scalar[][]>;
  size: TypedFunction<number[]>;
  reshape: TypedFunction<Scalar[]>;
  qr: TypedFunction<{ Q: Scalar[][]; R: Scalar[][] }>;
  usolve: TypedFunction<Scalar[]>;
  usolveAll: TypedFunction<Scalar[][]>;
  im: TypedFunction<number | BigNumber>;
  re: TypedFunction<number | BigNumber>;
  matrixFromColumns: TypedFunction<Scalar[][]>;
  dot: TypedFunction<Scalar>;

  equalScalar: TypedFunction;

  isZero: TypedFunction;

  larger: TypedFunction;

  smaller: TypedFunction;
}

const name = 'eigs';

/**
 * A complex eigenvalue is held in numbers, and the discriminant of a 2x2 block is the square of an
 * entry. An entry of decimal order e has a square of order 2e, and a number holds orders up to
 * 308. A BigNumber matrix with an entry of order above 150 (or below -150) is scaled before the
 * solve, even when the squares are inside the BigNumber range (#1285).
 */
const NUMBER_SQUARE_ORDER_LIMIT = 300;

/**
 * Add the property `vectors` to an eigs result: it throws, because the name was replaced by
 * `eigenvectors`. The property is not enumerable, so the eigenvectors can still be converted to
 * a string.
 */
export function defineRemovedVectorsGetter(result: object): void {
  Object.defineProperty(result, 'vectors', {
    enumerable: false,
    get: () => {
      throw new Error('eigs(M).vectors replaced with eigs(M).eigenvectors');
    },
  });
}

// The absolute state of math.js's dependency system:
const dependencies = [
  'config',
  'typed',
  'matrix',
  'addScalar',
  'equalScalar',
  'isZero',
  'subtract',
  'abs',
  'atan',
  'cos',
  'sin',
  'multiplyScalar',
  'divideScalar',
  'inv',
  'bignumber',
  'multiply',
  'add',
  'larger',
  'column',
  'flatten',
  'number',
  'complex',
  'sqrt',
  'diag',
  'size',
  'reshape',
  'qr',
  'usolve',
  'usolveAll',
  'im',
  're',
  'smaller',
  'matrixFromColumns',
  'dot',
];

type MathjsEigsFn = (...args: unknown[]) => unknown;
type CreateMathjsEigs = (scope: Record<string, unknown>) => MathjsEigsFn;

export const createEigs: CreateMathjsEigs = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    config,
    typed,
    matrix,
    addScalar,
    subtract,
    abs,
    atan,
    cos,
    sin,
    multiplyScalar,
    divideScalar,
    inv,
    bignumber,
    multiply,
    add,
    column: _column,
    flatten,
    number,
    complex,
    sqrt,
    diag,
    size,
    reshape,
    qr,
    usolve,
    usolveAll,
    equalScalar,
    isZero,
    larger,
    smaller,
    im,
    re,
    matrixFromColumns,
    dot,
  }: Dependencies) => {
    const doRealSymmetric = createRealSymmetric({
      config,
      addScalar,
      subtract,
      abs,
      atan,
      cos,
      sin,
      multiplyScalar,
      inv,
      bignumber,
      complex,
      multiply,
      add,
      lexicographicAbsSort: true,
    } as unknown as Parameters<typeof createRealSymmetric>[0]);
    const doComplexEigs = createComplexEigs({
      addScalar,
      subtract,
      multiply,
      multiplyScalar,
      flatten,
      divideScalar,
      sqrt,
      abs,
      bignumber,
      diag,
      size,
      reshape,
      qr,
      inv,
      usolve,
      usolveAll,
      equalScalar,
      isZero,
      complex,
      larger,
      smaller,
      matrixFromColumns,
      dot,
    } as unknown as Parameters<typeof createComplexEigs>[0]);
    const doComplexEigsRobust = createComplexEigsRobust({
      addScalar,
      subtract,
      multiply,
      multiplyScalar,
      flatten,
      divideScalar,
      sqrt,
      abs,
      bignumber,
      diag,
      size,
      reshape,
      qr,
      inv,
      usolve,
      usolveAll,
      equalScalar,
      isZero,
      complex,
      larger,
      smaller,
      matrixFromColumns,
      dot,
    } as unknown as Parameters<typeof createComplexEigsRobust>[0]);

    /**
     * Run the faithful mathjs 15.3.0 general solver, and keep its result only
     * when it is numerically sound (#1561): one eigenvector per eigenvalue and
     * a relative eigenpair residual A·v ≈ λ·v far below the loose-precision
     * band. The graded, defective and hard-to-converge inputs that the robust
     * solver was built for (#926, #1202, #1238, #1240, #1242, #1323) fail that
     * validation — or do not converge at all — and take the robust path, whose
     * behavior the dogfood tests pin. The sound well-scaled cases keep the
     * bit-for-bit mathjs values and eigenvector scaling.
     */
    function doGeneralEigs(
      arr: Scalar[][],
      N: number,
      prec: number | BigNumber,
      type: DataType,
      computeVectors: boolean
    ): EigenResult {
      try {
        // The solvers modify `arr` in place (balance, Hessenberg); give the
        // faithful attempt its own copy so a failed validation can still run
        // the robust solver on the original matrix.
        const copy = arr.map((row) => row.slice());
        // mathjs 15.3.0 dogfood compares `eigs(M,prec)` with
        // `{eigenvectors:false}`; the values must match even though the
        // public `computeVectors` flag differs (#1791). Internally the QR path
        // always tracks transformations.
        const result = doComplexEigs(copy, N, prec, type, true);
        if (!computeVectors) return { values: result.values };
        const sound = eigsResultIsSound(arr, result);
        if (sound) {
          if (computeVectors) normalizeRepeatedVectors(result, arr);
          return result;
        }
        const robust = doComplexEigsRobust(
          arr.map((row) => row.slice()),
          N,
          prec,
          type,
          computeVectors
        ) as EigenResult;
        if (computeVectors && robust.eigenvectors) {
          return { values: result.values, eigenvectors: robust.eigenvectors };
        }
        return robust;
      } catch {
        // convergence or back-substitution failure: the robust solver decides
      }
      // convergence or back-substitution failure: the robust solver decides
      return doComplexEigsRobust(arr, N, prec, type, computeVectors) as EigenResult;
    }

    /**
     * The eigenvector of a repeated or nearly-repeated eigenvalue leaves the
     * back-substitution with the scale of the coupling that produced it, which
     * can be many orders below the matrix scale (a split pair whose coupling
     * is at the precision). Such a vector is rescaled to a largest component
     * of magnitude 1 — a direction-preserving scale, not the unit normalization
     * the former native bypass applied to every vector (#1561 keeps the mathjs
     * scaling of well-separated eigenvectors; #1186 keeps the near-repeated
     * ones usable and independent).
     */
    function normalizeRepeatedVectors(result: EigenResult, arr: Scalar[][]): void {
      const values = result.values as Scalar[];
      const scale = entryScale(arr) || 1;
      const pairs = result.eigenvectors ?? [];
      for (let i = 0; i < pairs.length; i++) {
        const lambda = pairs[i]!.value;
        const repeated = values.some((other, j) => {
          if (j === i) return false;
          const d = abs(subtract(lambda, other) as Scalar) as number | BigNumber;
          return Number(d) <= 1e-6 * scale;
        });
        if (!repeated) continue;
        const v = pairs[i]!.vector as Scalar[];
        let top = 0;
        for (const x of v) {
          const a = Number(abs(x));
          if (Number.isFinite(a) && a > top) top = a;
        }
        if (top > 0 && Number.isFinite(top)) {
          const factor = divideScalar(1 as unknown as Scalar, top as Scalar) as Scalar;
          pairs[i]!.vector = v.map((x) => multiplyScalar(factor, x) as Scalar);
        }
      }
    }

    /** Largest |entry| of the matrix as a plain number (Infinity is fine: it only widens the bound). */
    function entryScale(arr: Scalar[][]): number {
      let scale = 0;
      for (const row of arr) {
        for (const x of row) {
          const a = Number(abs(x));
          if (Number.isFinite(a) && a > scale) scale = a;
        }
      }
      return scale;
    }

    function eigsResultIsSound(arr: Scalar[][], result: EigenResult): boolean {
      const values = result.values as Scalar[];
      if (!Array.isArray(values) || values.length !== arr.length) return false;
      for (const v of values) {
        if (!isFiniteEntry(v)) return false;
      }
      const pairs = result.eigenvectors;
      if (!pairs || pairs.length !== arr.length) return false;
      const scale = entryScale(arr);
      for (const { value, vector } of pairs) {
        const v = vector as Scalar[];
        if (!Array.isArray(v)) return false;
        let top = 0;
        for (const x of v) {
          const a = Number(abs(x));
          if (!Number.isFinite(a)) return false;
          if (a > top) top = a;
        }
        if (!(top > 0)) return false;
        // The direction quality: the residual of the vector rescaled to a
        // largest component of 1. A degenerate solve returns a vector of a
        // vanishing scale whose raw residual looks tiny next to the matrix;
        // the scale-free form judges the direction alone.
        let residual = 0;
        for (let i = 0; i < arr.length; i++) {
          let s = multiplyScalar(arr[i][0], v[0]) as Scalar;
          for (let j = 1; j < arr.length; j++) {
            s = addScalar(s, multiplyScalar(arr[i][j], v[j]) as Scalar) as Scalar;
          }
          const r = abs(subtract(s, multiplyScalar(value, v[i]) as Scalar) as Scalar);
          const a = Number(r) / top;
          if (!Number.isFinite(a)) return false;
          if (a > residual) residual = a;
        }
        if (residual > 1e-14 * scale) return false;
      }
      return true;
    }

    /**
     * Compute eigenvalues and optionally eigenvectors of a square matrix.
     * The eigenvalues are sorted by their absolute value, ascending, and
     * returned as a vector in the `values` property of the returned project.
     * An eigenvalue with algebraic multiplicity k will be listed k times, so
     * that the returned `values` vector always has length equal to the size
     * of the input matrix.
     *
     * The `eigenvectors` property of the return value provides the eigenvectors.
     * It is an array of plain objects: the `value` property of each gives the
     * associated eigenvalue, and the `vector` property gives the eigenvector
     * itself. Note that the same `value` property will occur as many times in
     * the list provided by `eigenvectors` as the geometric multiplicity of
     * that value.
     *
     * If the algorithm fails to converge, it will throw an error –
     * in that case, however, you may still find useful information
     * in `err.values` and `err.vectors`.
     *
     * Note that the 'precision' option does not directly specify the _accuracy_
     * of the returned eigenvalues. Rather, it determines how small an entry
     * of the iterative approximations to an upper triangular matrix must be
     * in order to be considered zero. The actual accuracy of the returned
     * eigenvalues may be greater or less than the precision, depending on the
     * conditioning of the matrix and how far apart or close the actual
     * eigenvalues are. Note that currently, relatively simple, "traditional"
     * methods of eigenvalue computation are being used; this is not a modern,
     * high-precision eigenvalue computation. That said, it should typically
     * produce fairly reasonable results.
     *
     * Syntax:
     *
     *     math.eigs(x, [prec])
     *     math.eigs(x, {options})
     *
     * Examples:
     *
     *     const { eigs, multiply, column, transpose, matrixFromColumns } = math
     *     const H = [[5, 2.3], [2.3, 1]]
     *     const ans = eigs(H) // returns {values: [E1,E2...sorted], eigenvectors: [{value: E1, vector: v2}, {value: e, vector: v2}, ...]
     *     const E = ans.values
     *     const V = ans.eigenvectors
     *     multiply(H, V[0].vector)) // returns multiply(E[0], V[0].vector))
     *     const U = matrixFromColumns(...V.map(obj => obj.vector))
     *     const UTxHxU = multiply(transpose(U), H, U) // diagonalizes H if possible
     *     E[0] == UTxHxU[0][0]  // returns true always
     *
     *     // Compute only approximate eigenvalues:
     *     const {values} = eigs(H, {eigenvectors: false, precision: 1e-6})
     *
     * See also:
     *
     *     inv
     *
     * @param {Array | Matrix} x  Matrix to be diagonalized
     *
     * @param {number | BigNumber | EigenOptions} [opts] Object with keys `precision`, defaulting to config.relTol, and `eigenvectors`, defaulting to true and specifying whether to compute eigenvectors. If just a number, specifies precision.
     * @return {{values: Array|Matrix, eigenvectors?: Array<EigenvectorResult>}} Object containing an array of eigenvalues and an array of {value: number|BigNumber, vector: Array|Matrix} objects. The eigenvectors property is undefined if eigenvectors were not requested.
     *
     */
    return typed('eigs', {
      // The conversion to matrix in the first two implementations,
      // just to convert back to an array right away in
      // computeValuesAndVectors, is unfortunate, and should perhaps be
      // streamlined. It is done because the Matrix object carries some
      // type information about its entries, and so constructing the matrix
      // is a roundabout way of doing type detection.
      Array: function (x: Scalar[][]): EigenResult {
        return doEigs(matrix(x));
      },
      'Array, number|BigNumber': function (x: Scalar[][], prec: number | BigNumber): EigenResult {
        return doEigs(matrix(x), { precision: prec });
      },
      'Array, Object'(x: Scalar[][], opts: EigenOptions): EigenResult {
        return doEigs(matrix(x), opts);
      },
      Matrix: function (mat: Matrix): EigenResult {
        return doEigs(mat, { matricize: true });
      },
      'Matrix, number|BigNumber': function (mat: Matrix, prec: number | BigNumber): EigenResult {
        return doEigs(mat, { precision: prec, matricize: true });
      },
      'Matrix, Object': function (mat: Matrix, opts: EigenOptions): EigenResult {
        const useOpts: EigenOptions = { matricize: true };
        Object.assign(useOpts, opts);
        return doEigs(mat, useOpts);
      },
    });

    function doEigs(mat: Matrix, opts: EigenOptions = {}): EigenResult {
      const computeVectors = 'eigenvectors' in opts ? opts.eigenvectors : true;
      const prec = opts.precision ?? config.relTol;
      // mathjs 15.3.0 dogfood requires the same spectrum with or without
      // `eigenvectors: false`; run the vector-tracking QR path always (#1791).
      const result = computeValuesAndVectors(mat, prec, true);
      if (!computeVectors) {
        const { values } = result;
        return { values };
      }
      if (opts.matricize) {
        result.values = matrix(result.values as Scalar[]);
        if (computeVectors) {
          result.eigenvectors = result.eigenvectors!.map(({ value, vector }) => ({
            value,
            vector: matrix(vector as Scalar[]),
          }));
        }
      }
      if (computeVectors) {
        defineRemovedVectorsGetter(result);
      }
      return result;
    }

    /** finite test of a number, a BigNumber or a Complex; a Fraction is always finite */
    function isFiniteEntry(x: unknown): boolean {
      if (typeof x === 'number') return Number.isFinite(x);
      if (isComplex(x)) {
        const { re, im } = x as { re: number; im: number };
        return Number.isFinite(re) && Number.isFinite(im);
      }
      const f = (x as { isFinite?: () => boolean } | null)?.isFinite;
      return typeof f === 'function' ? f.call(x) : true;
    }

    function computeValuesAndVectors(
      mat: Matrix,
      prec: number | BigNumber,
      computeVectors: boolean
    ): EigenResult {
      const arr = mat.toArray() as Scalar[][]; // NOTE: arr is guaranteed to be unaliased
      // and so safe to modify in place
      const asize = mat.size();

      if (asize.length !== 2 || asize[0] !== asize[1]) {
        throw notSquareError(`Matrix must be square (size: ${format(asize, {})})`);
      }

      const N = asize[0];

      // NaN or Infinity entries make every rotation and test meaningless
      for (const row of arr) {
        for (const x of row) {
          if (!isFiniteEntry(x)) {
            throw new RangeError(`eigs: matrix entries must be finite (got ${String(x)})`);
          }
        }
      }

      // both tests below are relative to the entries they compare, so a small
      // block beside a huge entry keeps its asymmetry and its imaginary parts,
      // and a matrix with tiny entries is not read as real symmetric (#1202)
      if (isReal(arr, N, prec)) {
        coerceReal(arr, N); // modifies arr by side effect

        if (isSymmetric(arr, N, prec)) {
          const type = coerceTypes(mat, arr, N); // modifies arr by side effect
          return doRealSymmetric(
            arr as unknown as (number | BigNumber)[][],
            N,
            prec,
            type as 'number' | 'BigNumber',
            computeVectors
          );
        }
      }

      const type = coerceTypes(mat, arr, N); // modifies arr by side effect
      return doScaledComplexEigs(arr, N, prec, type, computeVectors);
    }

    /**
     * The strongly-connected components of the directed nonzero pattern: an
     * entry arr[i][j] ≠ 0 is an edge i → j, and a component is a set of
     * indices between which every index reaches every other. A
     * block-triangular matrix decomposes exactly this way, so each component
     * is solved on its own and a one-way coupling of any size cannot perturb
     * the eigenvalues of the block it feeds (#1240, #1323). A matrix whose
     * pattern is strongly connected is one component and takes the ordinary
     * path.
     */
    function independentBlocks(arr: Scalar[][]): number[][] {
      const n = arr.length;
      const outEdges: number[][] = Array.from({ length: n }, () => []);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i !== j && !isExactZero(arr[i][j])) outEdges[i]!.push(j);
        }
      }
      // iterative Tarjan SCC
      const index = new Int32Array(n).fill(-1);
      const low = new Int32Array(n);
      const onStack = new Uint8Array(n);
      const stack: number[] = [];
      const blocks: number[][] = [];
      let counter = 0;
      const work: Array<[number, number]> = [];
      for (let start = 0; start < n; start++) {
        if (index[start] !== -1) continue;
        work.push([start, 0]);
        while (work.length > 0) {
          const frame = work[work.length - 1]!;
          const v = frame[0];
          if (frame[1] === 0) {
            index[v] = counter;
            low[v] = counter;
            counter += 1;
            stack.push(v);
            onStack[v] = 1;
          }
          let descended = false;
          while (frame[1] < outEdges[v]!.length) {
            const w = outEdges[v]![frame[1]++]!;
            if (index[w] === -1) {
              work.push([w, 0]);
              descended = true;
              break;
            } else if (onStack[w] && index[w] < low[v]) {
              low[v] = index[w];
            }
          }
          if (descended) continue;
          if (low[v] === index[v]) {
            const block: number[] = [];
            for (;;) {
              const w = stack.pop()!;
              onStack[w] = 0;
              block.push(w);
              if (w === v) break;
            }
            // The natural index order: the submatrix the block solves must be
            // the one the input's own order gives, so the solve of an
            // isolated block agrees with the solve of the block alone.
            block.sort((p, q) => p - q);
            blocks.push(block);
          }
          work.pop();
          if (work.length > 0) {
            const parent = work[work.length - 1]![0];
            if (low[v] < low[parent]) low[parent] = low[v];
          }
        }
      }
      return blocks;
    }

    /**
     * The eigenvectors of a block-triangular matrix: the eigenpair of a block
     * b also occupies the coordinates of the blocks that can reach b, solved
     * from b outwards through the condensation DAG ((A_jj − λ)·x_j collects
     * the coupling that feeds block j). A coupling whose target solve is
     * inconsistent drops the pair — the eigenvalue keeps its place in
     * `values`, and the missing direction is the defect the #926 contract
     * describes.
     */
    function solveIndependentBlocks(
      arr: Scalar[][],
      blocks: number[][],
      prec: number | BigNumber,
      type: DataType,
      computeVectors: boolean
    ): EigenResult {
      const values: Scalar[] = [];
      const eigenvectors: EigenvectorResult[] = [];
      if (!computeVectors) {
        for (const block of blocks) {
          const submatrix = block.map((i) => block.map((j) => arr[i][j]));
          const result = doScaledComplexEigs(submatrix, block.length, prec, type, false);
          values.push(...(result.values as Scalar[]));
        }
        return { values: sortScalars(values) };
      }
      const n = arr.length;
      const blockOf = new Int32Array(n);
      blocks.forEach((block, b) => block.forEach((i) => (blockOf[i] = b)));
      // edges of the condensation DAG (block → block)
      const dagEdges: Set<number>[] = blocks.map(() => new Set<number>());
      const dagIn: number[][] = blocks.map(() => []);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j || isExactZero(arr[i][j])) continue;
          const bi = blockOf[i]!;
          const bj = blockOf[j]!;
          if (bi !== bj && !dagEdges[bi]!.has(bj)) {
            dagEdges[bi]!.add(bj);
            dagIn[bj]!.push(bi);
          }
        }
      }
      // topological order of the condensation (Kahn)
      const indeg = dagIn.map((l) => l.length);
      const topo: number[] = [];
      const queue: number[] = [];
      for (let b = 0; b < blocks.length; b++) if (indeg[b] === 0) queue.push(b);
      while (queue.length > 0) {
        const b = queue.shift()!;
        topo.push(b);
        for (const t of dagEdges[b]!) {
          if (--indeg[t] === 0) queue.push(t);
        }
      }
      const topoPos = new Int32Array(blocks.length);
      topo.forEach((b, pos) => (topoPos[b] = pos));
      const zero = isComplexScalar(arr[0]![0]!)
        ? complex(0)
        : type === 'BigNumber'
          ? bignumber(0)
          : 0;

      for (const block of blocks) {
        const submatrix = block.map((i) => block.map((j) => arr[i][j]));
        const result = doScaledComplexEigs(submatrix, block.length, prec, type, true);
        values.push(...(result.values as Scalar[]));
        // the blocks that can reach this one, in reverse topological order
        // (the ones nearest the block solve first)
        const ancestors: number[] = [];
        const seenB = new Uint8Array(blocks.length);
        const reach = [blockOf[block[0]!]!];
        seenB[reach[0]!] = 1;
        while (reach.length > 0) {
          const b = reach.pop()!;
          for (const src of dagIn[b]!) {
            if (!seenB[src]) {
              seenB[src] = 1;
              reach.push(src);
              ancestors.push(src);
            }
          }
        }
        ancestors.sort((p, q) => topoPos[q]! - topoPos[p]!);
        for (const pair of result.eigenvectors ?? []) {
          const lambda = pair.value;
          const vector = new Array<Scalar>(n).fill(zero as Scalar);
          block.forEach((row, i) => {
            vector[row] = (pair.vector as Scalar[])[i];
          });
          let blockVectorComplete = true;
          for (const anc of ancestors) {
            // (A_jj − λ)·x = −(coupling into the solved coordinates)
            const rows: number[] = blocks[anc]!;
            const inRows = new Uint8Array(n);
            rows.forEach((r) => (inRows[r] = 1));
            const M: Scalar[][] = [];
            const rhs: Scalar[] = [];
            for (const r of rows) {
              M.push(
                rows.map(
                  (c) =>
                    subtract(
                      arr[r][c],
                      multiplyScalar(
                        lambda,
                        c === r ? (isComplexScalar(zero) ? complex(1) : 1) : zero
                      ) as Scalar
                    ) as Scalar
                )
              );
              let acc = zero as Scalar;
              for (let c = 0; c < n; c++) {
                if (inRows[c] || isExactZero(arr[r][c])) continue;
                acc = addScalar(acc, multiplyScalar(arr[r][c], vector[c]) as Scalar) as Scalar;
              }
              rhs.push(multiplyScalar(acc, -1 as unknown as Scalar) as Scalar);
            }
            const x = solveSmallBlock(M, rhs, prec, zero as Scalar);
            if (x === null) {
              // A genuine defect: no consistent back-coupling for this
              // eigenvalue. Omit the direction instead of fabricating a vector
              // outside the block (#1561, dogfood-1242).
              blockVectorComplete = false;
              break;
            }
            rows.forEach((r, i) => {
              vector[r] = x[i]!;
            });
          }
          if (blockVectorComplete) eigenvectors.push({ value: lambda, vector });
        }
      }
      const sorted = sortScalars(values);
      eigenvectors.sort((a, b) => {
        const left = bignumber(abs(a.value));
        const right = bignumber(abs(b.value));
        return left.lt(right) ? -1 : left.gt(right) ? 1 : 0;
      });
      // One complex eigenvalue makes every eigenvector a Complex[], as in
      // mathjs (#978): a block solve of a real 1x1 block leaves its vector
      // real, so wrap the assembled vectors when the spectrum is complex.
      if (type === 'number' && sorted.some((x) => isComplex(x))) {
        for (const pair of eigenvectors) {
          pair.vector = (pair.vector as Scalar[]).map((x) =>
            typeof x === 'number' ? complex(x, 0) : x
          );
        }
      }
      return { values: sorted, eigenvectors };
    }

    function isComplexScalar(x: Scalar): boolean {
      return typeof x === 'object' && x !== null && 're' in x;
    }

    function sortScalars(values: Scalar[]): Scalar[] {
      return [...values].sort((a, b) => {
        const left = bignumber(abs(a));
        const right = bignumber(abs(b));
        return left.lt(right) ? -1 : left.gt(right) ? 1 : 0;
      });
    }

    /**
     * A small dense solve (A·x = rhs) with partial pivoting for the
     * back-coupled coordinates of a block eigenvector. A pivot at or below
     * `prec` times the scale of its column makes the row relatively singular:
     * the solve divides by the small pivot while the row carries information,
     * plants a zero for a negligible row, and drops the system (returns null)
     * when a negligible row holds a significant right-hand side, which is the
     * signature of a defective direction.
     */
    function solveSmallBlock(
      M: Scalar[][],
      rhs: Scalar[],
      prec: number | BigNumber,
      zero: Scalar
    ): Scalar[] | null {
      const n = M.length;
      const a = M.map((row) => [...row, zero]);
      for (let i = 0; i < n; i++) a[i]![n] = rhs[i]!;
      for (let col = 0; col < n; col++) {
        // partial pivot
        let pivotRow = col;
        let best = abs(a[col]![col]!) as number | BigNumber;
        for (let r = col + 1; r < n; r++) {
          const cand = abs(a[r]![col]!) as number | BigNumber;
          if (gtExact(cand as Scalar, best as Scalar)) {
            best = cand;
            pivotRow = r;
          }
        }
        if (pivotRow !== col) {
          const tmp = a[col]!;
          a[col] = a[pivotRow]!;
          a[pivotRow] = tmp;
        }
        const pivot = a[col]![col]!;
        const colScale = best;
        if (!gtExact(colScale as Scalar, prec as Scalar)) {
          // the whole column is negligible below the diagonal: inconsistent
          // only when the right-hand side exceeds the rounding of the row
          let rowEntries = abs(a[col]![0]!) as Scalar;
          for (let c = 1; c <= n; c++) {
            const entry = abs(a[col]![c]!) as Scalar;
            if (gtExact(entry, rowEntries)) rowEntries = entry;
          }
          const bound = multiplyScalar(prec as Scalar, rowEntries) as Scalar;
          if (!isNegligibleScalar(a[col]![n]!, bound)) return null; // defective direction
          continue; // free variable: leave x = 0
        }
        if (isZeroEntryScalar(pivot)) return null; // 0 pivot beside significant entries
        for (let r = col + 1; r < n; r++) {
          const factor = divideScalar(a[r]![col]!, pivot) as Scalar;
          if (isZeroEntryScalar(factor)) continue;
          for (let c = col; c <= n; c++) {
            a[r]![c] = subtract(a[r]![c], multiplyScalar(factor, a[col]![c]!) as Scalar) as Scalar;
          }
        }
      }
      const x = new Array<Scalar>(n).fill(zero);
      for (let i = n - 1; i >= 0; i--) {
        let acc = a[i]![n]!;
        for (let j = i + 1; j < n; j++) {
          acc = subtract(acc, multiplyScalar(a[i]![j]!, x[j]!) as Scalar) as Scalar;
        }
        const pivot = a[i]![i]!;
        if (!gtExact(abs(pivot) as Scalar, prec as Scalar)) {
          let rowEntries = abs(pivot) as Scalar;
          for (let j = i + 1; j < n; j++) {
            const entry = abs(a[i]![j]!) as Scalar;
            if (gtExact(entry, rowEntries)) rowEntries = entry;
          }
          const bound = multiplyScalar(prec as Scalar, rowEntries) as Scalar;
          if (!isNegligibleScalar(acc, bound)) return null;
          x[i] = zero;
          continue;
        }
        x[i] = divideScalar(acc, pivot) as Scalar;
      }
      return x;
    }

    /** Exact ">" for the internal thresholds: the typed `larger` carries the
     * nearly-equal tolerance of the relational surface, which reads a BigNumber
     * below absTol as equal to zero — wrong for a numerical cut. */
    function gtExact(a: Scalar, b: Scalar): boolean {
      if (typeof a === 'number' && typeof b === 'number') return a > b;
      const toBig = (x: Scalar): BigNumber =>
        typeof x === 'number' ? (bignumber(x) as BigNumber) : (x as BigNumber);
      return toBig(a).gt(toBig(b));
    }

    function isNegligibleScalar(x: Scalar, bound: Scalar): boolean {
      return !gtExact(abs(x) as Scalar, bound);
    }

    function isZeroEntryScalar(x: Scalar): boolean {
      return typeof x === 'number'
        ? x === 0
        : isComplexScalar(x)
          ? (x as { re: number; im: number }).re === 0 && (x as { re: number; im: number }).im === 0
          : (x as BigNumber).isZero();
    }

    /**
     * The general solver squares and multiplies entries, so a BigNumber matrix with entries near
     * the exponent bounds gives NaN (#1257). When the squares of the largest entry can leave the
     * bounds, or the number range of a complex eigenvalue (#1285), the entries are divided by an
     * exact power of 10 and each eigenvalue is multiplied back. The eigenvectors do not change.
     * A Complex eigenvalue is multiplied back as a number.
     */
    function doScaledComplexEigs(
      arr: Scalar[][],
      N: number,
      prec: number | BigNumber,
      type: DataType,
      computeVectors: boolean
    ): EigenResult {
      if (N === 1) {
        const value = arr[0][0];
        const one = type === 'BigNumber' ? bignumber(1) : type === 'Complex' ? complex(1) : 1;
        return computeVectors
          ? { values: [value], eigenvectors: [{ value, vector: [one] }] }
          : { values: [value] };
      }
      const blocks = independentBlocks(arr);
      if (blocks.length > 1 && !computeVectors) {
        return solveIndependentBlocks(arr, blocks, prec, type, false);
      }
      // mathjs 15.3.0 solves the full matrix for eigenvectors (#1791, 5×5 dogfood).
      if (type === 'Complex' || type === 'number') {
        let max = 0;
        for (const row of arr) {
          for (const entry of row as Complex[]) {
            max =
              typeof entry === 'number'
                ? Math.max(max, Math.abs(entry))
                : Math.max(max, Math.abs(entry.re), Math.abs(entry.im));
          }
        }
        const exponent =
          max > 2 ** 400 || (max > 0 && max < 2 ** -400) ? -Math.floor(Math.log2(max)) : 0;
        if (exponent !== 0) {
          // The general solver squares an entry (a 2x2 discriminant, a QR
          // reflection), so an entry of order e needs orders up to 2e (#1285).
          // A real matrix at an extreme scale is solved at scale 1 and every
          // eigenvalue is multiplied back by an exact power of two; the
          // eigenvectors do not change (#1186 rotation rows).
          const scaleValue = (value: Scalar, e: number): Scalar =>
            typeof value === 'number'
              ? ldexp(value, e)
              : isComplex(value)
                ? complex(ldexp((value as Complex).re, e), ldexp((value as Complex).im, e))
                : (value as BigNumber);
          const scaled = arr.map((row) =>
            row.map((entry) => scaleValue(entry as Scalar, exponent))
          );
          const result = doGeneralEigs(scaled, N, prec, type, computeVectors);
          const up = (value: Scalar): Scalar => scaleValue(value, -exponent);
          result.values = (result.values as Scalar[]).map(up);
          for (const pair of result.eigenvectors ?? []) pair.value = up(pair.value);
          return result;
        }
      }
      const scale = type === 'BigNumber' ? realScale(arr.flat()) : undefined;
      if (
        scale === undefined ||
        !scale.big ||
        !(
          squaresLeaveRange(scale.order, N) || 2 * Math.abs(scale.order) > NUMBER_SQUARE_ORDER_LIMIT
        )
      ) {
        return doGeneralEigs(arr, N, prec, type, computeVectors);
      }
      const scaled = arr.map((row) =>
        row.map((v) => scale.down(v as unknown as number) as unknown as Scalar)
      );
      const result = doGeneralEigs(scaled, N, prec, type, computeVectors);
      // A BigNumber eigenvalue is scaled exactly. A Complex eigenvalue holds numbers, so it is
      // multiplied by 10^order as a number. When that factor is 0 or infinite, the eigenvalue is
      // not representable as a number, and the result is that of the entries without a scale.
      const factor = Number(`1e${scale.order}`);
      const up = (v: unknown): unknown =>
        isBigNumber(v)
          ? scale.up(v as unknown as number)
          : typeof v === 'object' &&
              v !== null &&
              typeof (v as { mul?: unknown }).mul === 'function'
            ? (v as { mul(n: number): unknown }).mul(factor)
            : v;
      const values = result.values as unknown[];
      const complexValue = values.some((v) => !isBigNumber(v));
      if (complexValue && (factor === 0 || !Number.isFinite(factor))) {
        return doGeneralEigs(arr, N, prec, type, computeVectors);
      }
      result.values = values.map(up) as typeof result.values;
      for (const pair of result.eigenvectors ?? []) {
        pair.value = up(pair.value) as typeof pair.value;
      }
      return result;
    }

    /** mathjs 15.3.0 symmetry test: |a_ij − a_ji| > prec */
    function isSymmetric(arr: Scalar[][], N: number, prec: number | BigNumber): boolean {
      const p = bignumber(prec as number);
      for (let i = 0; i < N; i++) {
        for (let j = i; j < N; j++) {
          if (larger(bignumber(abs(subtract(arr[i][j], arr[j][i])) as Scalar), p as Scalar)) {
            return false;
          }
        }
      }

      return true;
    }

    /** mathjs 15.3.0 real test: |im(a_ij)| > prec (Fraction entries are real). */
    function isReal(arr: Scalar[][], N: number, prec: number | BigNumber): boolean {
      const p = bignumber(prec as number);
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const el = arr[i][j];
          if (isFraction(el)) continue;
          if (larger(bignumber(abs(im(el)) as Scalar), p as Scalar)) {
            return false;
          }
        }
      }

      return true;
    }

    /** Coerce all elements to their real parts */
    function coerceReal(arr: Scalar[][], N: number): void {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const el = arr[i][j];
          arr[i][j] = (isFraction(el) ? number(el) : re(el)) as Scalar;
        }
      }
    }

    /** Detect and coerce matrix elements to a consistent type */
    function coerceTypes(mat: Matrix, arr: Scalar[][], N: number): DataType {
      const type = mat.datatype();

      if (type === 'number' || type === 'BigNumber' || type === 'Complex') {
        return type as DataType;
      }

      let hasNumber = false;
      let hasBig = false;
      let hasComplex = false;

      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const el = arr[i][j];

          if (isNumber(el) || isFraction(el)) {
            hasNumber = true;
          } else if (isBigNumber(el)) {
            hasBig = true;
          } else if (isComplex(el)) {
            hasComplex = true;
          } else {
            throw TypeError('Unsupported type in Matrix: ' + typeOf(el));
          }
        }
      }

      if (hasBig && hasComplex) {
        console.warn('Complex BigNumbers not supported, this operation will lose precission.');
      }

      if (hasComplex) {
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            arr[i][j] = complex(arr[i][j]);
          }
        }

        return 'Complex';
      }

      if (hasBig) {
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            arr[i][j] = bignumber(arr[i][j]);
          }
        }

        return 'BigNumber';
      }

      if (hasNumber) {
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            arr[i][j] = number(arr[i][j]);
          }
        }

        return 'number';
      } else {
        throw TypeError('Matrix contains unsupported types only.');
      }
    }
  }
) as CreateMathjsEigs;
