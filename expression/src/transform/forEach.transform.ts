import { createTransformCallback } from './utils/transformCallback.js';
import { factory } from '../utils/factory.js';
import { prepareTransformArrayAndCallback } from './utils/prepareTransformArgs.js';

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

      const prepared = prepareTransformArrayAndCallback(
        args as Node[],
        math as Record<string, unknown>,
        scope as Map<string, unknown>
      );

      return forEach(prepared.x, transformCallback(prepared.callback, prepared.callbackArity));
    }
    forEachTransform.rawArgs = true;
    return forEachTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
