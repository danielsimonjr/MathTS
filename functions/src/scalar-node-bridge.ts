/**
 * Convert between {@link ScalarNode} trees and wired expression {@link MathNode}s.
 *
 * @packageDocumentation
 */

import type {
  LoweredScalarFn,
  MathNode,
  ScalarNode,
  StringOptions,
} from '@danielsimonjr/mathts-expression';
import { ScalarBuildError } from '@danielsimonjr/mathts-expression';
import type { SimplifyOptions } from '../types/index.js';
import {
  isConstantNode,
  isFunctionNode,
  isOperatorNode,
  isParenthesisNode,
  isSymbolNode,
} from './utils/is.js';

export type { MathNode, StringOptions, SimplifyOptions };

const PREFIX = 'scalar bridge: ';

const LOWERED_CALL_NAMES = new Set([
  'exp',
  'log',
  'log10',
  'log2',
  'sin',
  'cos',
  'tan',
  'sinh',
  'cosh',
  'tanh',
  'abs',
]);

const OP_TO_FN: Record<string, string> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '^': 'pow',
};

/** FunctionNode names that are operator equivalents (`subtract(a,b,c)` is how n-ary `-` prints). */
const FN_TO_OP: Record<string, '+' | '-' | '*' | '/' | '^'> = {
  add: '+',
  subtract: '-',
  multiply: '*',
  divide: '/',
  pow: '^',
};

type ConstantCtor = new (value: number) => MathNode;
type SymbolCtor = new (name: string) => MathNode;
type OperatorCtor = new (
  op: string,
  fn: string,
  args: MathNode[],
  implicit?: boolean,
  isPercentage?: boolean
) => MathNode;
type FunctionCtor = new (fn: string, args: MathNode[]) => MathNode;

export interface ScalarNodeBridgeDeps {
  ConstantNode: ConstantCtor;
  SymbolNode: SymbolCtor;
  OperatorNode: OperatorCtor;
  FunctionNode: FunctionCtor;
  simplify: (node: MathNode, ...rest: unknown[]) => MathNode;
}

interface ConstantFields {
  value: unknown;
}

interface SymbolFields {
  name: string;
}

interface OperatorFields {
  op: string;
  fn: string;
  args: MathNode[];
}

interface ParenthesisFields {
  content: MathNode;
}

interface FunctionFields {
  fn: MathNode;
  args: MathNode[];
}

function nodeType(node: MathNode): string {
  return (node as { type?: string }).type ?? 'Node';
}

function scalarToNodeImpl(node: ScalarNode, deps: ScalarNodeBridgeDeps): MathNode {
  switch (node.kind) {
    case 'number':
      return new deps.ConstantNode(node.value);
    case 'symbol':
      return new deps.SymbolNode(node.name);
    case 'op': {
      const fn = OP_TO_FN[node.op];
      if (fn === undefined) {
        throw new ScalarBuildError(`${PREFIX}operator '${node.op}' is outside the scalar subset`);
      }
      if (node.op === '^' && node.args.length !== 2) {
        throw new ScalarBuildError(`${PREFIX}'^' needs exactly 2 args, got ${node.args.length}`);
      }
      const args = node.args.map((child) => scalarToNodeImpl(child, deps));
      return new deps.OperatorNode(node.op, fn, args, false);
    }
    case 'call': {
      if (!LOWERED_CALL_NAMES.has(node.fn)) {
        throw new ScalarBuildError(`${PREFIX}function '${node.fn}' is outside the scalar subset`);
      }
      const arg = scalarToNodeImpl(node.arg, deps);
      return new deps.FunctionNode(node.fn, [arg]);
    }
    default:
      throw new ScalarBuildError(
        `${PREFIX}unknown scalar kind '${String((node as { kind?: unknown }).kind)}'`
      );
  }
}

/**
 * Left-fold n-ary `-` and `/` into binary spines. `evaluateScalar` already
 * left-folds those operators; `simplify` only rewrites the binary form
 * (parse never emits n-ary subtract/divide). Feeding the n-ary node through
 * unchanged lets binary rules such as `n-n1 -> n+-n1` drop later minuses.
 */
function leftFoldNonAssoc(node: ScalarNode): ScalarNode {
  switch (node.kind) {
    case 'number':
    case 'symbol':
      return node;
    case 'call':
      return { kind: 'call', fn: node.fn, arg: leftFoldNonAssoc(node.arg) };
    case 'op': {
      const args = node.args.map(leftFoldNonAssoc);
      if ((node.op === '-' || node.op === '/') && args.length > 2) {
        let acc = args[0];
        for (let i = 1; i < args.length; i++) {
          acc = { kind: 'op', op: node.op, args: [acc, args[i]] };
        }
        return acc;
      }
      return { kind: 'op', op: node.op, args };
    }
  }
}

function nodeToScalarImpl(node: MathNode): ScalarNode {
  if (isParenthesisNode(node)) {
    const { content } = node as unknown as ParenthesisFields;
    return nodeToScalarImpl(content);
  }
  if (isConstantNode(node)) {
    const { value } = node as unknown as ConstantFields;
    if (typeof value !== 'number') {
      if (typeof value === 'string') {
        throw new ScalarBuildError(`${PREFIX}constant is a string, not a number`);
      }
      throw new ScalarBuildError(
        `${PREFIX}constant value type '${typeof value}' is outside the scalar subset`
      );
    }
    return { kind: 'number', value };
  }
  if (isSymbolNode(node)) {
    const { name } = node as unknown as SymbolFields;
    return { kind: 'symbol', name };
  }
  if (isFunctionNode(node)) {
    const fnNode = node as unknown as FunctionFields;
    if (!isSymbolNode(fnNode.fn)) {
      throw new ScalarBuildError(
        `${PREFIX}function callee is not a symbol (node type '${nodeType(fnNode.fn)}')`
      );
    }
    const fnName = (fnNode.fn as unknown as SymbolFields).name;
    if (fnName === 'unaryMinus') {
      if (fnNode.args.length !== 1) {
        throw new ScalarBuildError(
          `${PREFIX}unaryMinus needs exactly 1 arg, got ${fnNode.args.length}`
        );
      }
      return {
        kind: 'op',
        op: '*',
        args: [{ kind: 'number', value: -1 }, nodeToScalarImpl(fnNode.args[0])],
      };
    }
    if (fnName === 'unaryPlus') {
      if (fnNode.args.length !== 1) {
        throw new ScalarBuildError(
          `${PREFIX}unaryPlus needs exactly 1 arg, got ${fnNode.args.length}`
        );
      }
      return nodeToScalarImpl(fnNode.args[0]);
    }
    const asOp = FN_TO_OP[fnName];
    if (asOp !== undefined) {
      if (asOp === '^' && fnNode.args.length !== 2) {
        throw new ScalarBuildError(`${PREFIX}'^' needs exactly 2 args, got ${fnNode.args.length}`);
      }
      return { kind: 'op', op: asOp, args: fnNode.args.map((child) => nodeToScalarImpl(child)) };
    }
    if (fnName === 'ln' || LOWERED_CALL_NAMES.has(fnName)) {
      if (fnNode.args.length !== 1) {
        throw new ScalarBuildError(
          `${PREFIX}function '${fnName}' needs exactly 1 arg, got ${fnNode.args.length}`
        );
      }
      const stored = fnName === 'ln' ? 'log' : fnName;
      return {
        kind: 'call',
        fn: stored as LoweredScalarFn,
        arg: nodeToScalarImpl(fnNode.args[0]),
      };
    }
    throw new ScalarBuildError(`${PREFIX}function '${fnName}' is outside the scalar subset`);
  }
  if (isOperatorNode(node)) {
    const { fn, op, args } = node as unknown as OperatorFields;
    const converted = args.map((child) => nodeToScalarImpl(child));
    switch (fn) {
      case 'unaryMinus':
        if (converted.length !== 1) {
          throw new ScalarBuildError(
            `${PREFIX}unaryMinus needs exactly 1 arg, got ${converted.length}`
          );
        }
        return {
          kind: 'op',
          op: '*',
          args: [{ kind: 'number', value: -1 }, converted[0]],
        };
      case 'unaryPlus':
        if (converted.length !== 1) {
          throw new ScalarBuildError(
            `${PREFIX}unaryPlus needs exactly 1 arg, got ${converted.length}`
          );
        }
        return converted[0];
      case 'add':
        return { kind: 'op', op: '+', args: converted };
      case 'subtract':
        return { kind: 'op', op: '-', args: converted };
      case 'multiply':
        return { kind: 'op', op: '*', args: converted };
      case 'divide':
        return { kind: 'op', op: '/', args: converted };
      case 'pow':
        if (converted.length !== 2) {
          throw new ScalarBuildError(`${PREFIX}'^' needs exactly 2 args, got ${converted.length}`);
        }
        return { kind: 'op', op: '^', args: converted };
      default:
        throw new ScalarBuildError(`${PREFIX}operator '${op}' is outside the scalar subset`);
    }
  }
  throw new ScalarBuildError(`${PREFIX}node type '${nodeType(node)}' is outside the scalar subset`);
}

/**
 * Wire {@link scalarToNode}, {@link nodeToScalar}, {@link simplifyScalar}, and
 * {@link scalarToTex} to the expression node classes and `simplify` from the factory graph.
 */
export function createScalarNodeBridge(deps: ScalarNodeBridgeDeps) {
  /**
   * Build an expression {@link MathNode} from a scalar tree.
   *
   * @param node - A well-formed {@link ScalarNode} (use `scalar.from` for transcendental arms).
   * @returns The wired `ConstantNode`, `SymbolNode`, `OperatorNode`, or `FunctionNode`.
   * @throws {@link ScalarBuildError} when the tree is not a well-formed scalar node.
   *
   * @example
   * ```ts
   * import { scalar, scalarToNode } from '@danielsimonjr/mathts-functions';
   * const n = scalar.op('/', [scalar.symbol('a'), scalar.symbol('b')]);
   * scalarToNode(n).toString(); // 'a / b'
   * ```
   */
  function scalarToNode(node: ScalarNode): MathNode {
    return scalarToNodeImpl(node, deps);
  }

  /**
   * Convert an expression node to the scalar subset.
   *
   * @param node - An expression {@link MathNode}.
   * @returns A {@link ScalarNode} with the same structure (unary minus as `(-1)*x`).
   * @throws {@link ScalarBuildError} when `node` is outside the scalar subset.
   *
   * @example
   * ```ts
   * import { nodeToScalar, scalarToNode, scalar } from '@danielsimonjr/mathts-functions';
   * nodeToScalar(scalarToNode(scalar.op('+', [scalar.symbol('x'), scalar.number(1)])));
   * ```
   */
  function nodeToScalar(node: MathNode): ScalarNode {
    return nodeToScalarImpl(node);
  }

  /**
   * Symbolically simplify a scalar tree via the wired `simplify` (no string round trip).
   *
   * @param node - Input {@link ScalarNode}.
   * @param options - Optional {@link SimplifyOptions} (passed as the third argument to `simplify`).
   * @returns A simplified {@link ScalarNode}.
   * @throws {@link ScalarBuildError} when simplification leaves the scalar subset.
   *
   * @example
   * ```ts
   * import { scalar, simplifyScalar } from '@danielsimonjr/mathts-functions';
   * const a = scalar.symbol('a');
   * const b = scalar.symbol('b');
   * const c = scalar.symbol('c');
   * const t = scalar.op('/', [a, scalar.op('/', [b, c])]);
   * simplifyScalar(t); // multiply(a,c) / b
   * ```
   */
  function simplifyScalar(node: ScalarNode, options?: SimplifyOptions): ScalarNode {
    const mathNode = scalarToNode(leftFoldNonAssoc(node));
    let simplified: MathNode;
    try {
      simplified = (
        options === undefined
          ? deps.simplify(mathNode)
          : deps.simplify(mathNode, new Map(), options)
      ) as MathNode;
    } catch (err) {
      if (err instanceof ScalarBuildError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new ScalarBuildError(`${PREFIX}simplify failed: ${message}`);
    }
    return nodeToScalarImpl(simplified);
  }

  /**
   * LaTeX for a scalar tree via {@link MathNode.toTex}.
   *
   * @param node - {@link ScalarNode} to print.
   * @param options - Optional {@link StringOptions} passed to `toTex`.
   * @returns LaTeX string (same as `scalarToNode(node).toTex(options)`).
   *
   * @example
   * ```ts
   * import { scalar, scalarToTex } from '@danielsimonjr/mathts-functions';
   * scalarToTex(scalar.op('/', [scalar.symbol('a'), scalar.symbol('b')]));
   * // '\\frac{ a}{ b}'
   * ```
   */
  function scalarToTex(node: ScalarNode, options?: StringOptions): string {
    const mathNode = scalarToNode(node);
    return mathNode.toTex(options);
  }

  return { scalarToNode, nodeToScalar, simplifyScalar, scalarToTex };
}
