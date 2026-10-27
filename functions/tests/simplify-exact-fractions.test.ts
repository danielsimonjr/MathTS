import { describe, it, expect } from 'vitest';
import { simplify } from '../src/index.js';

type NodeLike = {
  type?: string;
  mathjs?: string;
  fn?: string;
  value?: unknown;
  args?: NodeLike[];
  content?: NodeLike;
  items?: NodeLike[];
  object?: NodeLike;
  index?: NodeLike;
};

function isOperator(node: NodeLike, fn: string): boolean {
  return node.fn === fn && (node.type === 'OperatorNode' || node.mathjs === 'OperatorNode');
}

function isConstant(node: NodeLike, value: unknown): boolean {
  return (node.type === 'ConstantNode' || node.mathjs === 'ConstantNode') && node.value === value;
}

function isSymbol(node: NodeLike): boolean {
  return node.type === 'SymbolNode' || node.mathjs === 'SymbolNode';
}

function walkNodes(root: unknown, visit: (node: NodeLike) => void): void {
  if (!root || typeof root !== 'object') return;
  const node = root as NodeLike;
  visit(node);
  if (node.args) node.args.forEach((c) => walkNodes(c, visit));
  if (node.items) node.items.forEach((c) => walkNodes(c, visit));
  if (node.content) walkNodes(node.content, visit);
  if (node.object) walkNodes(node.object, visit);
  if (node.index) walkNodes(node.index, visit);
}

/** Signed constant, including unaryMinus wrapping a positive ConstantNode. */
function constantValue(node: NodeLike): number | undefined {
  if (typeof node.value === 'number' && isConstant(node, node.value)) return node.value;
  if (isOperator(node, 'unaryMinus') && node.args?.length === 1) {
    const inner = constantValue(node.args[0]);
    return inner === undefined ? undefined : -inner;
  }
  return undefined;
}

/**
 * True when the tree contains a divide whose denominator is `den` and whose
 * numerator is the integer `num` (possibly after `x * num`, and with `1 * x`
 * absorbed to a bare symbol).
 */
function hasDivideFraction(root: unknown, num: number, den: number): boolean {
  let found = false;
  walkNodes(root, (n) => {
    if (!isOperator(n, 'divide') || n.args?.length !== 2) return;
    const [left, right] = n.args;
    if (!isConstant(right, den)) return;
    if (constantValue(left) === num) {
      found = true;
      return;
    }
    if (isOperator(left, 'multiply') && left.args?.some((c) => constantValue(c) === num)) {
      found = true;
      return;
    }
    if (num === 1 && isSymbol(left)) found = true;
  });
  return found;
}

function hasDivideTwoFifths(root: unknown): boolean {
  return hasDivideFraction(root, 2, 5);
}

function hasAnyDivide(root: unknown): boolean {
  let found = false;
  walkNodes(root, (n) => {
    if (isOperator(n, 'divide')) found = true;
  });
  return found;
}

function hasDecimalLiteral(root: unknown, value: number): boolean {
  let found = false;
  walkNodes(root, (n) => {
    if (isConstant(n, value)) found = true;
  });
  return found;
}

describe('simplify exactFractions (oracle: 0.4 = 2/5)', () => {
  it('converts 0.4 * x to a 2/5 divide when exactFractions is true', () => {
    const node = simplify('0.4 * x', {}, { exactFractions: true });
    expect(hasDivideTwoFifths(node)).toBe(true);
  });

  it('converts 0.4 * x with default options (exactFractions on, no fractionsLimit cap)', () => {
    const node = simplify('0.4 * x');
    expect(hasDivideTwoFifths(node)).toBe(true);
  });

  it('keeps 0.4 when fractionsLimit excludes denominator 5', () => {
    const node = simplify('0.4 * x', {}, { exactFractions: true, fractionsLimit: 4 });
    expect(hasAnyDivide(node)).toBe(false);
    expect(hasDecimalLiteral(node, 0.4)).toBe(true);
  });

  it('leaves 0.4 when exactFractions is false', () => {
    const node = simplify('0.4 * x', {}, { exactFractions: false });
    expect(hasAnyDivide(node)).toBe(false);
    expect(hasDecimalLiteral(node, 0.4)).toBe(true);
  });

  it('converts other exact decimals: 0.1 → 1/10, 0.25 → 1/4, 1/3-ish → 1/3', () => {
    expect(hasDivideFraction(simplify('0.1 * x', {}, { exactFractions: true }), 1, 10)).toBe(true);
    expect(hasDivideFraction(simplify('0.25 * x', {}, { exactFractions: true }), 1, 4)).toBe(true);
    expect(hasDivideFraction(simplify(`${1 / 3} * x`, {}, { exactFractions: true }), 1, 3)).toBe(
      true
    );
  });

  it('converts a negative decimal using unaryMinus on the numerator', () => {
    const node = simplify('-0.4 * x', {}, { exactFractions: true });
    expect(hasDivideFraction(node, -2, 5)).toBe(true);
  });

  it('leaves an integer as a ConstantNode (denominator 1, no divide)', () => {
    const node = simplify('5 * x', {}, { exactFractions: true });
    expect(hasAnyDivide(node)).toBe(false);
    expect(hasDecimalLiteral(node, 5)).toBe(true);
  });

  it('default fractionsLimit is Infinity, not 10000 (0.00005 = 1/20000)', () => {
    // Fraction.fromNumber(0.00005) is 1/20000; den 20000 is over the old documented cap 10000.
    const uncapped = simplify('0.00005 * x', {}, { exactFractions: true });
    expect(hasDivideFraction(uncapped, 1, 20000)).toBe(true);
    const capped = simplify('0.00005 * x', {}, { exactFractions: true, fractionsLimit: 10000 });
    expect(hasAnyDivide(capped)).toBe(false);
    expect(hasDecimalLiteral(capped, 0.00005)).toBe(true);
  });

  it('leaves a non-round-tripping float (π) unchanged', () => {
    const node = simplify(`${Math.PI} * x`, {}, { exactFractions: true });
    expect(hasAnyDivide(node)).toBe(false);
    expect(hasDecimalLiteral(node, Math.PI)).toBe(true);
  });
});
