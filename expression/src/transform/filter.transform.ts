import { factory } from '../utils/factory.js';
import { applyArrayCallbackTransform } from './utils/prepareTransformArgs.js';
import { createTransformCallback } from './utils/transformCallback.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface TransformFunction {
  (args: Node[], math: unknown, scope: unknown): unknown;
  rawArgs?: boolean;
}

interface Node {
  compile(): CompiledExpression;
}

interface CompiledExpression {
  evaluate(scope: unknown): unknown;
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
    const transformCallback = createTransformCallback({ typed });

    function filterTransform(args: Node[], math: unknown, scope: unknown): unknown {
      return applyArrayCallbackTransform(
        args,
        math as Record<string, unknown>,
        scope as Map<string, unknown>,
        filter,
        transformCallback
      );
    }
    filterTransform.rawArgs = true;

    return filterTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
