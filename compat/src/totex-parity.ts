/**
 * Compat-only `toTex` adapters for #1577 (unit names) and #1578 (boolean spacing).
 * Native expression output is unchanged; these run only on compat instance parse.
 */

import {
  mathjsCompatRelationalParenthesisToTex,
  mathjsCompatToTexString,
} from './totex-boolean-spacing.js';
import { MATHJS_PARITY_NAMES } from './parity-names.generated.js';

const MATHJS_PARITY_NAME_SET = new Set<string>(MATHJS_PARITY_NAMES);

type ToTexOptions = Record<string, unknown>;

type MathNodeLike = {
  type?: string;
  name?: string;
  forEach: (callback: (node: MathNodeLike) => void) => void;
  _toTex: (options?: ToTexOptions) => string;
  toTex: (options?: ToTexOptions) => string;
};

type UnitLike = { isValuelessUnit: (name: string) => boolean };

function visitMathNode(node: MathNodeLike, visit: (node: MathNodeLike) => void): void {
  visit(node);
  node.forEach((child) => visitMathNode(child, visit));
}

/** mathjs suppresses unit TeX only when the name is also on the mathjs instance. */
function instanceNameBlocksUnitSymbol(name: string, math: Record<string, unknown>): boolean {
  if (typeof math[name] === 'undefined') return false;
  return MATHJS_PARITY_NAME_SET.has(name);
}

function symbolUnitToTex(name: string): string {
  if (name === 'deg') return ' ^\\circ';
  const symbol = `\\mathrm{${name}}`;
  return symbol[0] === '\\' ? symbol : ` ${symbol}`;
}

function patchSymbolNodesForMathjsToTex(
  node: MathNodeLike,
  math: Record<string, unknown>,
  Unit: UnitLike
): void {
  visitMathNode(node, (current) => {
    if (current.type !== 'SymbolNode' || typeof current.name !== 'string') return;
    const symbolName = current.name;
    const original = current._toTex.bind(current);
    Object.defineProperty(current, '_toTex', {
      value: (options?: ToTexOptions) => {
        const isUnit =
          Unit.isValuelessUnit(symbolName) && !instanceNameBlocksUnitSymbol(symbolName, math);
        if (!isUnit) return original(options);
        return symbolUnitToTex(symbolName);
      },
      enumerable: false,
      configurable: true,
    });
  });
}

function patchRelationalNodesForMathjsParenthesisQuirk(node: MathNodeLike): void {
  visitMathNode(node, (current) => {
    if (current.type !== 'RelationalNode') return;
    const original = current._toTex.bind(current);
    Object.defineProperty(current, '_toTex', {
      value: (options?: ToTexOptions) => {
        let tex = original(options);
        if (options?.parenthesis === 'all') tex = mathjsCompatRelationalParenthesisToTex(tex);
        return tex;
      },
      enumerable: false,
      configurable: true,
    });
  });
}

function patchBooleanOperatorToTex(node: MathNodeLike): void {
  if (typeof node.toTex !== 'function') return;
  const original = node.toTex.bind(node);
  Object.defineProperty(node, 'toTex', {
    value: (options?: ToTexOptions) => mathjsCompatToTexString(original(options)),
    enumerable: false,
    configurable: true,
  });
}

function patchOneParsedTree(
  node: MathNodeLike,
  mathScope: Record<string, unknown>,
  Unit: UnitLike
): void {
  patchSymbolNodesForMathjsToTex(node, mathScope, Unit);
  patchRelationalNodesForMathjsParenthesisQuirk(node);
  patchBooleanOperatorToTex(node);
}

/** Apply mathjs `parse` toTex patches to trees from `resolve` / symbolic algebra (#1790). */
export function patchParsedTreeForMathjsCompat(
  node: MathNodeLike,
  mathScope: Record<string, unknown>,
  Unit: UnitLike
): void {
  patchOneParsedTree(node, mathScope, Unit);
}

/**
 * Wrap a scoped parse function so its nodes match mathjs 15.3.0 `toTex`.
 */
export function patchParseForMathjsToTex<T extends MathNodeLike>(
  parseFn: (expr: string, options?: ToTexOptions) => T,
  mathScope: Record<string, unknown>,
  Unit: UnitLike
): typeof parseFn {
  const wrapped = (expr: string, options?: ToTexOptions) => {
    const node = options === undefined ? parseFn(expr) : parseFn(expr, options);
    if (Array.isArray(node)) {
      for (const entry of node) patchOneParsedTree(entry, mathScope, Unit);
    } else {
      patchOneParsedTree(node, mathScope, Unit);
    }
    return node;
  };
  return Object.assign(wrapped, parseFn) as typeof parseFn;
}
