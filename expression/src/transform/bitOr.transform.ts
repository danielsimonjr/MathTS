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
  bitOr: (...args: unknown[]) => unknown;
}

const name = 'bitOr';
const dependencies = ['bitOr'];

export const createBitOrTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ bitOr }: Dependencies) => {
    function bitOrTransform(args: Node[], _math: unknown, scope: unknown): unknown {
      const condition1 = args[0].compile().evaluate(scope);
      if (!isCollection(condition1)) {
        if (isNaN(condition1 as number)) {
          return NaN;
        }
        if (condition1 === -1) {
          return -1;
        }
        if (condition1 === true) {
          return 1;
        }
      }
      const condition2 = args[1].compile().evaluate(scope);
      return bitOr(condition1, condition2);
    }

    bitOrTransform.rawArgs = true;

    return bitOrTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
