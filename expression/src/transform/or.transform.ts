import { createOr } from '../../function/logical/or.js';
import { factory } from '../utils/factory.js';
import { isCollection } from '../utils/is.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Node {
  compile(): CompiledExpression;
}

interface CompiledExpression {
  evaluate(scope: unknown): unknown;
}

interface TransformFunction {
  (args: Node[], math: unknown, scope: unknown): unknown;
  rawArgs?: boolean;
}

interface Dependencies {
  typed: TypedFunction;
  matrix: (...args: unknown[]) => unknown;
  equalScalar: (...args: unknown[]) => unknown;
  DenseMatrix: new (...args: unknown[]) => unknown;
  concat: (...args: unknown[]) => unknown;
}

const name = 'or';
const dependencies = ['typed', 'matrix', 'equalScalar', 'DenseMatrix', 'concat'];

export const createOrTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, equalScalar, DenseMatrix, concat }: Dependencies) => {
    const or = createOr({ typed, matrix, equalScalar, DenseMatrix, concat });

    function orTransform(args: Node[], math: unknown, scope: unknown): unknown {
      const condition1 = args[0].compile().evaluate(scope);
      if (!isCollection(condition1) && or(condition1, false)) {
        return true;
      }
      const condition2 = args[1].compile().evaluate(scope);
      return or(condition1, condition2);
    }

    orTransform.rawArgs = true;

    return orTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
