import { format } from '../utils/string.js';
import { typeOf } from '../utils/is.js';
import { escapeLatex } from '../utils/latex.js';
import { constantToMathML } from '../utils/mathml.js';
import { factory } from '../utils/factory.js';
import type { MathNode, StringOptions } from './Node.js';

const name = 'ConstantNode';
const dependencies = ['Node', 'isBounded'];

export const createConstantNode = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    Node,
    isBounded,
  }: {
    Node: new (...args: unknown[]) => MathNode;
    isBounded: (value: unknown) => boolean;
  }) => {
    class ConstantNode extends Node {
      value: unknown;

      /**
       * A ConstantNode holds a constant value like a number or string.
       *
       * Usage:
       *
       *     new ConstantNode(2.3)
       *     new ConstantNode('hello')
       *
       * @param value - Value can be any type (number, BigNumber, bigint, string, ...)
       * @constructor ConstantNode
       * @extends {Node}
       */
      constructor(value: unknown) {
        super();
        this.value = value;
      }
      static name = name;
      get type(): string {
        return name;
      }
      get isConstantNode(): boolean {
        return true;
      }

      /**
       * Compile a node into a JavaScript function.
       * This basically pre-calculates as much as possible and only leaves open
       * calculations which depend on a dynamic scope with variables.
       * @param _math - Math.js namespace with functions and constants.
       * @param _argNames - An object with argument names as key and `true`
       *                          as value. Used in the SymbolNode to optimize
       *                          for arguments from user assigned functions
       *                          (see FunctionAssignmentNode) or special symbols
       *                          like `end` (see IndexNode).
       * @returns Returns a function which can be called like:
       *                        evalNode(scope: Object, args: Object, context: *)
       */
      _compile(
        _math: Record<string, unknown>,
        _argNames: Record<string, boolean>
      ): (scope: Map<string, unknown>, args: Record<string, unknown>, context: unknown) => unknown {
        const value = this.value;

        return function evalConstantNode() {
          return value;
        };
      }

      /**
       * Execute a callback for each of the child nodes of this node
       * @param _callback
       */
      forEach(_callback: (child: MathNode, path: string, parent: MathNode) => void): void {
        // nothing to do, we don't have any children
      }

      /**
       * Create a new ConstantNode with children produced by the given callback.
       * Trivial because there are no children.
       * @param _callback
       * @returns Returns a clone of the node
       */
      map(_callback: (child: MathNode, path: string, parent: MathNode) => MathNode): ConstantNode {
        return this.clone();
      }

      /**
       * Create a clone of this node, a shallow copy
       */
      clone(): ConstantNode {
        return new ConstantNode(this.value);
      }

      /**
       * Get string representation
       * @param options
       * @returns str
       */
      _toString(options?: StringOptions): string {
        return format(this.value, options);
      }

      /**
       * Get HTML representation
       * @param options
       * @returns str
       */
      _toHTML(options?: StringOptions): string {
        const value = this._toString(options);

        switch (typeOf(this.value)) {
          case 'number':
          case 'bigint':
          case 'BigNumber':
          case 'Fraction':
            return '<span class="math-number">' + value + '</span>';
          case 'string':
            return '<span class="math-string">' + value + '</span>';
          case 'boolean':
            return '<span class="math-boolean">' + value + '</span>';
          case 'null':
            return '<span class="math-null-symbol">' + value + '</span>';
          case 'undefined':
            return '<span class="math-undefined">' + value + '</span>';

          default:
            return '<span class="math-symbol">' + value + '</span>';
        }
      }

      /**
       * Get a JSON representation of the node
       */
      toJSON(): { mathjs: string; value: unknown } {
        return { mathjs: name, value: this.value };
      }

      /**
       * Instantiate a ConstantNode from its JSON representation
       * @param json - An object structured like
       *                       `{"mathjs": "SymbolNode", value: 2.3}`,
       *                       where mathjs is optional
       */
      static fromJSON(json: { value: unknown }): ConstantNode {
        return new ConstantNode(json.value);
      }

      /**
       * Get the MathML representation of this node.
       * @returns str
       */
      _toMathML(): string {
        return constantToMathML(this.value);
      }

      _toTex(options?: StringOptions): string {
        const value = this._toString(options);
        const type = typeOf(this.value);

        switch (type) {
          case 'string':
            return '\\mathtt{' + escapeLatex(value) + '}';

          case 'number':
          case 'BigNumber': {
            if (!isBounded(this.value)) {
              return (this.value as { valueOf: () => number }).valueOf() < 0
                ? '-\\infty'
                : '\\infty';
            }

            const index = value.toLowerCase().indexOf('e');
            if (index !== -1) {
              return value.substring(0, index) + '\\cdot10^{' + value.substring(index + 1) + '}';
            }

            return value;
          }

          case 'bigint': {
            return value.toString();
          }

          case 'Fraction':
            return (this.value as { toLatex: () => string }).toLatex();

          default:
            return value;
        }
      }
    }

    return ConstantNode;
  },
  { isClass: true, isNode: true }
);
