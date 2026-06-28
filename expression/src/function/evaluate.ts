import { deepMap } from '../utils/collection.js';
import { factory } from '../utils/factory.js';
import { createEmptyMap } from '../utils/map.js';
import type { Matrix } from '../utils/is.js';

type MathArray = unknown[] | number[][];

interface CompiledNode {
  evaluate(scope?: Map<string, unknown> | Record<string, unknown>): unknown;
}

interface ParseResult {
  compile(): CompiledNode;
}

interface EvaluateDependencies {
  typed: (name: string, signatures: Record<string, unknown>) => (...args: unknown[]) => unknown;
  parse: (expr: string) => ParseResult;
}

const name = 'evaluate';
const dependencies = ['typed', 'parse'];

export const createEvaluate = /* #__PURE__ */ factory<
  EvaluateDependencies,
  (...args: unknown[]) => unknown
>(name, dependencies, ({ typed, parse }) => {
  /**
   * Evaluate an expression.
   *
   * The expression parser does not use JavaScript. Its syntax is close
   * to JavaScript but more suited for mathematical expressions.
   * See [https://mathjs.org/docs/expressions/syntax.html](https://mathjs.org/docs/expressions/syntax.html) to learn
   * the syntax and get an overview of the exact differences from JavaScript.
   *
   * Note the evaluating arbitrary expressions may involve security risks,
   * see [https://mathjs.org/docs/expressions/security.html](https://mathjs.org/docs/expressions/security.html) for more information.
   *
   * Syntax:
   *
   *     math.evaluate(expr)
   *     math.evaluate(expr, scope)
   *     math.evaluate([expr1, expr2, expr3, ...])
   *     math.evaluate([expr1, expr2, expr3, ...], scope)
   *
   * Example:
   *
   *     math.evaluate('(2+3)/4')                // 1.25
   *     math.evaluate('sqrt(3^2 + 4^2)')        // 5
   *     math.evaluate('sqrt(-4)')               // 2i
   *     math.evaluate(['a=3', 'b=4', 'a*b'])    // [3, 4, 12]
   *
   *     let scope = {a:3, b:4}
   *     math.evaluate('a * b', scope)           // 12
   *
   * See also:
   *
   *    parse, compile
   *
   * @param {string | string[] | Matrix} expr   The expression to be evaluated
   * @param {Object} [scope]                    Scope to read/write variables
   * @return {*} The result of the expression
   * @throws {Error}
   */
  return typed(name, {
    string: function (expr: string) {
      const scope = createEmptyMap();
      return parse(expr).compile().evaluate(scope);
    },

    'string, Map | Object': function (
      expr: string,
      scope: Map<string, unknown> | Record<string, unknown>
    ) {
      return parse(expr).compile().evaluate(scope);
    },

    'Array | Matrix': function (expr: MathArray | Matrix) {
      const scope = createEmptyMap();
      return deepMap(expr as unknown[], function (entry: unknown) {
        return parse(entry as string)
          .compile()
          .evaluate(scope);
      });
    },

    'Array | Matrix, Map | Object': function (
      expr: MathArray | Matrix,
      scope: Map<string, unknown> | Record<string, unknown>
    ) {
      return deepMap(expr as unknown[], function (entry: unknown) {
        return parse(entry as string)
          .compile()
          .evaluate(scope);
      });
    },
  });
});
