import { getPrecedence } from '../operators.js';
import { escape } from '../utils/string.js';
import { getSafeProperty } from '../utils/customs.js';
import { latexOperators } from '../utils/latex.js';
import { escapeMathML, inlineOperator } from '../utils/mathml.js';
import { factory } from '../utils/factory.js';
import type { MathNode } from './Node.js';

// Type definitions

type CompileFunction = (
  scope: Map<string, unknown>,
  args: Record<string, unknown>,
  context: unknown
) => unknown;

interface StringOptions {
  parenthesis?: 'keep' | 'auto' | 'all';
  implicit?: 'hide' | 'show';
  [key: string]: unknown;
}

interface Dependencies {
  Node: new (...args: unknown[]) => MathNode;
}

const name = 'RelationalNode';
const dependencies = ['Node'];

export const createRelationalNode = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ Node }: Dependencies) => {
    const operatorMap: Record<string, string> = {
      equal: '==',
      unequal: '!=',
      smaller: '<',
      larger: '>',
      smallerEq: '<=',
      largerEq: '>=',
    };

    type ParamRender = (param: MathNode) => string;
    type ParamWrap = (inner: string) => string;
    type RelationalJoin = (conditional: string, rhs: string) => string;

    function renderRelational(
      self: RelationalNode,
      options: StringOptions | undefined,
      renderParam: ParamRender,
      wrapParam: ParamWrap,
      join: RelationalJoin
    ): string {
      const parenthesis = options && options.parenthesis ? options.parenthesis : 'keep';
      const precedence = getPrecedence(
        self,
        parenthesis,
        (options && options.implicit) || 'hide',
        undefined
      ) as number;

      const paramStrings = self.params.map(function (p: MathNode): string {
        const paramPrecedence = getPrecedence(
          p,
          parenthesis,
          (options && options.implicit) || 'hide',
          undefined
        );
        const text = renderParam(p);
        return parenthesis === 'all' || (paramPrecedence !== null && paramPrecedence <= precedence)
          ? wrapParam(text)
          : text;
      });

      let ret = paramStrings[0];
      for (let i = 0; i < self.conditionals.length; i++) {
        ret += join(self.conditionals[i], paramStrings[i + 1]);
      }
      return ret;
    }

    class RelationalNode extends Node {
      conditionals: string[];
      params: MathNode[];

      /**
       * A node representing a chained conditional expression, such as 'x > y > z'
       *
       * @param conditionals
       *     An array of conditional operators used to compare the parameters
       * @param params
       *     The parameters that will be compared
       *
       * @constructor RelationalNode
       * @extends {Node}
       */
      constructor(conditionals: string[], params: MathNode[]) {
        super();
        if (!Array.isArray(conditionals)) {
          throw new TypeError('Parameter conditionals must be an array');
        }
        if (!Array.isArray(params)) {
          throw new TypeError('Parameter params must be an array');
        }
        if (conditionals.length !== params.length - 1) {
          throw new TypeError(
            'Parameter params must contain exactly one more element ' +
              'than parameter conditionals'
          );
        }

        this.conditionals = conditionals;
        this.params = params;
      }
      static name = name;
      get type(): string {
        return name;
      }
      get isRelationalNode(): boolean {
        return true;
      }

      /**
       * Compile a node into a JavaScript function.
       * This basically pre-calculates as much as possible and only leaves open
       * calculations which depend on a dynamic scope with variables.
       * @param math - Math.js namespace with functions and constants.
       * @param argNames - An object with argument names as key and `true`
       *                          as value. Used in the SymbolNode to optimize
       *                          for arguments from user assigned functions
       *                          (see FunctionAssignmentNode) or special symbols
       *                          like `end` (see IndexNode).
       * @returns Returns a function which can be called like:
       *                        evalNode(scope: Object, args: Object, context: *)
       */
      _compile(math: Record<string, unknown>, argNames: Record<string, boolean>): CompileFunction {
        const conditionals = this.conditionals;
        const compiled = this.params.map((p: MathNode): CompileFunction =>
          p._compile(math, argNames)
        );

        return function evalRelationalNode(
          scope: Map<string, unknown>,
          args: Record<string, unknown>,
          context: unknown
        ): boolean {
          let evalLhs: unknown;
          let evalRhs = compiled[0](scope, args, context);

          for (let i = 0; i < conditionals.length; i++) {
            evalLhs = evalRhs;
            evalRhs = compiled[i + 1](scope, args, context);
            const condFn = getSafeProperty(math, conditionals[i]) as (
              ...args: unknown[]
            ) => unknown;
            if (!condFn(evalLhs, evalRhs)) {
              return false;
            }
          }
          return true;
        };
      }

      /**
       * Execute a callback for each of the child nodes of this node
       * @param callback
       */
      forEach(callback: (child: MathNode, path: string, parent: RelationalNode) => void): void {
        this.params.forEach(
          (n: MathNode, i: number) => callback(n, 'params[' + i + ']', this),
          this
        );
      }

      /**
       * Create a new RelationalNode whose children are the results of calling
       * the provided callback function for each child of the original node.
       * @param callback
       * @returns Returns a transformed copy of the node
       */
      map(
        callback: (child: MathNode, path: string, parent: RelationalNode) => MathNode
      ): RelationalNode {
        return new RelationalNode(
          this.conditionals.slice(),
          this.params.map(
            (n: MathNode, i: number) => this._ifNode(callback(n, 'params[' + i + ']', this)),
            this
          )
        );
      }

      /**
       * Create a clone of this node, a shallow copy
       */
      clone(): RelationalNode {
        return new RelationalNode(this.conditionals, this.params);
      }

      /**
       * Get string representation.
       * @param options
       * @returns str
       */
      _toString(options?: StringOptions): string {
        return renderRelational(
          this,
          options,
          (p) => p.toString(options),
          (inner) => '(' + inner + ')',
          (cond, rhs) => ' ' + operatorMap[cond] + ' ' + rhs
        );
      }

      /**
       * Get a JSON representation of the node
       */
      toJSON(): { mathjs: string; conditionals: string[]; params: MathNode[] } {
        return {
          mathjs: name,
          conditionals: this.conditionals,
          params: this.params,
        };
      }

      /**
       * Instantiate a RelationalNode from its JSON representation
       * @param json
       *     An object structured like
       *     `{"mathjs": "RelationalNode", "conditionals": ..., "params": ...}`,
       *     where mathjs is optional
       */
      static fromJSON(json: { conditionals: string[]; params: MathNode[] }): RelationalNode {
        return new RelationalNode(json.conditionals, json.params);
      }

      /**
       * Get HTML representation
       * @param options
       * @returns str
       */
      _toHTML(options?: StringOptions): string {
        const parenthesis = options && options.parenthesis ? options.parenthesis : 'keep';
        // `this` is the RelationalNode being rendered (a registered operator),
        // so its precedence is never null; only params may lack a precedence.
        const precedence = getPrecedence(
          this,
          parenthesis,
          (options && options.implicit) || 'hide',
          undefined
        ) as number;

        const paramStrings = this.params.map(function (p: MathNode, _index: number): string {
          const paramPrecedence = getPrecedence(
            p,
            parenthesis,
            (options && options.implicit) || 'hide',
            undefined
          );
          return parenthesis === 'all' ||
            (paramPrecedence !== null && paramPrecedence <= precedence)
            ? '<span class="math-parenthesis math-round-parenthesis">(</span>' +
                p.toHTML(options) +
                '<span class="math-parenthesis math-round-parenthesis">)</span>'
            : p.toHTML(options);
        });

        let ret = paramStrings[0];
        for (let i = 0; i < this.conditionals.length; i++) {
          ret +=
            '<span class="math-operator math-binary-operator ' +
            'math-explicit-binary-operator">' +
            escape(operatorMap[this.conditionals[i]]) +
            '</span>' +
            paramStrings[i + 1];
        }

        return ret;
      }

      /**
       * Get the MathML representation of this node.
       * @returns str
       */
      _toMathML(): string {
        const params = this.params;
        const conds = this.conditionals;
        if (params.length >= 2 && conds.length === params.length - 1) {
          let out = params[0].toMathML();
          for (let i = 0; i < conds.length; i++) {
            out += `${inlineOperator(conds[i], conds[i])}${params[i + 1].toMathML()}`;
          }
          return `<mrow>${out}</mrow>`;
        }
        return `<mtext>${escapeMathML(this.toString())}</mtext>`;
      }

      _toTex(options?: StringOptions): string {
        const latex = latexOperators as Record<string, string>;
        return renderRelational(
          this,
          options,
          (p) => p.toTex(options),
          (inner) => '\\left(' + inner + '\\right)',
          (cond, rhs) => latex[cond] + rhs
        );
      }
    }

    return RelationalNode;
  },
  { isClass: true, isNode: true }
);
