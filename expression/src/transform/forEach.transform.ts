import { createTransformCallback } from './utils/transformCallback.js';
import { factory } from '../utils/factory.js';
import { isFunctionAssignmentNode, isSymbolNode } from '../utils/is.js';
import { compileInlineExpression } from './utils/compileInlineExpression.js';

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
  forEach: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'forEach';
const dependencies = ['typed', 'forEach'];

export const createForEachTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, forEach }: Dependencies) => {
    /**
     * Attach a transform function to math.forEach
     * Adds a property transform containing the transform function.
     *
     * This transform creates a one-based index instead of a zero-based index
     */
    const transformCallback = createTransformCallback({ typed });
    function forEachTransform(args: Node[], math: unknown, scope: unknown): unknown {
      if (args.length === 0) {
        return forEach();
      }
      let x: unknown = args[0];

      if (args.length === 1) {
        return forEach(x);
      }

      const N = args.length - 1;
      let callback: unknown = args[N];

      if (x) {
        x = _compileAndEvaluate(x as Node, scope);
      }

      if (callback) {
        if (isSymbolNode(callback) || isFunctionAssignmentNode(callback)) {
          // a function pointer, like filter([3, -2, 5], myTestFunction)
          callback = _compileAndEvaluate(callback as unknown as Node, scope);
        } else {
          // an expression like filter([3, -2, 5], x > 0)
          callback = compileInlineExpression(
            callback as Parameters<typeof compileInlineExpression>[0],
            math as Record<string, unknown>,
            scope as Map<string, unknown>
          );
        }
      }

      return forEach(x, transformCallback(callback, N));
    }
    forEachTransform.rawArgs = true;

    function _compileAndEvaluate(arg: Node, scope: unknown): unknown {
      return arg.compile().evaluate(scope);
    }
    return forEachTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
