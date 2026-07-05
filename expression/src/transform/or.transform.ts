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
  or: (...args: unknown[]) => unknown;
}

const name = 'or';
const dependencies = ['or'];

export const createOrTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ or }: Dependencies) => {
    function orTransform(args: Node[], _math: unknown, scope: unknown): unknown {
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
