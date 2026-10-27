import { isBigNumber, isComplex, isNode, isUnit, typeOf } from '../utils/is.js';
import { factory } from '../utils/factory.js';
import { getPrecedence } from '../operators.js';
import type { MathNode, StringOptions } from './Node.js';

const name = 'ConditionalNode';
const dependencies = ['Node'];

export const createConditionalNode = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ Node }: { Node: new (...args: unknown[]) => MathNode }) => {
    /**
     * Test whether a condition is met
     * @param condition
     * @returns true if condition is true or non-zero, else false
     */
    function testCondition(condition: unknown): boolean {
      if (
        typeof condition === 'number' ||
        typeof condition === 'boolean' ||
        typeof condition === 'string'
      ) {
        return !!condition;
      }

      if (condition) {
        if (isBigNumber(condition)) {
          return !(condition as unknown as { isZero(): boolean }).isZero();
        }

        if (isComplex(condition)) {
          return !!(condition.re || condition.im);
        }

        if (isUnit(condition)) {
          return !!(condition as { value: unknown }).value;
        }
      }

      if (condition === null || condition === undefined) {
        return false;
      }

      throw new TypeError('Unsupported type of condition "' + typeOf(condition) + '"');
    }

    type BranchRender = (node: MathNode) => string;
    type WrapFn = (inner: string) => string;
    type JoinFn = (condition: string, trueExpr: string, falseExpr: string) => string;

    function formatConditionalBranches(
      self: ConditionalNode,
      options: StringOptions | undefined,
      render: BranchRender,
      wrap: WrapFn,
      join: JoinFn
    ): string {
      const parenthesis = options && options.parenthesis ? options.parenthesis : 'keep';
      const precedence = getPrecedence(
        self,
        parenthesis,
        options && options.implicit,
        undefined
      ) as number;

      function branchText(node: MathNode): string {
        let text = render(node);
        const nodePrecedence = getPrecedence(
          node,
          parenthesis,
          options && options.implicit,
          undefined
        );
        if (
          parenthesis === 'all' ||
          node.type === 'OperatorNode' ||
          (nodePrecedence !== null && nodePrecedence <= precedence)
        ) {
          text = wrap(text);
        }
        return text;
      }

      return join(
        branchText(self.condition),
        branchText(self.trueExpr),
        branchText(self.falseExpr)
      );
    }

    class ConditionalNode extends Node {
      condition: MathNode;
      trueExpr: MathNode;
      falseExpr: MathNode;

      /**
       * A lazy evaluating conditional operator: 'condition ? trueExpr : falseExpr'
       *
       * @param condition - Condition, must result in a boolean
       * @param trueExpr - Expression evaluated when condition is true
       * @param falseExpr - Expression evaluated when condition is true
       *
       * @constructor ConditionalNode
       * @extends {Node}
       */
      constructor(condition: MathNode, trueExpr: MathNode, falseExpr: MathNode) {
        super();
        if (!isNode(condition)) {
          throw new TypeError('Parameter condition must be a Node');
        }
        if (!isNode(trueExpr)) {
          throw new TypeError('Parameter trueExpr must be a Node');
        }
        if (!isNode(falseExpr)) {
          throw new TypeError('Parameter falseExpr must be a Node');
        }

        this.condition = condition;
        this.trueExpr = trueExpr;
        this.falseExpr = falseExpr;
      }
      static name = name;
      get type(): string {
        return name;
      }
      get isConditionalNode(): boolean {
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
      _compile(
        math: Record<string, unknown>,
        argNames: Record<string, boolean>
      ): (scope: Map<string, unknown>, args: Record<string, unknown>, context: unknown) => unknown {
        const evalCondition = this.condition._compile(math, argNames);
        const evalTrueExpr = this.trueExpr._compile(math, argNames);
        const evalFalseExpr = this.falseExpr._compile(math, argNames);

        return function evalConditionalNode(
          scope: Map<string, unknown>,
          args: Record<string, unknown>,
          context: unknown
        ) {
          return testCondition(evalCondition(scope, args, context))
            ? evalTrueExpr(scope, args, context)
            : evalFalseExpr(scope, args, context);
        };
      }

      /**
       * Execute a callback for each of the child nodes of this node
       * @param callback
       */
      forEach(callback: (child: MathNode, path: string, parent: MathNode) => void): void {
        callback(this.condition, 'condition', this);
        callback(this.trueExpr, 'trueExpr', this);
        callback(this.falseExpr, 'falseExpr', this);
      }

      /**
       * Create a new ConditionalNode whose children are the results of calling
       * the provided callback function for each child of the original node.
       * @param callback
       * @returns Returns a transformed copy of the node
       */
      map(
        callback: (child: MathNode, path: string, parent: MathNode) => MathNode
      ): ConditionalNode {
        return new ConditionalNode(
          this._ifNode(callback(this.condition, 'condition', this)),
          this._ifNode(callback(this.trueExpr, 'trueExpr', this)),
          this._ifNode(callback(this.falseExpr, 'falseExpr', this))
        );
      }

      /**
       * Create a clone of this node, a shallow copy
       */
      clone(): ConditionalNode {
        return new ConditionalNode(this.condition, this.trueExpr, this.falseExpr);
      }

      /**
       * Get string representation
       * @param options
       * @returns str
       */
      _toString(options?: StringOptions): string {
        return formatConditionalBranches(
          this,
          options,
          (node) => node.toString(options),
          (inner) => '(' + inner + ')',
          (condition, trueExpr, falseExpr) => condition + ' ? ' + trueExpr + ' : ' + falseExpr
        );
      }

      /**
       * Get a JSON representation of the node
       */
      toJSON(): { mathjs: string; condition: MathNode; trueExpr: MathNode; falseExpr: MathNode } {
        return {
          mathjs: name,
          condition: this.condition,
          trueExpr: this.trueExpr,
          falseExpr: this.falseExpr,
        };
      }

      /**
       * Instantiate an ConditionalNode from its JSON representation
       * @param json
       *     An object structured like
       *     ```
       *     {"mathjs": "ConditionalNode",
       *      "condition": ...,
       *      "trueExpr": ...,
       *      "falseExpr": ...}
       *     ```
       *     where mathjs is optional
       */
      static fromJSON(json: {
        condition: MathNode;
        trueExpr: MathNode;
        falseExpr: MathNode;
      }): ConditionalNode {
        return new ConditionalNode(json.condition, json.trueExpr, json.falseExpr);
      }

      /**
       * Get HTML representation
       * @param options
       * @returns str
       */
      _toHTML(options?: StringOptions): string {
        const parenOpen = '<span class="math-parenthesis math-round-parenthesis">(</span>';
        const parenClose = '<span class="math-parenthesis math-round-parenthesis">)</span>';
        return formatConditionalBranches(
          this,
          options,
          (node) => node.toHTML(options),
          (inner) => parenOpen + inner + parenClose,
          (condition, trueExpr, falseExpr) =>
            condition +
            '<span class="math-operator math-conditional-operator">?</span>' +
            trueExpr +
            '<span class="math-operator math-conditional-operator">:</span>' +
            falseExpr
        );
      }

      /**
       * Get LaTeX representation
       * @param options
       * @returns str
       */
      _toTex(options?: StringOptions): string {
        return (
          '\\begin{cases} {' +
          this.trueExpr.toTex(options) +
          '}, &\\quad{\\text{if }\\;' +
          this.condition.toTex(options) +
          '}\\\\{' +
          this.falseExpr.toTex(options) +
          '}, &\\quad{\\text{otherwise}}\\end{cases}'
        );
      }
    }

    return ConditionalNode;
  },
  { isClass: true, isNode: true }
);
