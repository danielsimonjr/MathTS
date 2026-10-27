import { factory } from '../utils/factory.js';
import { prepareTransformArrayAndCallback } from './utils/prepareTransformArgs.js';
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

      const prepared = prepareTransformArrayAndCallback(
        args as Node[],
        math as Record<string, unknown>,
        scope as Map<string, unknown>
      );

      return filter(prepared.x, transformCallback(prepared.callback, prepared.callbackArity));
    }
    filterTransform.rawArgs = true;

    return filterTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
