import { factory } from '../utils/factory.js';
import { evalShortCircuitBinary } from './utils/shortCircuitBinary.js';

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
      return evalShortCircuitBinary(args, scope, and, (left) =>
        !and(left, true) ? { take: true, value: false } : { take: false }
      );
    }

    andTransform.rawArgs = true;

    return andTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
