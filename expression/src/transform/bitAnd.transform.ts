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
  bitAnd: (...args: unknown[]) => unknown;
}

const name = 'bitAnd';
const dependencies = ['bitAnd'];

export const createBitAndTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ bitAnd }: Dependencies) => {
    function bitAndTransform(args: Node[], _math: unknown, scope: unknown): unknown {
      return evalShortCircuitBinary(args, scope, bitAnd, (left) => {
        if (isNaN(left as number)) {
          return { take: true, value: NaN };
        }
        if (left === 0 || left === false) {
          return { take: true, value: 0 };
        }
        return { take: false };
      });
    }

    bitAndTransform.rawArgs = true;

    return bitAndTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
