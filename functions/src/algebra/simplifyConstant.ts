import {
  isFraction,
  isMatrix,
  isNode,
  isArrayNode,
  isConstantNode,
  isIndexNode,
  isObjectNode,
  isOperatorNode,
} from '../utils/is.js';
import { factory } from '../utils/factory.js';
import { safeNumberType } from '../utils/number.js';
import { createUtil } from './simplify/util.js';
import { noBignumber, noFraction } from '../utils/noop.js';
import type { MathNode, ConstantNode, ArrayNode, OperatorNode } from '../utils/node.js';
import type { TypedFunction } from '../core/function/typed.js';

/** A Fraction-like runtime value (fraction.js) */
interface FractionLike {
  n: bigint;
  d: bigint;
  s: number;
  valueOf(): number;
}
/** Simplification options */
type Options = {
  context?: Record<string, Record<string, boolean>>;
  exactFractions?: boolean;
  fractionsLimit?: number;
};
/** Builds a binary OperatorNode/FunctionNode from child nodes */
type MakeNode = (args: MathNode[]) => MathNode;
/** A math function in the transform set (callable with an optional rawArgs flag) */
type TransformFn = ((...args: unknown[]) => unknown) & { rawArgs?: boolean };

/** Minimal runtime shapes for node fields not exposed by the is.ts guard types */
interface ConstNode extends MathNode {
  value: unknown;
}
interface ArrNode extends MathNode {
  items: MathNode[];
}
interface IdxNode extends MathNode {
  dimensions: MathNode[];
}
interface ObjNode extends MathNode {
  properties: Record<string, MathNode>;
}
interface OpNodeLike extends MathNode {
  op: string;
  fn: string;
  args: MathNode[];
  isUnary(): boolean;
}
interface FuncNodeLike extends MathNode {
  name: string;
  args: MathNode[];
}
interface ParenNodeLike extends MathNode {
  content: MathNode;
}
interface AccNodeLike extends MathNode {
  object: MathNode;
  index: MathNode;
}

type OperatorNodeCtor = new (op: string, fn: string, args: MathNode[]) => OperatorNode;
type FunctionNodeCtor = new (name: string, args: MathNode[]) => MathNode;
type ConstantNodeCtor = new (value?: unknown) => ConstantNode;
type ArrayNodeCtor = new (items: MathNode[]) => ArrayNode;
type AccessorNodeCtor = new (object: MathNode, index: MathNode) => MathNode;
type IndexNodeCtor = new (dimensions: MathNode[]) => MathNode;
type ObjectNodeCtor = new (properties: Record<string, MathNode>) => MathNode;
type SymbolNodeCtor = new (name: string) => MathNode;

const name = 'simplifyConstant';
const dependencies = [
  'typed',
  'config',
  'mathWithTransform',
  'matrix',
  'parse',
  'isBounded',
  '?fraction',
  '?bignumber',
  'AccessorNode',
  'ArrayNode',
  'ConstantNode',
  'FunctionNode',
  'IndexNode',
  'ObjectNode',
  'OperatorNode',
  'SymbolNode',
];

export const createSimplifyConstant = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    config,
    mathWithTransform,
    matrix,
    parse,
    isBounded,
    fraction,
    bignumber,
    AccessorNode,
    ArrayNode,
    ConstantNode,
    FunctionNode,
    IndexNode,
    ObjectNode,
    OperatorNode,
    SymbolNode,
  }: {
    typed: TypedFunction;
    config: { number?: string };
    mathWithTransform: Record<string, TransformFn>;
    matrix: (data: unknown) => unknown;
    parse: (expr: string) => MathNode;
    isBounded: (n: unknown) => boolean;
    fraction?: (n: unknown) => FractionLike;
    bignumber?: (v: unknown) => unknown;
    AccessorNode: AccessorNodeCtor;
    ArrayNode: ArrayNodeCtor;
    ConstantNode: ConstantNodeCtor;
    FunctionNode: FunctionNodeCtor;
    IndexNode: IndexNodeCtor;
    ObjectNode: ObjectNodeCtor;
    OperatorNode: OperatorNodeCtor;
    SymbolNode: SymbolNodeCtor;
  }) => {
    const { isCommutative, isAssociative, allChildren, createMakeNodeFunction } = createUtil({
      FunctionNode,
      OperatorNode,
      SymbolNode,
    });

    /**
     * simplifyConstant() takes a mathjs expression (either a Node representing
     * a parse tree or a string which it parses to produce a node), and replaces
     * any subexpression of it consisting entirely of constants with the computed
     * value of that subexpression.
     *
     * Syntax:
     *
     *     math.simplifyConstant(expr)
     *     math.simplifyConstant(expr, options)
     *
     * Examples:
     *
     *     math.simplifyConstant('x + 4*3/6')  // Node "x + 2"
     *     math.simplifyConstant('z cos(0)')   // Node "z 1"
     *     math.simplifyConstant('(5.2 + 1.08)t', {exactFractions: false})  // Node "6.28 t"
     *
     * See also:
     *
     *     simplify, simplifyCore, resolve, derivative
     *
     * @param {Node | string} node
     *     The expression to be simplified
     * @param {Object} options
     *     Simplification options, as per simplify()
     * @return {Node} Returns expression with constant subexpressions evaluated
     */
    const simplifyConstant = typed('simplifyConstant', {
      string: (expr: string) => _ensureNode(foldFraction(parse(expr), {})),

      'string, Object': function (expr: string, options: Options) {
        return _ensureNode(foldFraction(parse(expr), options));
      },

      Node: (node: MathNode) => _ensureNode(foldFraction(node, {})),

      'Node, Object': function (expr: MathNode, options: Options) {
        return _ensureNode(foldFraction(expr, options));
      },
    }) as unknown as (expr: unknown, options?: Options) => MathNode;

    function _removeFractions(thing: unknown): unknown {
      if (isFraction(thing)) {
        return thing.valueOf();
      }
      if (thing instanceof Array) {
        return thing.map(_removeFractions);
      }
      if (isMatrix(thing)) {
        return matrix(_removeFractions(thing.valueOf()));
      }
      return thing;
    }

    function _eval(fnname: string, args: unknown[], options: Options): unknown {
      try {
        return mathWithTransform[fnname].apply(null, args);
      } catch {
        // sometimes the implicit type conversion causes the evaluation to fail, so we'll try again after removing Fractions
        args = args.map(_removeFractions);
        return _toNumber(mathWithTransform[fnname].apply(null, args), options);
      }
    }

    const _toNode = typed({
      Fraction: _fractionToNode,
      number: function (n: number): MathNode {
        if (n < 0) {
          return unaryMinusNode(new ConstantNode(-n));
        }
        return new ConstantNode(n);
      },
      BigNumber: function (n: number): MathNode {
        if (n < 0) {
          return unaryMinusNode(new ConstantNode(-n));
        }
        return new ConstantNode(n); // old parameters: (n.toString(), 'number')
      },
      bigint: function (n: bigint): MathNode {
        if (n < 0n) {
          return unaryMinusNode(new ConstantNode(-n));
        }
        return new ConstantNode(n);
      },
      Complex: function (_s: unknown): never {
        throw new Error('Cannot convert Complex number to Node');
      },
      string: function (s: string): ConstantNode {
        return new ConstantNode(s);
      },
      Matrix: function (m: { valueOf(): unknown[] }): ArrayNode {
        return new ArrayNode(m.valueOf().map((e: unknown) => _toNode(e)));
      },
    }) as unknown as (value: unknown) => MathNode;

    function _ensureNode(thing: unknown): MathNode {
      if (isNode(thing)) {
        return thing as unknown as MathNode;
      }
      return _toNode(thing);
    }

    // convert a number to a fraction only if it can be expressed exactly,
    // and when both numerator and denominator are small enough
    function _exactFraction(n: unknown, options: Options): unknown {
      const exactFractions = options && options.exactFractions !== false;
      if (exactFractions && isBounded(n) && fraction) {
        const f = fraction(n);
        const fractionsLimit =
          options && typeof options.fractionsLimit === 'number' ? options.fractionsLimit : Infinity; // no limit by default

        if (f.valueOf() === n && f.n < fractionsLimit && f.d < fractionsLimit) {
          return f;
        }
      }
      return n;
    }

    // Convert numbers to a preferred number type in preference order: Fraction, number, Complex
    // BigNumbers are left alone
    const _toNumber = typed({
      'string, Object': function (s: string, options: Options): unknown {
        const numericType = safeNumberType(s, config as Parameters<typeof safeNumberType>[1]);

        if (numericType === 'BigNumber') {
          if (bignumber === undefined) {
            noBignumber();
          }
          return bignumber(s);
        } else if (numericType === 'bigint') {
          return BigInt(s);
        } else if (numericType === 'Fraction') {
          if (fraction === undefined) {
            noFraction();
          }
          return fraction(s);
        } else {
          const n = parseFloat(s);
          return _exactFraction(n, options);
        }
      },

      'Fraction, Object': function (s: FractionLike, _options: Options): unknown {
        return s;
      }, // we don't need options here

      'BigNumber, Object': function (s: unknown, _options: Options): unknown {
        return s;
      }, // we don't need options here

      'number, Object': function (s: number, options: Options): unknown {
        return _exactFraction(s, options);
      },

      'bigint, Object': function (s: bigint, _options: Options): bigint {
        return s;
      },

      'Complex, Object': function (s: { re: number; im: number }, options: Options): unknown {
        if (s.im !== 0) {
          return s;
        }
        return _exactFraction(s.re, options);
      },

      'Matrix, Object': function (s: { valueOf(): unknown }, options: Options): unknown {
        return matrix(_exactFraction(s.valueOf(), options));
      },

      'Array, Object': function (s: unknown[], options: Options): unknown {
        return s.map((item) => _exactFraction(item, options));
      },
    }) as unknown as (value: unknown, options: Options) => unknown;

    function unaryMinusNode(n: MathNode): OperatorNode {
      return new OperatorNode('-', 'unaryMinus', [n]);
    }

    function _fractionToNode(f: FractionLike): MathNode {
      // note: we convert away from bigint values, because bigint values gives issues with divisions: 1n/2n=0n and not 0.5
      const fromBigInt = (value: bigint): unknown =>
        config.number === 'BigNumber' && bignumber ? bignumber(value) : Number(value);

      // Convert sign to BigInt to avoid "Cannot mix BigInt and other types" error
      const signBigInt = BigInt(f.s);
      const numeratorValue = signBigInt * f.n;
      const numeratorNode =
        numeratorValue < 0n
          ? new OperatorNode('-', 'unaryMinus', [new ConstantNode(fromBigInt(-numeratorValue))])
          : new ConstantNode(fromBigInt(numeratorValue));

      return f.d === 1n
        ? numeratorNode
        : new OperatorNode('/', 'divide', [numeratorNode, new ConstantNode(fromBigInt(f.d))]);
    }

    /* Handles constant indexing of ArrayNodes, matrices, and ObjectNodes */
    function _foldAccessor(obj: unknown, index: unknown, options: Options): MathNode {
      if (!isIndexNode(index)) {
        // don't know what to do with that...
        return new AccessorNode(_ensureNode(obj), _ensureNode(index));
      }
      if (isArrayNode(obj) || isMatrix(obj)) {
        const remainingDims = Array.from((index as unknown as IdxNode).dimensions);
        /* We will resolve constant indices one at a time, looking
         * just in the first or second dimensions because (a) arrays
         * of more than two dimensions are likely rare, and (b) pulling
         * out the third or higher dimension would be pretty intricate.
         * The price is that we miss simplifying [..3d array][x,y,1]
         */
        while (remainingDims.length > 0) {
          if (isConstantNode(remainingDims[0]) && typeof (remainingDims[0] as unknown as ConstNode).value !== 'string') {
            const first = _toNumber((remainingDims.shift()! as unknown as ConstNode).value, options) as number;
            if (isArrayNode(obj)) {
              obj = (obj as unknown as ArrNode).items[first - 1];
            } else {
              // matrix
              obj = (obj as { valueOf(): unknown[] }).valueOf()[first - 1];
              if (obj instanceof Array) {
                obj = matrix(obj);
              }
            }
          } else if (
            remainingDims.length > 1 &&
            isConstantNode(remainingDims[1]) &&
            typeof (remainingDims[1] as unknown as ConstNode).value !== 'string'
          ) {
            const second = _toNumber((remainingDims[1] as unknown as ConstNode).value, options) as number;
            const tryItems: MathNode[] = [];
            const fromItems = isArrayNode(obj) ? (obj as unknown as ArrNode).items : (obj as { valueOf(): unknown[] }).valueOf();
            for (const item of fromItems) {
              if (isArrayNode(item)) {
                tryItems.push((item as unknown as ArrNode).items[second - 1]);
              } else if (isMatrix(obj)) {
                tryItems.push((item as unknown[])[second - 1] as MathNode);
              } else {
                break;
              }
            }
            if (tryItems.length === fromItems.length) {
              if (isArrayNode(obj)) {
                obj = new ArrayNode(tryItems);
              } else {
                // matrix
                obj = matrix(tryItems);
              }
              remainingDims.splice(1, 1);
            } else {
              // extracting slice along 2nd dimension failed, give up
              break;
            }
          } else {
            // neither 1st or 2nd dimension is constant, give up
            break;
          }
        }
        if (remainingDims.length === (index as unknown as IdxNode).dimensions.length) {
          /* No successful constant indexing */
          return new AccessorNode(_ensureNode(obj), index as unknown as MathNode);
        }
        if (remainingDims.length > 0) {
          /* Indexed some but not all dimensions */
          index = new IndexNode(remainingDims);
          return new AccessorNode(_ensureNode(obj), index as unknown as MathNode);
        }
        /* All dimensions were constant, access completely resolved */
        return obj as MathNode;
      }
      if (
        isObjectNode(obj) &&
        (index as unknown as IdxNode).dimensions.length === 1 &&
        isConstantNode((index as unknown as IdxNode).dimensions[0])
      ) {
        const key = ((index as unknown as IdxNode).dimensions[0] as unknown as ConstNode).value as string;
        if (key in (obj as unknown as ObjNode).properties) {
          return (obj as unknown as ObjNode).properties[key];
        }
        return new ConstantNode(); // undefined
      }
      /* Don't know how to index this sort of obj, at least not with this index */
      return new AccessorNode(_ensureNode(obj), index as unknown as MathNode);
    }

    /*
     * Create a binary tree from a list of Fractions and Nodes.
     * Tries to fold Fractions by evaluating them until the first Node in the list is hit, so
     * `args` should be sorted to have the Fractions at the start (if the operator is commutative).
     * @param args - list of Fractions and Nodes
     * @param fn - evaluator for the binary operation evaluator that accepts two Fractions
     * @param makeNode - creates a binary OperatorNode/FunctionNode from a list of child Nodes
     * if args.length is 1, returns args[0]
     * @return - Either a Node representing a binary expression or Fraction
     */
    function foldOp(fn: string, args: unknown[], makeNode: MakeNode, options: Options): unknown {
      const first = args.shift();

      // In the following reduction, sofar always has one of the three following
      // forms: [NODE], [CONSTANT], or [NODE, CONSTANT]
      const reduction = args.reduce(
        (sofar: unknown[], next: unknown) => {
          if (!isNode(next)) {
            const last = sofar.pop();

            if (isNode(last)) {
              return [last, next];
            }
            // Two constants in a row, try to fold them into one
            try {
              sofar.push(_eval(fn, [last, next], options));
              return sofar;
            } catch {
              sofar.push(last);
              // fall through to Node case
            }
          }

          // Encountered a Node, or failed folding --
          // collapse everything so far into a single tree:
          sofar.push(_ensureNode(sofar.pop()));
          const newtree = sofar.length === 1 ? (sofar[0] as MathNode) : makeNode(sofar as MathNode[]);
          return [makeNode([newtree, _ensureNode(next)])];
        },
        [first]
      );

      if (reduction.length === 1) {
        return reduction[0];
      }
      // Might end up with a tree and a constant at the end:
      return makeNode([reduction[0] as MathNode, _toNode(reduction[1])]);
    }

    // destroys the original node and returns a folded one
    function foldFraction(node: MathNode, options: Options): unknown {
      switch (node.type) {
        case 'SymbolNode':
          return node;
        case 'ConstantNode':
          switch (typeof (node as unknown as ConstNode).value) {
            case 'number':
              return _toNumber((node as unknown as ConstNode).value, options);
            case 'bigint':
              return _toNumber((node as unknown as ConstNode).value, options);
            case 'string':
              return (node as unknown as ConstNode).value;
            default:
              if (!isNaN((node as unknown as ConstNode).value))
                return _toNumber((node as unknown as ConstNode).value, options);
          }
          return node;
        case 'FunctionNode':
          if (
            mathWithTransform[(node as unknown as FuncNodeLike).name] &&
            mathWithTransform[(node as unknown as FuncNodeLike).name].rawArgs
          ) {
            return node;
          }
          {
            // Process operators as OperatorNode
            const operatorFunctions = ['add', 'multiply'];
            if (!operatorFunctions.includes((node as unknown as FuncNodeLike).name)) {
              const args = (node as unknown as FuncNodeLike).args.map((arg: MathNode) =>
                foldFraction(arg, options)
              );

              // If all args are numbers
              if (!args.some(isNode)) {
                try {
                  return _eval((node as unknown as FuncNodeLike).name, args, options);
                } catch {
                  // evaluation failed; fall back to building a symbolic node below
                }
              }

              // Size of a matrix does not depend on entries
              if (
                (node as unknown as FuncNodeLike).name === 'size' &&
                args.length === 1 &&
                isArrayNode(args[0])
              ) {
                const sz: number[] = [];
                let section: MathNode = args[0] as unknown as MathNode;
                while (isArrayNode(section)) {
                  sz.push((section as unknown as ArrNode).items.length);
                  section = (section as unknown as ArrNode).items[0];
                }
                return matrix(sz);
              }

              // Convert all args to nodes and construct a symbolic function call
              return new FunctionNode((node as unknown as FuncNodeLike).name, args.map(_ensureNode));
            }
            // operator function (add/multiply): fold like an OperatorNode
            return _foldOperatorNode(node, options);
          }
        case 'OperatorNode':
          return _foldOperatorNode(node, options);
        case 'ParenthesisNode':
          // remove the uneccessary parenthesis
          return foldFraction((node as unknown as ParenNodeLike).content, options);
        case 'AccessorNode':
          return _foldAccessor(
            foldFraction((node as unknown as AccNodeLike).object, options),
            foldFraction((node as unknown as AccNodeLike).index, options),
            options
          );
        case 'ArrayNode': {
          const foldItems = (node as unknown as ArrNode).items.map((item: MathNode) =>
            foldFraction(item, options)
          );
          if (foldItems.some(isNode)) {
            return new ArrayNode(foldItems.map(_ensureNode));
          }
          /* All literals -- return a Matrix so we can operate on it */
          return matrix(foldItems);
        }
        case 'IndexNode': {
          return new IndexNode(
            (node as unknown as IdxNode).dimensions.map((n: MathNode) => simplifyConstant(n, options))
          );
        }
        case 'ObjectNode': {
          const foldProps: Record<string, MathNode> = {};
          for (const prop in (node as unknown as ObjNode).properties) {
            foldProps[prop] = simplifyConstant((node as unknown as ObjNode).properties[prop], options);
          }
          return new ObjectNode(foldProps);
        }
        case 'AssignmentNode':
        /* falls through */
        case 'BlockNode':
        /* falls through */
        case 'FunctionAssignmentNode':
        /* falls through */
        case 'RangeNode':
        /* falls through */
        case 'ConditionalNode':
        /* falls through */
        default:
          throw new Error(`Unimplemented node type in simplifyConstant: ${node.type}`);
      }
    }

    // Fold an OperatorNode (or an add/multiply FunctionNode treated as an operator)
    function _foldOperatorNode(node: MathNode, options: Options): unknown {
      const fn = (node as unknown as OpNodeLike).fn.toString();
      let args: unknown[];
      let res: unknown;
      const makeNode = createMakeNodeFunction(
        node as unknown as Parameters<typeof createMakeNodeFunction>[0]
      );
      if (isOperatorNode(node) && (node as unknown as OpNodeLike).isUnary()) {
        args = [foldFraction((node as unknown as OpNodeLike).args[0], options)];
        if (!isNode(args[0])) {
          res = _eval(fn, args, options);
        } else {
          res = makeNode(args as MathNode[]);
        }
      } else if (isAssociative(node, options.context)) {
        args = allChildren(
          node as MathNode & { args?: MathNode[]; op?: string },
          options.context as Record<string, Record<string, boolean>>
        );
        args = args.map((arg) => foldFraction(arg as MathNode, options));

        if (isCommutative(fn, options.context)) {
          // commutative binary operator
          const consts: unknown[] = [];
          const vars: unknown[] = [];

          for (let i = 0; i < args.length; i++) {
            if (!isNode(args[i])) {
              consts.push(args[i]);
            } else {
              vars.push(args[i]);
            }
          }

          if (consts.length > 1) {
            res = foldOp(fn, consts, makeNode, options);
            vars.unshift(res);
            res = foldOp(fn, vars, makeNode, options);
          } else {
            // we won't change the children order since it's not neccessary
            res = foldOp(fn, args, makeNode, options);
          }
        } else {
          // non-commutative binary operator
          res = foldOp(fn, args, makeNode, options);
        }
      } else {
        // non-associative binary operator
        args = (node as unknown as OpNodeLike).args.map((arg: MathNode) => foldFraction(arg, options));
        res = foldOp(fn, args, makeNode, options);
      }
      return res;
    }

    return simplifyConstant;
  }
);
