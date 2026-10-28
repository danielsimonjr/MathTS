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

/**
 * Shared filter/forEach transform body: arity 0/1 delegate to `op`; otherwise
 * compile the collection and callback via {@link prepareTransformArrayAndCallback}.
 */
export function applyArrayCallbackTransform(
  args: TransformArgNode[],
  math: Record<string, unknown>,
  scope: Map<string, unknown>,
  op: (...args: unknown[]) => unknown,
  transformCallback: (callback: unknown, arity: number) => unknown
): unknown {
  if (args.length === 0) {
    return op();
  }

  const x: unknown = args[0];

  if (args.length === 1) {
    return op(x);
  }

  const prepared = prepareTransformArrayAndCallback(args, math, scope);

  return op(prepared.x, transformCallback(prepared.callback, prepared.callbackArity));
}
