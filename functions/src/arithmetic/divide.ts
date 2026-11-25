import { factory } from '../utils/factory.js';
import { extend } from '../utils/object.js';
import { createMatAlgo12xSfs } from '../type/matrix/utils/matAlgo12xSfs.js';
import { createMatAlgo14xDs } from '../type/matrix/utils/matAlgo14xDs.js';

// Type definitions
interface TypedFunction<T = unknown> {
  // `typed(name, signatures, ...)` creates a typed function; without this overload
  // the factory's result was typed as a value and the public export was uncallable.
  (
    name: string,
    signatures: Record<string, (...args: never[]) => unknown>,
    ...moreSignatures: Record<string, (...args: never[]) => unknown>[]
  ): (...args: unknown[]) => T;
  (...args: unknown[]): T;
  // A typed function always exposes its signature map.
  signatures: Record<string, (...args: unknown[]) => unknown>;
}

interface DenseMatrix {
  _data: unknown[] | unknown[][];
  _size: number[];
  _datatype?: string;
  storage(): 'dense';
  size(): number[];
  valueOf(): unknown[] | unknown[][];
}

interface SparseMatrix {
  _values?: unknown[];
  _index?: number[];
  _ptr?: number[];
  _size: number[];
  _datatype?: string;
  storage(): 'sparse';
  size(): number[];
  valueOf(): unknown[] | unknown[][];
}

type Matrix = DenseMatrix | SparseMatrix;

interface MatrixConstructor {
  (data: unknown[] | unknown[][], storage?: 'dense' | 'sparse'): Matrix;
}

interface NodeOperations {
  createBinaryNode: (op: string, fn: string, left: unknown, right: unknown) => unknown;
  hasNodeArg: (...args: unknown[]) => boolean;
}

interface Dependencies {
  typed: TypedFunction;
  matrix: MatrixConstructor;
  multiply: TypedFunction;

  divideScalar: TypedFunction;

  inv: TypedFunction;
  DenseMatrix: unknown; // class dependency
}

const name = 'divide';
const dependencies = ['typed', 'matrix', 'multiply', 'divideScalar', 'inv', 'DenseMatrix'];

function createDivision(
  { typed, matrix, multiply, divideScalar, DenseMatrix }: Dependencies,
  inverse: TypedFunction,
  nodeOperations?: NodeOperations
) {
  const matAlgo12xSfs = createMatAlgo12xSfs({
    typed,
    DenseMatrix,
  } as unknown as Parameters<typeof createMatAlgo12xSfs>[0]);
  const matAlgo14xDs = createMatAlgo14xDs({ typed });

  /**
   * Divide two values, `x / y`.
   * To divide matrices, `x` is multiplied with the pseudoinverse of `y`: `x * pinv(y)`.
   *
   * Syntax:
   *
   *    math.divide(x, y)
   *
   * Examples:
   *
   *    math.divide(2, 3)            // returns number 0.6666666666666666
   *
   *    const a = math.complex(5, 14)
   *    const b = math.complex(4, 1)
   *    math.divide(a, b)            // returns Complex 2 + 3i
   *
   *    const c = [[7, -6], [13, -4]]
   *    const d = [[1, 2], [4, 3]]
   *    math.divide(c, d)            // returns Array [[-9, 4], [-11, 6]]
   *
   *    const e = math.unit('18 km')
   *    math.divide(e, 4.5)          // returns Unit 4 km
   *
   * See also:
   *
   *    multiply
   *
   * @param  {number | BigNumber | bigint | Fraction | Complex | Unit | Array | Matrix} x   Numerator
   * @param  {number | BigNumber | bigint | Fraction | Complex | Array | Matrix} y          Denominator
   * @return {number | BigNumber | bigint | Fraction | Complex | Unit | Array | Matrix}                      Quotient, `x / y`
   */
  return typed(
    'divide',
    extend(
      {
        ...(nodeOperations && {
          'Node, Node': (x: unknown, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),

          'number, Node': (x: number, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),
          'Node, number': (x: unknown, y: number) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),

          'BigNumber, Node': (x: unknown, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),
          'Node, BigNumber': (x: unknown, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),

          'Complex, Node': (x: unknown, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),
          'Node, Complex': (x: unknown, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),

          'Fraction, Node': (x: unknown, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),
          'Node, Fraction': (x: unknown, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),

          'Unit, Node': (x: unknown, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),
          'Node, Unit': (x: unknown, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),

          'string, Node': (x: string, y: unknown) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),
          'Node, string': (x: unknown, y: string) =>
            nodeOperations.createBinaryNode('/', 'divide', x, y),
        }),

        'Array | Matrix, Array | Matrix': function (
          x: unknown[] | Matrix,
          y: unknown[] | Matrix
        ): unknown[] | Matrix {
          return multiply(x, inverse(y)) as unknown[] | Matrix;
        },

        'DenseMatrix, any': function (x: DenseMatrix, y: unknown): DenseMatrix {
          return matAlgo14xDs(
            x as unknown as Parameters<typeof matAlgo14xDs>[0],
            y,
            divideScalar,
            false
          ) as unknown as DenseMatrix;
        },

        'SparseMatrix, any': function (x: SparseMatrix, y: unknown): Matrix {
          // the result is only sparse when 0 / y is zero, which is not the case
          // for a divisor like 0 or NaN (#1565)
          return matAlgo12xSfs(
            x as unknown as Parameters<typeof matAlgo12xSfs>[0],
            y,
            divideScalar,
            false
          ) as unknown as Matrix;
        },

        'Array, any': function (x: unknown[], y: unknown): unknown[] {
          // use matrix implementation
          return matAlgo14xDs(
            matrix(x) as unknown as Parameters<typeof matAlgo14xDs>[0],
            y,
            divideScalar,
            false
          ).valueOf() as unknown[];
        },

        'any, Array | Matrix': function (x: unknown, y: unknown[] | Matrix): unknown[] | Matrix {
          return multiply(x, inverse(y)) as unknown[] | Matrix;
        },
      },
      divideScalar.signatures
    )
  );
}

export const createDivide = /* #__PURE__ */ factory(
  name,
  [...dependencies, 'pinv', 'nodeOperations'],
  (deps: Dependencies & { pinv: TypedFunction; nodeOperations: NodeOperations }) =>
    createDivision(deps, deps.pinv, deps.nodeOperations)
);

export const createSelectedDivide = /* #__PURE__ */ factory(
  name,
  dependencies,
  (deps: Dependencies & { inv: TypedFunction }) => createDivision(deps, deps.inv)
);
