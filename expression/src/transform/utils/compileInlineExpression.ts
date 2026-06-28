import { isSymbolNode } from '../../utils/is.js';
import { PartitionedMap } from '../../utils/map.js';

interface CompilableExpression {
  filter(callback: (node: unknown) => boolean): { name: string }[];
  compile(): { evaluate(scope: unknown): unknown };
}

/**
 * Compile an inline expression like "x > 0"
 * @param {Node} expression
 * @param {Object} math
 * @param {Map} scope
 * @return {function} Returns a function with one argument which fills in the
 *                    undefined variable (like "x") and evaluates the expression
 */
export function compileInlineExpression(
  expression: CompilableExpression,
  math: Record<string, unknown>,
  scope: Map<string, unknown>
) {
  // find an undefined symbol
  const symbol = expression.filter(function (node: unknown) {
    const named = node as { name: string };
    return isSymbolNode(node) && !(named.name in math) && !scope.has(named.name);
  })[0];

  if (!symbol) {
    throw new Error(
      'No undefined variable found in inline expression "' + String(expression) + '"'
    );
  }

  // create a test function for this equation
  const name = symbol.name; // variable name
  const argsScope = new Map<string, unknown>();
  const subScope = new PartitionedMap(scope, argsScope, new Set([name]));
  const eq = expression.compile();
  return function inlineExpression(x: unknown) {
    argsScope.set(name, x);
    return eq.evaluate(subScope);
  };
}
