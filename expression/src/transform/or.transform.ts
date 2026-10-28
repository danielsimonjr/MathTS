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
  or: (...args: unknown[]) => unknown;
}

const name = 'or';
const dependencies = ['or'];

export const createOrTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ or }: Dependencies) => {
    function orTransform(args: Node[], _math: unknown, scope: unknown): unknown {
      return evalShortCircuitBinary(args, scope, or, (left) =>
        or(left, false) ? { take: true, value: true } : { take: false }
      );
    }

    orTransform.rawArgs = true;

    return orTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
