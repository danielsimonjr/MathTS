import { factory } from '../utils/factory.js';
import { isCollection } from '../utils/is.js';

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
  bitAnd: (...args: unknown[]) => unknown;
}

const name = 'bitAnd';
const dependencies = ['bitAnd'];

export const createBitAndTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ bitAnd }: Dependencies) => {
    function bitAndTransform(args: Node[], _math: unknown, scope: unknown): unknown {
      const condition1 = args[0].compile().evaluate(scope);
      if (!isCollection(condition1)) {
        if (isNaN(condition1 as number)) {
          return NaN;
        }
        if (condition1 === 0 || condition1 === false) {
          return 0;
        }
      }
      const condition2 = args[1].compile().evaluate(scope);
      return bitAnd(condition1, condition2);
    }

    bitAndTransform.rawArgs = true;

    return bitAndTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
