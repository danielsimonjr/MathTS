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
  and: (...args: unknown[]) => unknown;
}

const name = 'and';
const dependencies = ['and'];

export const createAndTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ and }: Dependencies) => {
    function andTransform(args: Node[], _math: unknown, scope: unknown): unknown {
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
