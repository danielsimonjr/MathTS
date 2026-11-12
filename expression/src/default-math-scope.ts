/**
 * The default math scope that the public factories fall back to.
 *
 * It is a minimal arithmetic namespace (not the full functions barrel). It is
 * the safe namespace: `parse`, `typed`, `compile`, `import`, `createUnit`,
 * `resolve`, `chain`, `simplify`, `derivative`, and the node constructors are not
 * properties of it. `evaluate` / one-arg `compileExpression` therefore cannot
 * resolve them, including from a nested expression (`map`'s callback is compiled
 * against the same object).
 *
 * @packageDocumentation
 */

import { compile } from './compiler/compile.js';
import type { Scope } from './compiler/compile.js';
import { compileInlineExpression } from './transform/utils/compileInlineExpression.js';
import type { MathNode } from './node/Node.js';

/**
 * Names that build or evaluate other expressions. They are never copied onto
 * the default math scope (the same denylist `functions` evaluate strips).
 */
const SAFE_SCOPE_OMIT: readonly string[] = [
  'import',
  'createUnit',
  'evaluate',
  'parse',
  'compile',
  'typed',
  'simplify',
  'derivative',
  'help',
  'chain',
  'parser',
  'resolve',
  'config',
  'numeric',
  'ConstantNode',
  'SymbolNode',
  'OperatorNode',
  'FunctionNode',
  'AssignmentNode',
  'FunctionAssignmentNode',
  'BlockNode',
  'ArrayNode',
  'ObjectNode',
  'IndexNode',
  'AccessorNode',
  'ParenthesisNode',
  'RangeNode',
  'RelationalNode',
  'ConditionalNode',
];

/** Minimal math scope for arithmetic expressions (no matrix/functions barrel). */
export const defaultMathScope: Record<string, unknown> = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => a / b,
  pow: (a: number, b: number) => Math.pow(a, b),
  mod: (a: number, b: number) => a % b,
  unaryMinus: (a: number) => -a,
  unaryPlus: (a: number) => +a,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  log: Math.log,
  pi: Math.PI,
  π: Math.PI,
  e: Math.E,
  Infinity: Infinity,
  NaN: NaN,
  true: true,
  false: false,
};

let boundMathScope: Record<string, unknown> | undefined;

/**
 * The shared default math scope: a copy of `defaultMathScope` with the unsafe
 * names removed, plus the callback transforms. It is built once, on first use.
 * Every default factory that needs a math scope gets this same object.
 */
export function getDefaultMathScope(): Record<string, unknown> {
  if (boundMathScope !== undefined) return boundMathScope;
  const scope: Record<string, unknown> = { ...defaultMathScope };
  // Parser dependencies stay out of this object: it is mathWithTransform
  // (node.compile / map callbacks) and the namespace createEvaluate resolves
  // symbols against.
  for (const key of SAFE_SCOPE_OMIT) {
    delete scope[key];
  }
  // Callbacks compile against this same object, so a nested expression cannot
  // see the symbols deleted above. Arrays only: the default scope has no matrix.
  scope.map = createCallbackTransform('map', false);
  scope.filter = createCallbackTransform('filter', true);
  boundMathScope = scope;
  return scope;
}

/**
 * `map` / `filter` for the default scope. `rawArgs` so the callback expression
 * is compiled against `math` (the stripped scope), not evaluated as a value.
 */
function createCallbackTransform(kind: 'map' | 'filter', keepOnTruthy: boolean) {
  const transform = (args: MathNode[], math: Record<string, unknown>, scope: Scope): unknown => {
    if (args.length < 2) {
      throw new TypeError(`${kind} expects an array and a callback expression`);
    }
    const collection = compile(args[0] as MathNode, math).evaluate(scope);
    if (!Array.isArray(collection)) {
      throw new TypeError(`${kind} on the default evaluator expects an array`);
    }
    const callback = compileInlineExpression(
      args[1] as unknown as Parameters<typeof compileInlineExpression>[0],
      math,
      scope as unknown as Map<string, unknown>
    );
    const out: unknown[] = [];
    for (const item of collection) {
      const value: unknown = callback(item);
      if (keepOnTruthy) {
        if (value) out.push(item);
      } else {
        out.push(value);
      }
    }
    return out;
  };
  transform.rawArgs = true;
  return transform;
}
