import { createAnd } from '../../function/logical/and.js';
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
  zeros: (...args: unknown[]) => unknown;
  not: (...args: unknown[]) => unknown;
  concat: (...args: unknown[]) => unknown;
}

const name = 'and';
const dependencies = ['typed', 'matrix', 'zeros', 'add', 'equalScalar', 'not', 'concat'];

export const createAndTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, matrix, equalScalar, zeros, not, concat }: Dependencies) => {
    const and = createAnd({ typed, matrix, equalScalar, zeros, not, concat });

    function andTransform(args: Node[], math: unknown, scope: unknown): unknown {
      const condition1 = args[0].compile().evaluate(scope);
      if (!isCollection(condition1) && !and(condition1, true)) {
        return false;
      }
      const condition2 = args[1].compile().evaluate(scope);
      return and(condition1, condition2);
    }

    andTransform.rawArgs = true;

    return andTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
