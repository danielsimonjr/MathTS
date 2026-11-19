import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';

// Type definitions for sylvester
interface MatrixType {
  size(): number[];
  toArray(): unknown[][];
  subset(index: unknown): MatrixType;
  resize(size: number[]): MatrixType;
}

interface SchurResult {
  T: MatrixType;
  U: MatrixType;
}

interface SylvesterDependencies {
  typed: TypedFunction;
  schur: (A: MatrixType) => SchurResult;
  matrixFromColumns: (...cols: MatrixType[]) => MatrixType;
  matrix: (arr: unknown[] | unknown[][]) => MatrixType;
  multiply: TypedFunction;
  range: (start: number, end: number) => unknown;
  concat: TypedFunction;
  transpose: (A: MatrixType) => MatrixType;
  index: TypedFunction;
  subset: TypedFunction;
  add: TypedFunction;
  subtract: TypedFunction;
  identity: (n: number) => MatrixType;
  lusolve: TypedFunction;
  abs: TypedFunction;
}

const name = 'sylvester';
const dependencies = [
  'typed',
  'schur',
  'matrixFromColumns',
  'matrix',
  'multiply',
  'range',
  'concat',
  'transpose',
  'index',
  'subset',
  'add',
  'subtract',
  'identity',
  'lusolve',
  'abs',
];

export const createSylvester = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    schur,
    matrixFromColumns,
    matrix,
    multiply,
    range,
    concat,
    transpose,
    index,
    subset,
    add,
    subtract,
    identity,
    lusolve,
    abs,
  }: SylvesterDependencies) => {
    /**
     *
     * Solves the real-valued Sylvester equation AX+XB=C for X, where A, B and C are
     * matrices of appropriate dimensions, being A and B squared. Notice that other
     * equivalent definitions for the Sylvester equation exist and this function
     * assumes the one presented in the original publication of the the Bartels-
     * Stewart algorithm, which is implemented by this function.
     * https://en.wikipedia.org/wiki/Sylvester_equation
     *
     * Syntax:
     *
     *     math.sylvester(A, B, C)
     *
     * Examples:
     *
     *     const A = [[-1, -2], [1, 1]]
     *     const B = [[2, -1], [1, -2]]
     *     const C = [[-3, 2], [3, 0]]
     *     math.sylvester(A, B, C)      // returns DenseMatrix [[-0.25, 0.25], [1.5, -1.25]]
     *
     * See also:
     *
     *     schur, lyap
     *
     * @param {Matrix | Array} A  Matrix A
     * @param {Matrix | Array} B  Matrix B
     * @param {Matrix | Array} C  Matrix C
     * @return {Matrix | Array}   Matrix X, solving the Sylvester equation
     */
    return typed(name, {
      'Matrix, Matrix, Matrix': _sylvester,
      'Array, Matrix, Matrix': function (A: unknown[][], B: MatrixType, C: MatrixType): MatrixType {
        return _sylvester(matrix(A), B, C);
      },
      'Array, Array, Matrix': function (A: unknown[][], B: unknown[][], C: MatrixType): MatrixType {
        return _sylvester(matrix(A), matrix(B), C);
      },
      'Array, Matrix, Array': function (A: unknown[][], B: MatrixType, C: unknown[][]): MatrixType {
        return _sylvester(matrix(A), B, matrix(C));
      },
      'Matrix, Array, Matrix': function (A: MatrixType, B: unknown[][], C: MatrixType): MatrixType {
        return _sylvester(A, matrix(B), C);
      },
      'Matrix, Array, Array': function (A: MatrixType, B: unknown[][], C: unknown[][]): MatrixType {
        return _sylvester(A, matrix(B), matrix(C));
      },
      'Matrix, Matrix, Array': function (A: MatrixType, B: MatrixType, C: unknown[][]): MatrixType {
        return _sylvester(A, B, matrix(C));
      },
      'Array, Array, Array': function (
        A: unknown[][],
        B: unknown[][],
        C: unknown[][]
      ): unknown[][] {
        return _sylvester(matrix(A), matrix(B), matrix(C)).toArray();
      },
    });
    /** Size of a 2-D matrix; the 1-D empty matrix is the 0 x 0 matrix. */
    function _dims(M: MatrixType): number[] {
      const s = M.size();
      return s.length === 1 && s[0] === 0 ? [0, 0] : s;
    }

    function _sylvester(A: MatrixType, B: MatrixType, C: MatrixType): MatrixType {
      // A is m x m and B is n x n. When m or n is 0, X is the empty m x n matrix (#1233).
      const sa = _dims(A);
      const sb = _dims(B);
      if (sa.length === 2 && sb.length === 2 && sa[0] === sa[1] && sb[0] === sb[1]) {
        if (sa[0] === 0 || sb[0] === 0) {
          // [] is the only Array form of a matrix with 0 rows, so a 1-D empty C is 0 x n.
          const c1 = C.size();
          const sc = sa[0] === 0 && c1.length === 1 && c1[0] === 0 ? [0, sb[0]] : c1;
          if (sc.length !== 2 || sc[0] !== sa[0] || sc[1] !== sb[0]) {
            throw new RangeError(
              'Dimension mismatch: C must be ' +
                sa[0] +
                ' x ' +
                sb[0] +
                ' (size: [' +
                sc.join(', ') +
                '])'
            );
          }
          return matrix([]).resize([sa[0], sb[0]]);
        }
      }
      const n = B.size()[0];
      const m = A.size()[0];

      const sA = schur(A);
      const F = sA.T;
      const U = sA.U;
      const sB = schur(multiply(-1, B) as MatrixType);
      const G = sB.T;
      const V = sB.U;
      const D = multiply(multiply(transpose(U), C), V);
      const all = range(0, m);
      const y: MatrixType[] = [];

      const hc = (a: unknown, b: unknown) => concat(a, b, 1);
      const vc = (a: unknown, b: unknown) => concat(a, b, 0);

      for (let k = 0; k < n; k++) {
        if (k < n - 1 && (abs(subset(G, index(k + 1, k))) as number) > 1e-5) {
          let RHS = vc(subset(D, index(all, [k])), subset(D, index(all, [k + 1])));
          for (let j = 0; j < k; j++) {
            RHS = add(
              RHS,
              vc(multiply(y[j], subset(G, index(j, k))), multiply(y[j], subset(G, index(j, k + 1))))
            );
          }
          const gkk = multiply(identity(m), multiply(-1, subset(G, index(k, k))));
          const gmk = multiply(identity(m), multiply(-1, subset(G, index(k + 1, k))));
          const gkm = multiply(identity(m), multiply(-1, subset(G, index(k, k + 1))));
          const gmm = multiply(identity(m), multiply(-1, subset(G, index(k + 1, k + 1))));
          const LHS = vc(hc(add(F, gkk), gmk), hc(gkm, add(F, gmm)));
          const yAux = lusolve(LHS, RHS) as MatrixType;
          y[k] = yAux.subset(index(range(0, m), [0]));
          y[k + 1] = yAux.subset(index(range(m, 2 * m), [0]));
          k++;
        } else {
          let RHS = subset(D, index(all, [k]));
          for (let j = 0; j < k; j++) {
            RHS = add(RHS, multiply(y[j], subset(G, index(j, k))));
          }
          const gkk = subset(G, index(k, k));
          const LHS = subtract(F, multiply(gkk, identity(m)));

          y[k] = lusolve(LHS, RHS) as MatrixType;
        }
      }
      const Y = matrix(matrixFromColumns(...y) as unknown as unknown[][]);
      const X = multiply(U, multiply(Y, transpose(V)));
      return X as MatrixType;
    }
  }
);
