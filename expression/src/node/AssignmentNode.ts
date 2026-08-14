import { isAccessorNode, isIndexNode, isNode, isSymbolNode } from '../utils/is.js';
import { getSafeProperty, setSafeProperty } from '../utils/customs.js';
import { factory } from '../utils/factory.js';
import { accessFactory } from './utils/access.js';
import { assignFactory } from './utils/assign.js';
import { getPrecedence } from '../operators.js';
import { escapeMathML, toMathMLSymbol } from '../utils/mathml.js';
import type { MathNode, StringOptions } from './Node.js';
import type { IndexLike } from './utils/stringSubset.js';

const name = 'AssignmentNode';
const dependencies = ['subset', 'Node'];

// An IndexNode child node, as accepted/stored by AssignmentNode.
interface IndexNodeChild extends MathNode {
  isObjectProperty: () => boolean;
  getObjectProperty: () => string | null;
}

// An AccessorNode child node (the `a.b` in `a.b[2]=3`).
interface AccessorNodeChild extends MathNode {
  object: MathNode;
  index: IndexNodeChild;
}

// Runtime Index value produced by a compiled IndexNode, as consumed by
// access()/assign().
type RuntimeIndex = { isObjectProperty: () => boolean; getObjectProperty: () => string; isIndex: boolean } & IndexLike;

export const createAssignmentNode = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    subset,
    Node,
  }: {
    subset: (...args: unknown[]) => unknown;
    Node: new (...args: unknown[]) => MathNode;
  }) => {
    const access = accessFactory({ subset });
    const assign = assignFactory({ subset });

    /*
     * Is parenthesis needed?
     * @param {node} node
     * @param {string} [parenthesis='keep']
     * @param {string} implicit
     * @private
     */
    function needParenthesis(
      node: AssignmentNode,
      parenthesis?: string,
      implicit?: string
    ): boolean {
      if (!parenthesis) {
        parenthesis = 'keep';
      }

      // `node` is the AssignmentNode being rendered (a registered operator), so
      // its precedence is never null; only the value expression may lack one.
      const precedence = getPrecedence(node, parenthesis, implicit, undefined) as number;
      const exprPrecedence = getPrecedence(node.value, parenthesis, implicit, undefined);
      return parenthesis === 'all' || (exprPrecedence !== null && exprPrecedence <= precedence);
    }

    class AssignmentNode extends Node {
      object: MathNode;
      index: IndexNodeChild | null; // IndexNode | null
      value: MathNode;

      /**
       * @constructor AssignmentNode
       * @extends {Node}
       *
       * Define a symbol, like `a=3.2`, update a property like `a.b=3.2`, or
       * replace a subset of a matrix like `A[2,2]=42`.
       *
       * Syntax:
       *
       *     new AssignmentNode(symbol, value)
       *     new AssignmentNode(object, index, value)
       *
       * Usage:
       *
       *    new AssignmentNode(new SymbolNode('a'), new ConstantNode(2))  // a=2
       *    new AssignmentNode(new SymbolNode('a'),
       *                       new IndexNode('b'),
       *                       new ConstantNode(2))   // a.b=2
       *    new AssignmentNode(new SymbolNode('a'),
       *                       new IndexNode(1, 2),
       *                       new ConstantNode(3))  // a[1,2]=3
       *
       * @param {SymbolNode | AccessorNode} object
       *     Object on which to assign a value
       * @param {IndexNode} [index=null]
       *     Index, property name or matrix index. Optional. If not provided
       *     and `object` is a SymbolNode, the property is assigned to the
       *     global scope.
       * @param {Node} value
       *     The value to be assigned
       */
      constructor(object: MathNode, index: MathNode | null, value?: MathNode) {
        super();
        this.object = object;
        this.index = value ? (index as unknown as IndexNodeChild) : null;
        this.value = value || (index as MathNode);

        // validate input
        if (!isSymbolNode(object) && !isAccessorNode(object)) {
          throw new TypeError('SymbolNode or AccessorNode expected as "object"');
        }
        if (isSymbolNode(object) && (object as unknown as { name?: string }).name === 'end') {
          throw new Error('Cannot assign to symbol "end"');
        }
        if (this.index && !isIndexNode(this.index)) {
          // index is optional
          throw new TypeError('IndexNode expected as "index"');
        }
        if (!isNode(this.value)) {
          throw new TypeError('Node expected as "value"');
        }
      }

      // class name for typing purposes:
      static name = name;

      // readonly property name
      get name(): string {
        if (this.index) {
          return this.index.isObjectProperty() ? (this.index.getObjectProperty() as string) : '';
        } else {
          return (this.object as unknown as { name?: string }).name || '';
        }
      }

      get type(): string {
        return name;
      }
      get isAssignmentNode(): boolean {
        return true;
      }

      /**
       * Compile a node into a JavaScript function.
       * This basically pre-calculates as much as possible and only leaves open
       * calculations which depend on a dynamic scope with variables.
       * @param {Object} math     Math.js namespace with functions and constants.
       * @param {Object} argNames An object with argument names as key and `true`
       *                          as value. Used in the SymbolNode to optimize
       *                          for arguments from user assigned functions
       *                          (see FunctionAssignmentNode) or special symbols
       *                          like `end` (see IndexNode).
       * @return {function} Returns a function which can be called like:
       *                        evalNode(scope: Object, args: Object, context: *)
       */
      _compile(
        math: Record<string, unknown>,
        argNames: Record<string, boolean>
      ): (scope: Map<string, unknown>, args: Record<string, unknown>, context: unknown) => unknown {
        const evalObject = this.object._compile(math, argNames);
        const evalIndex = this.index ? this.index._compile(math, argNames) : null;
        const evalValue = this.value._compile(math, argNames);
        const name = (this.object as unknown as { name: string }).name;

        if (!this.index) {
          // apply a variable to the scope, for example `a=2`
          if (!isSymbolNode(this.object)) {
            throw new TypeError('SymbolNode expected as object');
          }

          return function evalAssignmentNode(
            scope: Map<string, unknown>,
            args: Record<string, unknown>,
            context: unknown
          ) {
            const value = evalValue(scope, args, context);
            scope.set(name, value);
            return value;
          };
        } else if (this.index.isObjectProperty()) {
          // apply an object property for example `a.b=2`
          const prop = this.index.getObjectProperty();

          return function evalAssignmentNode(
            scope: Map<string, unknown>,
            args: Record<string, unknown>,
            context: unknown
          ) {
            const object = evalObject(scope, args, context);
            const value = evalValue(scope, args, context);
            setSafeProperty(object, prop, value);
            return value;
          };
        } else if (isSymbolNode(this.object)) {
          // update a matrix subset, for example `a[2]=3`
          return function evalAssignmentNode(
            scope: Map<string, unknown>,
            args: Record<string, unknown>,
            context: unknown
          ) {
            const childObject = evalObject(scope, args, context);
            const value = evalValue(scope, args, context);
            // Important:  we pass childObject instead of context:
            const index = evalIndex!(scope, args, childObject) as RuntimeIndex;
            scope.set(name, assign(childObject, index, value));
            return value;
          };
        } else {
          // isAccessorNode(node.object) === true
          // update a matrix subset, for example `a.b[2]=3`

          // we will not use the compile function of the AccessorNode, but
          // compile it ourselves here as we need the parent object of the
          // AccessorNode:
          // wee need to apply the updated object to parent object
          const accessorObject = this.object as unknown as AccessorNodeChild;
          const evalParentObject = accessorObject.object._compile(math, argNames);

          if (accessorObject.index.isObjectProperty()) {
            const parentProp = accessorObject.index.getObjectProperty();

            return function evalAssignmentNode(
              scope: Map<string, unknown>,
              args: Record<string, unknown>,
              context: unknown
            ) {
              const parent = evalParentObject(scope, args, context);
              const childObject = getSafeProperty(parent, parentProp);
              // Important: we pass childObject instead of context:
              const index = evalIndex!(scope, args, childObject) as RuntimeIndex;
              const value = evalValue(scope, args, context);
              setSafeProperty(parent, parentProp, assign(childObject, index, value));
              return value;
            };
          } else {
            // if some parameters use the 'end' parameter, we need to calculate
            // the size
            const evalParentIndex = accessorObject.index._compile(math, argNames);

            return function evalAssignmentNode(
              scope: Map<string, unknown>,
              args: Record<string, unknown>,
              context: unknown
            ) {
              const parent = evalParentObject(scope, args, context);
              // Important: we pass parent instead of context:
              const parentIndex = evalParentIndex(scope, args, parent) as RuntimeIndex;
              const childObject = access(parent, parentIndex);
              // Important:  we pass childObject instead of context
              const index = evalIndex!(scope, args, childObject) as RuntimeIndex;
              const value = evalValue(scope, args, context);

              assign(parent, parentIndex, assign(childObject, index, value));

              return value;
            };
          }
        }
      }

      /**
       * Execute a callback for each of the child nodes of this node
       * @param {function(child: Node, path: string, parent: Node)} callback
       */
      forEach(callback: (child: MathNode, path: string, parent: MathNode) => void): void {
        callback(this.object, 'object', this);
        if (this.index) {
          callback(this.index, 'index', this);
        }
        callback(this.value, 'value', this);
      }

      /**
       * Create a new AssignmentNode whose children are the results of calling
       * the provided callback function for each child of the original node.
       * @param {function(child: Node, path: string, parent: Node): Node} callback
       * @returns {AssignmentNode} Returns a transformed copy of the node
       */
      map(callback: (child: MathNode, path: string, parent: MathNode) => MathNode): AssignmentNode {
        const object = this._ifNode(callback(this.object, 'object', this));
        const index = this.index ? this._ifNode(callback(this.index, 'index', this)) : null;
        const value = this._ifNode(callback(this.value, 'value', this));

        return new AssignmentNode(object, index, value);
      }

      /**
       * Create a clone of this node, a shallow copy
       * @return {AssignmentNode}
       */
      clone(): AssignmentNode {
        return new AssignmentNode(this.object, this.index, this.value);
      }

      /**
       * Get string representation
       * @param {Object} options
       * @return {string}
       */
      _toString(options?: StringOptions): string {
        const object = this.object.toString(options);
        const index = this.index ? this.index.toString(options) : '';
        let value = this.value.toString(options);
        if (needParenthesis(this, options && options.parenthesis, options && options.implicit)) {
          value = '(' + value + ')';
        }

        return object + index + ' = ' + value;
      }

      /**
       * Get a JSON representation of the node
       * @returns {Object}
       */
      toJSON(): {
        mathjs: string;
        object: MathNode;
        index: IndexNodeChild | null;
        value: MathNode;
      } {
        return {
          mathjs: name,
          object: this.object,
          index: this.index,
          value: this.value,
        };
      }

      /**
       * Instantiate an AssignmentNode from its JSON representation
       * @param {Object} json
       *     An object structured like
       *     `{"mathjs": "AssignmentNode", object: ..., index: ..., value: ...}`,
       *     where mathjs is optional
       * @returns {AssignmentNode}
       */
      static fromJSON(json: {
        object: MathNode;
        index: MathNode | null;
        value: MathNode;
      }): AssignmentNode {
        return new AssignmentNode(json.object, json.index, json.value);
      }

      /**
       * Get HTML representation
       * @param {Object} options
       * @return {string}
       */
      _toHTML(options?: StringOptions): string {
        const object = this.object.toHTML(options);
        const index = this.index ? this.index.toHTML(options) : '';
        let value = this.value.toHTML(options);
        if (needParenthesis(this, options && options.parenthesis, options && options.implicit)) {
          value =
            '<span class="math-paranthesis math-round-parenthesis">(</span>' +
            value +
            '<span class="math-paranthesis math-round-parenthesis">)</span>';
        }

        return (
          object +
          index +
          '<span class="math-operator math-assignment-operator ' +
          'math-variable-assignment-operator math-binary-operator">=</span>' +
          value
        );
      }

      /**
       * Get LaTeX representation
       * @param {Object} options
       * @return {string}
       */
      _toMathML(): string {
        const obj = this.object;
        // Simple `symbol = value` only; an indexed LHS (`a[2] = 3`) carries an
        // `index` we don't render, so fall back to text rather than drop it.
        if (obj && isSymbolNode(obj) && !this.index && this.value) {
          const name = (obj as unknown as { name: string }).name;
          return `<mrow>${toMathMLSymbol(name)}<mo>=</mo>${this.value.toMathML()}</mrow>`;
        }
        return `<mtext>${escapeMathML(this.toString())}</mtext>`;
      }

      _toTex(options?: StringOptions): string {
        const object = this.object.toTex(options);
        const index = this.index ? this.index.toTex(options) : '';
        let value = this.value.toTex(options);
        if (needParenthesis(this, options && options.parenthesis, options && options.implicit)) {
          value = `\\left(${value}\\right)`;
        }

        return object + index + '=' + value;
      }
    }

    return AssignmentNode;
  },
  { isClass: true, isNode: true }
);
