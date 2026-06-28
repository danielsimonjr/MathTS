import {
  isAccessorNode,
  isArrayNode,
  isConstantNode,
  isFunctionNode,
  isIndexNode,
  isObjectNode,
  isOperatorNode,
} from '../utils/is.js';
import { getOperator } from '../expression/operators.js';
import { createUtil } from './simplify/util.js';
import { factory } from '../utils/factory.js';
import type { MathNode } from '../utils/node.js';
import type { TypedFunction } from '../core/function/typed.js';

// Rich runtime node shapes. The is.ts guards only assert the discriminant flag,
// so accessing runtime fields (op, fn, value, items, ...) requires casting the
// guarded node to one of these.
interface OpNode extends MathNode {
  op: string;
  fn: string;
  args: MathNode[];
  implicit?: boolean;
  isUnary(): boolean;
  isBinary(): boolean;
}
interface FuncNode extends MathNode {
  name: string;
  fn: MathNode;
  args: MathNode[];
}
interface ConstNode extends MathNode {
  value: unknown;
}
interface ArrNode extends MathNode {
  items: MathNode[];
}
interface AccNode extends MathNode {
  object: MathNode;
  index: MathNode;
}
interface IdxNode extends MathNode {
  dimensions: MathNode[];
}
interface ObjNode extends MathNode {
  properties: Record<string, MathNode>;
}

type ScalarFn = (...args: unknown[]) => unknown;
type NodeCtor1 = new (a: MathNode) => MathNode;
type OperatorNodeCtor = new (op: string, fn: string, args: MathNode[], implicit?: boolean) => MathNode;
type FunctionNodeCtor = new (fn: MathNode | string, args: MathNode[]) => MathNode;
type ConstantNodeCtor = new (value: unknown) => MathNode;
type ArrayNodeCtor = new (items: MathNode[]) => MathNode;
type AccessorNodeCtor = new (object: MathNode, index: MathNode) => MathNode;
type IndexNodeCtor = new (dimensions: MathNode[]) => MathNode;
type ObjectNodeCtor = new (properties: Record<string, MathNode>) => MathNode;
type SymbolNodeCtor = new (name: string) => MathNode;

const name = 'simplifyCore';
const dependencies = [
  'typed',
  'parse',
  'equal',
  'isZero',
  'add',
  'subtract',
  'multiply',
  'divide',
  'pow',
  'AccessorNode',
  'ArrayNode',
  'ConstantNode',
  'FunctionNode',
  'IndexNode',
  'ObjectNode',
  'OperatorNode',
  'ParenthesisNode',
  'SymbolNode',
];

export const createSimplifyCore = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    parse: _parse,
    equal,
    isZero,
    add: _add,
    subtract: _subtract,
    multiply: _multiply,
    divide: _divide,
    pow: _pow,
    AccessorNode,
    ArrayNode,
    ConstantNode,
    FunctionNode,
    IndexNode,
    ObjectNode,
    OperatorNode,
    ParenthesisNode: _ParenthesisNode,
    SymbolNode,
  }: {
    typed: TypedFunction;
    parse: (expr: string) => MathNode;
    equal: (a: unknown, b: unknown) => boolean;
    isZero: (x: unknown) => boolean;
    add: ScalarFn;
    subtract: ScalarFn;
    multiply: ScalarFn;
    divide: ScalarFn;
    pow: ScalarFn;
    AccessorNode: AccessorNodeCtor;
    ArrayNode: ArrayNodeCtor;
    ConstantNode: ConstantNodeCtor;
    FunctionNode: FunctionNodeCtor;
    IndexNode: IndexNodeCtor;
    ObjectNode: ObjectNodeCtor;
    OperatorNode: OperatorNodeCtor;
    ParenthesisNode: NodeCtor1;
    SymbolNode: SymbolNodeCtor;
  }) => {
    const node0 = new ConstantNode(0);
    const node1 = new ConstantNode(1);
    const nodeT = new ConstantNode(true);
    const nodeF = new ConstantNode(false);
    // test if a node will always have a boolean value (true/false)
    // not sure if this list is complete
    function isAlwaysBoolean(node: MathNode): boolean {
      return isOperatorNode(node) && ['and', 'not', 'or'].includes((node as unknown as OpNode).op);
    }

    const { hasProperty, isCommutative } = createUtil({
      FunctionNode,
      OperatorNode,
      SymbolNode,
    });
    /**
     * simplifyCore() performs single pass simplification suitable for
     * applications requiring ultimate performance. To roughly summarize,
     * it handles cases along the lines of simplifyConstant() but where
     * knowledge of a single argument is sufficient to determine the value.
     * In contrast, simplify() extends simplifyCore() with additional passes
     * to provide deeper simplification (such as gathering like terms).
     *
     * Specifically, simplifyCore:
     *
     * * Converts all function calls with operator equivalents to their
     *   operator forms.
     * * Removes operators or function calls that are guaranteed to have no
     *   effect (such as unary '+').
     * * Removes double unary '-', '~', and 'not'
     * * Eliminates addition/subtraction of 0 and multiplication/division/powers
     *   by 1 or 0.
     * * Converts addition of a negation into subtraction.
     * * Eliminates logical operations with constant true or false leading
     *   arguments.
     * * Puts constants on the left of a product, if multiplication is
     *   considered commutative by the options (which is the default)
     *
     * Syntax:
     *
     *     math.simplifyCore(expr)
     *     math.simplifyCore(expr, options)
     *
     * Examples:
     *
     *     const f = math.parse('2 * 1 * x ^ (1 - 0)')
     *     math.simplifyCore(f)                          // Node "2 * x"
     *     math.simplify('2 * 1 * x ^ (1 - 0)', [math.simplifyCore]) // Node "2 * x"
     *
     * See also:
     *
     *     simplify, simplifyConstant, resolve, derivative
     *
     * @param {Node | string} node
     *     The expression to be simplified
     * @param {Object} options
     *     Simplification options, as per simplify()
     * @return {Node} Returns expression with basic simplifications applied
     */
    function _simplifyCore(
      nodeToSimplify: MathNode,
      options: { context?: Record<string, Record<string, boolean>> } = {}
    ): MathNode {
      const context = options ? options.context : undefined;
      if (hasProperty(nodeToSimplify, 'trivial', context)) {
        // This node does nothing if it has only one argument, so if so,
        // return that argument simplified
        if (isFunctionNode(nodeToSimplify) && (nodeToSimplify as unknown as FuncNode).args.length === 1) {
          return _simplifyCore((nodeToSimplify as unknown as FuncNode).args[0], options);
        }
        // For other node types, we try the generic methods
        let simpChild: MathNode | false = false;
        let childCount = 0;
        nodeToSimplify.forEach((c: MathNode) => {
          ++childCount;
          if (childCount === 1) {
            simpChild = _simplifyCore(c, options);
          }
        });
        if (childCount === 1 && simpChild !== false) {
          return simpChild;
        }
      }
      let node: MathNode = nodeToSimplify;
      if (isFunctionNode(node)) {
        const fnode = node as unknown as FuncNode;
        const op = getOperator(fnode.name);
        if (op) {
          // Replace FunctionNode with a new OperatorNode
          if (fnode.args.length > 2 && hasProperty(node, 'associative', context)) {
            // unflatten into binary operations since that's what simplifyCore handles
            while (fnode.args.length > 2) {
              const last = fnode.args.pop()!;
              const seclast = fnode.args.pop()!;
              fnode.args.push(new OperatorNode(op, fnode.name, [last, seclast]));
            }
          }
          node = new OperatorNode(op, fnode.name, fnode.args);
        } else {
          return new FunctionNode(
            _simplifyCore(fnode.fn),
            fnode.args.map((n: MathNode) => _simplifyCore(n, options))
          );
        }
      }
      if (isOperatorNode(node) && (node as unknown as OpNode).isUnary()) {
        const a0 = _simplifyCore((node as unknown as OpNode).args[0], options);

        if ((node as unknown as OpNode).op === '~') {
          // bitwise not
          if (isOperatorNode(a0) && (a0 as unknown as OpNode).isUnary() && (a0 as unknown as OpNode).op === '~') {
            return (a0 as unknown as OpNode).args[0];
          }
        }
        if ((node as unknown as OpNode).op === 'not') {
          // logical not
          if (isOperatorNode(a0) && (a0 as unknown as OpNode).isUnary() && (a0 as unknown as OpNode).op === 'not') {
            // Has the effect of turning the argument into a boolean
            // So can only eliminate the double negation if
            // the inside is already boolean
            if (isAlwaysBoolean((a0 as unknown as OpNode).args[0])) {
              return (a0 as unknown as OpNode).args[0];
            }
          }
        }
        let finish = true;
        if ((node as unknown as OpNode).op === '-') {
          // unary minus
          if (isOperatorNode(a0)) {
            if ((a0 as unknown as OpNode).isBinary() && (a0 as unknown as OpNode).fn === 'subtract') {
              node = new OperatorNode('-', 'subtract', [(a0 as unknown as OpNode).args[1], (a0 as unknown as OpNode).args[0]]);
              finish = false; // continue to process the new binary node
            }
            if ((a0 as unknown as OpNode).isUnary() && (a0 as unknown as OpNode).op === '-') {
              return (a0 as unknown as OpNode).args[0];
            }
          }
        }
        if (finish) return new OperatorNode((node as unknown as OpNode).op, (node as unknown as OpNode).fn, [a0]);
      }
      if (isOperatorNode(node) && (node as unknown as OpNode).isBinary()) {
        const a0 = _simplifyCore((node as unknown as OpNode).args[0], options);
        let a1 = _simplifyCore((node as unknown as OpNode).args[1], options);

        if ((node as unknown as OpNode).op === '+') {
          if (isConstantNode(a0) && isZero((a0 as unknown as ConstNode).value)) {
            return a1;
          }
          if (isConstantNode(a1) && isZero((a1 as unknown as ConstNode).value)) {
            return a0;
          }
          if (isOperatorNode(a1) && (a1 as unknown as OpNode).isUnary() && (a1 as unknown as OpNode).op === '-') {
            a1 = (a1 as unknown as OpNode).args[0];
            node = new OperatorNode('-', 'subtract', [a0, a1]);
          }
        }
        if ((node as unknown as OpNode).op === '-') {
          if (isOperatorNode(a1) && (a1 as unknown as OpNode).isUnary() && (a1 as unknown as OpNode).op === '-') {
            return _simplifyCore(new OperatorNode('+', 'add', [a0, (a1 as unknown as OpNode).args[0]]), options);
          }
          if (isConstantNode(a0) && isZero((a0 as unknown as ConstNode).value)) {
            return _simplifyCore(new OperatorNode('-', 'unaryMinus', [a1]));
          }
          if (isConstantNode(a1) && isZero((a1 as unknown as ConstNode).value)) {
            return a0;
          }
          return new OperatorNode((node as unknown as OpNode).op, (node as unknown as OpNode).fn, [a0, a1]);
        }
        if ((node as unknown as OpNode).op === '*') {
          if (isConstantNode(a0)) {
            if (isZero((a0 as unknown as ConstNode).value)) {
              return node0;
            } else if (equal((a0 as unknown as ConstNode).value, 1)) {
              return a1;
            }
          }
          if (isConstantNode(a1)) {
            if (isZero((a1 as unknown as ConstNode).value)) {
              return node0;
            } else if (equal((a1 as unknown as ConstNode).value, 1)) {
              return a0;
            }
            if (isCommutative(node, context)) {
              return new OperatorNode((node as unknown as OpNode).op, (node as unknown as OpNode).fn, [a1, a0], (node as unknown as OpNode).implicit); // constants on left
            }
          }
          return new OperatorNode((node as unknown as OpNode).op, (node as unknown as OpNode).fn, [a0, a1], (node as unknown as OpNode).implicit);
        }
        if ((node as unknown as OpNode).op === '/') {
          if (isConstantNode(a0) && isZero((a0 as unknown as ConstNode).value)) {
            return node0;
          }
          if (isConstantNode(a1) && equal((a1 as unknown as ConstNode).value, 1)) {
            return a0;
          }
          return new OperatorNode((node as unknown as OpNode).op, (node as unknown as OpNode).fn, [a0, a1]);
        }
        if ((node as unknown as OpNode).op === '^') {
          if (isConstantNode(a1)) {
            if (isZero((a1 as unknown as ConstNode).value)) {
              return node1;
            } else if (equal((a1 as unknown as ConstNode).value, 1)) {
              return a0;
            }
          }
        }
        if ((node as unknown as OpNode).op === 'and') {
          if (isConstantNode(a0)) {
            if ((a0 as unknown as ConstNode).value) {
              if (isAlwaysBoolean(a1)) return a1;
              if (isConstantNode(a1)) {
                return (a1 as unknown as ConstNode).value ? nodeT : nodeF;
              }
            } else {
              return nodeF;
            }
          }
          if (isConstantNode(a1)) {
            if ((a1 as unknown as ConstNode).value) {
              if (isAlwaysBoolean(a0)) return a0;
            } else {
              return nodeF;
            }
          }
        }
        if ((node as unknown as OpNode).op === 'or') {
          if (isConstantNode(a0)) {
            if ((a0 as unknown as ConstNode).value) {
              return nodeT;
            } else {
              if (isAlwaysBoolean(a1)) return a1;
            }
          }
          if (isConstantNode(a1)) {
            if ((a1 as unknown as ConstNode).value) {
              return nodeT;
            } else {
              if (isAlwaysBoolean(a0)) return a0;
            }
          }
        }
        return new OperatorNode((node as unknown as OpNode).op, (node as unknown as OpNode).fn, [a0, a1]);
      }
      if (isOperatorNode(node)) {
        return new OperatorNode(
          (node as unknown as OpNode).op,
          (node as unknown as OpNode).fn,
          (node as unknown as OpNode).args.map((a: MathNode) => _simplifyCore(a, options))
        );
      }
      if (isArrayNode(node)) {
        return new ArrayNode((node as unknown as ArrNode).items.map((n: MathNode) => _simplifyCore(n, options)));
      }
      if (isAccessorNode(node)) {
        return new AccessorNode(
          _simplifyCore((node as unknown as AccNode).object, options),
          _simplifyCore((node as unknown as AccNode).index, options)
        );
      }
      if (isIndexNode(node)) {
        return new IndexNode((node as unknown as IdxNode).dimensions.map((n: MathNode) => _simplifyCore(n, options)));
      }
      if (isObjectNode(node)) {
        const newProps: Record<string, MathNode> = {};
        for (const prop in (node as unknown as ObjNode).properties) {
          newProps[prop] = _simplifyCore((node as unknown as ObjNode).properties[prop], options);
        }
        return new ObjectNode(newProps);
      }
      // cannot simplify
      return node;
    }

    return typed(name, { Node: _simplifyCore, 'Node,Object': _simplifyCore });
  }
);
