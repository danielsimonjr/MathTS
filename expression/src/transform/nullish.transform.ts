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
  nullish: (...args: unknown[]) => unknown;
}

const name = 'nullish';
const dependencies = ['nullish'];

export const createNullishTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ nullish }: Dependencies) => {
    function nullishTransform(args: Node[], _math: unknown, scope: unknown): unknown {
      const left = args[0].compile().evaluate(scope);

      // If left is not a collection and not nullish, short-circuit and return it
      if (!isCollection(left) && left != null && left !== undefined) {
        return left;
      }

      // Otherwise evaluate right and apply full nullish semantics (incl. element-wise)
      const right = args[1].compile().evaluate(scope);
      return nullish(left, right);
    }

    nullishTransform.rawArgs = true;

    return nullishTransform as TransformFunction;
  },
  { isTransformFunction: true }
);
