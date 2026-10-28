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
  bitOr: (...args: unknown[]) => unknown;
}

const name = 'bitOr';
const dependencies = ['bitOr'];

export const createBitOrTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ bitOr }: Dependencies) => {
    function bitOrTransform(args: Node[], _math: unknown, scope: unknown): unknown {
      return evalShortCircuitBinary(args, scope, bitOr, (left) => {
        if (isNaN(left as number)) {
          return { take: true, value: NaN };
        }
        if (left === -1) {
          return { take: true, value: -1 };
        }
        if (left === true) {
          return { take: true, value: 1 };
        }
        return { take: false };
      });
    }

    bitOrTransform.rawArgs = true;

    return bitOrTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
