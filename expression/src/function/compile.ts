import { deepMap } from '../utils/collection.js';
import { factory } from '../utils/factory.js';
import type { Matrix } from '../utils/is.js';

type MathArray = unknown[] | number[][];

interface CompiledNode {
  evaluate(scope?: Map<string, unknown> | Record<string, unknown>): unknown;
}

interface ParseResult {
  compile(): CompiledNode;
}

interface CompileDependencies {
  typed: (name: string, signatures: Record<string, unknown>) => (...args: unknown[]) => unknown;
  parse: (expr: string) => ParseResult;
}

const name = 'compile';
const dependencies = ['typed', 'parse'];

export const createCompile = /* #__PURE__ */ factory<
  CompileDependencies,
  (...args: unknown[]) => unknown
>(name, dependencies, ({ typed, parse }) => {
  /**
   * Parse and compile an expression.
   * Returns a an object with a function `evaluate([scope])` to evaluate the
   * compiled expression.
   *
   * Syntax:
   *
   *     math.compile(expr)                       // returns one node
   *     math.compile([expr1, expr2, expr3, ...]) // returns an array with nodes
   *
   * Examples:
   *
   *     const code1 = math.compile('sqrt(3^2 + 4^2)')
   *     code1.evaluate() // 5
   *
   *     let scope = {a: 3, b: 4}
   *     const code2 = math.compile('a * b') // 12
   *     code2.evaluate(scope) // 12
   *     scope.a = 5
   *     code2.evaluate(scope) // 20
   *
   *     const nodes = math.compile(['a = 3', 'b = 4', 'a * b'])
   *     nodes[2].evaluate() // 12
   *
   * See also:
   *
   *    parse, evaluate
   *
   * @param {string | string[] | Array | Matrix} expr
   *            The expression to be compiled
   * @return {{evaluate: Function} | Array.<{evaluate: Function}>} code
   *            An object with the compiled expression
   * @throws {Error}
   */
  return typed(name, {
    string: function (expr: string) {
      return parse(expr).compile();
    },

    'Array | Matrix': function (expr: MathArray | Matrix) {
      return deepMap(expr as unknown[], function (entry: unknown) {
        return parse(entry as string).compile();
      });
    },
  });
});
