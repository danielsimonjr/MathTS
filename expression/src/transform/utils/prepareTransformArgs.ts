import { isFunctionAssignmentNode, isSymbolNode } from '../../utils/is.js';
import { compileInlineExpression } from './compileInlineExpression.js';

interface TransformArgNode {
  compile(): { evaluate(scope: unknown): unknown };
}

function compileAndEvaluate(arg: TransformArgNode, scope: unknown): unknown {
  return arg.compile().evaluate(scope);
}

export interface PreparedTransformArgs {
  x: unknown;
  callback: unknown;
  callbackArity: number;
}

/**
 * Shared tail of filter/forEach transforms: evaluate the collection argument and
 * compile the callback (symbol, function assignment, or inline expression).
 */
export function prepareTransformArrayAndCallback(
  args: TransformArgNode[],
  math: Record<string, unknown>,
  scope: Map<string, unknown>
): PreparedTransformArgs {
  const callbackArity = args.length - 1;
  let x: unknown = args[0];
  let callback: unknown = args[callbackArity];

  if (x) {
    x = compileAndEvaluate(x as TransformArgNode, scope);
  }

  if (callback) {
    if (isSymbolNode(callback) || isFunctionAssignmentNode(callback)) {
      callback = compileAndEvaluate(callback as unknown as TransformArgNode, scope);
    } else {
      callback = compileInlineExpression(
        callback as Parameters<typeof compileInlineExpression>[0],
        math,
        scope
      );
    }
  }

  return { x, callback, callbackArity };
}
