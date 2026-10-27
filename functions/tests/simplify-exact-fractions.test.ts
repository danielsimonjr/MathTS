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

function hasDivideTwoFifths(root: unknown): boolean {
  let found = false;
  walkNodes(root, (n) => {
    if (!isOperator(n, 'divide') || n.args?.length !== 2) return;
    const [num, den] = n.args;
    // e.g. (x * 2) / 5 or 2 / 5
    if (isConstant(num, 2) && isConstant(den, 5)) found = true;
    if (
      isOperator(num, 'multiply') &&
      num.args?.some((c) => isConstant(c, 2)) &&
      isConstant(den, 5)
    ) {
      found = true;
    }
  });
  return found;
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
});
