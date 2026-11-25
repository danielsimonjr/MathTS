import type { TypedFunction } from '../core/function/typed.js';
import type { AlgorithmFunction } from '../type/matrix/types.js';
import { createMatAlgo01xDSid } from '../type/matrix/utils/matAlgo01xDSid.js';
import { createMatAlgo04xSidSid } from '../type/matrix/utils/matAlgo04xSidSid.js';
import { createMatAlgo10xSids } from '../type/matrix/utils/matAlgo10xSids.js';
import { createMatrixAlgorithmSuite } from '../type/matrix/utils/matrixAlgorithmSuite.js';
import { factory } from '../utils/factory.js';

interface SelectedAddDependencies {
  typed: TypedFunction;
  matrix: TypedFunction;
  addScalar: TypedFunction;
  DenseMatrix: unknown;
}

/** Build MathJS-compatible addition using the selected scalar and matrix operations. */
export const createSelectedAdd = /* #__PURE__ */ factory(
  'add',
  ['typed', 'matrix', 'addScalar', 'DenseMatrix'],
  ({ typed, matrix, addScalar, DenseMatrix }: SelectedAddDependencies) => {
    const matrixSuite = createMatrixAlgorithmSuite({ typed, matrix });
    return typed(
      'add',
      {
        'any, any': addScalar,
        'any, any, ...any': typed.referToSelf(
          (self: TypedFunction) => (first: unknown, second: unknown, rest: unknown[]) => {
            let sum = self(first, second);
            for (const value of rest) sum = self(sum, value);
            return sum;
          }
        ),
      },
      matrixSuite({
        elop: addScalar,
        DS: createMatAlgo01xDSid({ typed }) as unknown as AlgorithmFunction,
        SS: createMatAlgo04xSidSid({ typed }) as unknown as AlgorithmFunction,
        Ss: createMatAlgo10xSids({ typed, DenseMatrix }) as unknown as AlgorithmFunction,
      })
    );
  }
);
