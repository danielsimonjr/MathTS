import { factory } from '../../utils/factory.js';
import { isFunctionAssignmentNode, isSymbolNode } from '../../utils/is.js';
import { createMap } from '../../matrix/map.js';
import { compileInlineExpression } from './utils/compileInlineExpression.js';
import { createTransformCallback } from './utils/transformCallback.js';
import type {
  TypedFunction,
  ExpressionNode,
  EvaluationScope,
  MathJsLike,
  CallbackFunction,
  RawArgsTransformFunction,
} from './types.js';

interface MapDependencies {
  typed: TypedFunction;
}

const name = 'map';
const dependencies = ['typed'];

export const createMapTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed }: MapDependencies) => {
    /**
     * Attach a transform function to math.map
     * Adds a property transform containing the transform function.
     *
     * This transform creates a one-based index instead of a zero-based index
     */
    const map = createMap({ typed });
    const transformCallback = createTransformCallback({ typed });

    function mapTransform(
      args: ExpressionNode[],
      math: MathJsLike,
      scope: EvaluationScope | Map<string, unknown>
    ): unknown {
      if (args.length === 0) {
        return map();
      }

      if (args.length === 1) {
        return map(args[0]);
      }
      const N = args.length - 1;
      let X: unknown[] = args.slice(0, N);
      let callback: CallbackFunction | ExpressionNode = args[N];
      X = X.map((arg) => _compileAndEvaluate(arg as ExpressionNode, scope));

      if (callback) {
        if (isSymbolNode(callback) || isFunctionAssignmentNode(callback)) {
          // a function pointer, like filter([3, -2, 5], myTestFunction)
          callback = _compileAndEvaluate(callback as ExpressionNode, scope) as CallbackFunction;
        } else {
          // an expression like filter([3, -2, 5], x > 0)
          callback = compileInlineExpression(callback as ExpressionNode, math, scope);
        }
      }
      return map(...X, transformCallback(callback as CallbackFunction, N));

      function _compileAndEvaluate(
        arg: ExpressionNode,
        scope: EvaluationScope | Map<string, unknown>
      ): unknown {
        return arg.compile().evaluate(scope);
      }
    }
    mapTransform.rawArgs = true as const;

    return mapTransform as RawArgsTransformFunction;
  },
  { isTransformFunction: true }
);
