import { factory } from './utils/factory.js';
import { isFunction } from './utils/is.js';
import { createEmptyMap, toObject } from './utils/map.js';

const name = 'Parser';
const dependencies = ['evaluate', 'parse'] as const;

/** The injected `evaluate` dependency: parse + evaluate against a scope map. */
type EvaluateFn = (expr: string | string[], scope?: Map<string, unknown>) => unknown;

/** The subset of the injected `parse` dependency used by the Parser class. */
interface ParseFn {
  isAlpha(c: string, cPrev: string, cNext: string): boolean;
  isDigit(c: string): boolean;
}

/** Runtime shape of a Parser instance (holds its own variable scope plus the
 *  prototype methods used internally, e.g. by `fromJSON`). */
interface ParserInstance {
  scope: Map<string, unknown>;
  evaluate(expr: string | string[]): unknown;
  get(name: string): unknown;
  getAll(): Record<string, unknown>;
  getAllAsMap(): Map<string, unknown>;
  set(name: string, value: unknown): unknown;
  remove(name: string): void;
  clear(): void;
  toJSON(): {
    mathjs: string;
    variables: Record<string, unknown>;
    functions: Record<string, string>;
  };
}

export const createParserClass = /* #__PURE__ */ factory(
  name,
  dependencies as unknown as string[],
  ({ evaluate, parse }: { evaluate: EvaluateFn; parse: ParseFn }) => {
    /**
     * @constructor Parser
     * Parser contains methods to evaluate or parse expressions, and has a number
     * of convenience methods to get, set, and remove variables from memory. Parser
     * keeps a scope containing variables in memory, which is used for all
     * evaluations.
     *
     * Methods:
     *    const result = parser.evaluate(expr)  // evaluate an expression
     *    const value = parser.get(name)        // retrieve a variable from the parser
     *    const values = parser.getAll()        // retrieve all defined variables
     *    parser.set(name, value)               // set a variable in the parser
     *    parser.remove(name)                   // clear a variable from the
     *                                          // parsers scope
     *    parser.clear()                        // clear the parsers scope
     *
     * Example usage:
     *    const parser = new Parser()
     *    // Note: there is a convenience method which can be used instead:
     *    // const parser = new math.parser()
     *
     *    // evaluate expressions
     *    parser.evaluate('sqrt(3^2 + 4^2)')        // 5
     *    parser.evaluate('sqrt(-4)')               // 2i
     *    parser.evaluate('2 inch in cm')           // 5.08 cm
     *    parser.evaluate('cos(45 deg)')            // 0.7071067811865476
     *
     *    // define variables and functions
     *    parser.evaluate('x = 7 / 2')              // 3.5
     *    parser.evaluate('x + 3')                  // 6.5
     *    parser.evaluate('f(x, y) = x^y')          // f(x, y)
     *    parser.evaluate('f(2, 3)')                // 8
     *
     *    // get and set variables and functions
     *    const x = parser.get('x')                 // 3.5
     *    const f = parser.get('f')                 // function
     *    const g = f(3, 2)                         // 9
     *    parser.set('h', 500)
     *    const i = parser.evaluate('h / 2')        // 250
     *    parser.set('hello', function (name) {
     *        return 'hello, ' + name + '!'
     *    })
     *    parser.evaluate('hello("user")')          // "hello, user!"
     *
     *    // clear defined functions and variables
     *    parser.clear()
     *
     */
    function Parser(this: ParserInstance) {
      if (!(this instanceof Parser)) {
        throw new SyntaxError('Constructor must be called with the new operator');
      }

      Object.defineProperty(this, 'scope', {
        value: createEmptyMap(),
        writable: false,
      });
    }

    /**
     * Attach type information
     */
    Parser.prototype.type = 'Parser';
    Parser.prototype.isParser = true;

    /**
     * Parse and evaluate the given expression
     * @param {string | string[]} expr   A string containing an expression,
     *                                   for example "2+3", or a list with expressions
     * @return {*} result     The result, or undefined when the expression was empty
     * @throws {Error}
     */
    Parser.prototype.evaluate = function (this: ParserInstance, expr: string | string[]): unknown {
      // TODO: validate arguments
      return evaluate(expr, this.scope);
    };

    /**
     * Get a variable (a function or variable) by name from the parsers scope.
     * Returns undefined when not found
     * @param {string} name
     * @return {* | undefined} value
     */
    Parser.prototype.get = function (this: ParserInstance, name: string): unknown {
      // TODO: validate arguments
      return this.scope.has(name) ? this.scope.get(name) : undefined;
    };

    /**
     * Get a map with all defined variables
     * @return {Object} values
     */
    Parser.prototype.getAll = function (this: ParserInstance): Record<string, unknown> {
      return toObject(this.scope);
    };

    /**
     * Get a map with all defined variables
     * @return {Map} values
     */
    Parser.prototype.getAllAsMap = function (this: ParserInstance): Map<string, unknown> {
      return this.scope;
    };

    function isValidVariableName(name: string): boolean {
      if (name.length === 0) {
        return false;
      }

      for (let i = 0; i < name.length; i++) {
        const cPrev = name.charAt(i - 1);
        const c = name.charAt(i);
        const cNext = name.charAt(i + 1);
        const valid = parse.isAlpha(c, cPrev, cNext) || (i > 0 && parse.isDigit(c));

        if (!valid) {
          return false;
        }
      }

      return true;
    }

    /**
     * Set a symbol (a function or variable) by name from the parsers scope.
     * @param {string} name
     * @param {* | undefined} value
     */
    Parser.prototype.set = function (this: ParserInstance, name: string, value: unknown): unknown {
      if (!isValidVariableName(name)) {
        throw new Error(
          `Invalid variable name: '${name}'. Variable names must follow the specified rules.`
        );
      }
      this.scope.set(name, value);
      return value;
    };

    /**
     * Remove a variable from the parsers scope
     * @param {string} name
     */
    Parser.prototype.remove = function (this: ParserInstance, name: string): void {
      this.scope.delete(name);
    };

    /**
     * Clear the scope with variables and functions
     */
    Parser.prototype.clear = function (this: ParserInstance): void {
      this.scope.clear();
    };

    Parser.prototype.toJSON = function (this: ParserInstance): {
      mathjs: string;
      variables: Record<string, unknown>;
      functions: Record<string, string>;
    } {
      const json = {
        mathjs: 'Parser',
        variables: {} as Record<string, unknown>,
        functions: {} as Record<string, string>,
      };

      for (const [name, value] of this.scope) {
        if (isFunction(value)) {
          if (!isExpressionFunction(value)) {
            throw new Error(`Cannot serialize external function ${name}`);
          }

          json.functions[name] = `${value.syntax} = ${value.expr}`;
        } else {
          json.variables[name] = value;
        }
      }

      return json;
    };

    Parser.fromJSON = function (json: {
      variables?: Record<string, unknown>;
      functions?: Record<string, string>;
    }): ParserInstance {
      const parser = new (Parser as unknown as new () => ParserInstance)();

      Object.entries(json.variables || {}).forEach(([name, value]) => parser.set(name, value));
      Object.entries(json.functions || {}).forEach(([_name, fn]) => parser.evaluate(fn));

      return parser;
    };

    return Parser;
  },
  { isClass: true }
);

/** A compiled expression function carries its source `syntax` and `expr`. */
type ExpressionFunction = ((...args: unknown[]) => unknown) & {
  syntax: string;
  expr: string;
};

function isExpressionFunction(value: unknown): value is ExpressionFunction {
  const fn = value as Partial<ExpressionFunction>;
  return (
    typeof value === 'function' && typeof fn.syntax === 'string' && typeof fn.expr === 'string'
  );
}
