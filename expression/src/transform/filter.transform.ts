import { factory } from '../utils/factory.js';
import { isFunctionAssignmentNode, isSymbolNode } from '../utils/is.js';
import { compileInlineExpression } from './utils/compileInlineExpression.js';
import { createTransformCallback } from './utils/transformCallback.js';

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
  filter: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'filter';
const dependencies = ['typed', 'filter'];

export const createFilterTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, filter }: Dependencies) => {
    /**
     * Attach a transform function to math.filter
     * Adds a property transform containing the transform function.
     *
     * This transform adds support for equations as test function for math.filter,
     * so you can do something like 'filter([3, -2, 5], x > 0)'.
     */
    function filterTransform(args: Node[], math: unknown, scope: unknown): unknown {
      const transformCallback = createTransformCallback({ typed });

      if (args.length === 0) {
        return filter();
      }
      let x: unknown = args[0];

      if (args.length === 1) {
        return filter(x);
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

      return filter(x, transformCallback(callback, N));
    }
    filterTransform.rawArgs = true;

    function _compileAndEvaluate(arg: Node, scope: unknown): unknown {
      return arg.compile().evaluate(scope);
    }

    return filterTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
