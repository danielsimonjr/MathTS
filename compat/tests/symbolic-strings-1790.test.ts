import { describe, expect, it } from 'vitest';
import { create, all } from '../src/index.js';
type SymbolicMath = ReturnType<typeof create>;
type ExpressionNode = {
  toString: (options?: Record<string, unknown>) => string;
  evaluate: (scope?: Record<string, unknown>) => unknown;
};

describe('#1790 symbolic string parity', () => {
  const math = create(all) as SymbolicMath;

  it('simplify renders string constants like mathjs', () => {
    expect((math.simplify('string(2)') as ExpressionNode).toString()).toBe('"2"');
    expect((math.simplify('string(4/2)') as ExpressionNode).toString()).toBe('"2"');
  });

  it('resolve substitutes without wrapping node.evaluate', () => {
    const left = math.resolve('x + y', { x: 1, y: 2 }) as ExpressionNode;
    const right = math.parse('1 + 2') as ExpressionNode;
    expect(left.toString()).toBe(right.toString());
    expect(left.evaluate()).toEqual(right.evaluate());
  });

  it('resolve accepts Map scopes', () => {
    const scope = new Map<string, unknown>([
      ['x', 3],
      ['y', 4],
    ]);
    expect(
      (math.resolve(math.parse('x + y'), scope) as ExpressionNode).toString()
    ).toBe('3 + 4');
  });

  it('derivative of acoth has correct sign', () => {
    const d = math.derivative('acoth(x)', 'x') as ExpressionNode;
    expect(d.toString()).toBe('1 / (1 - x ^ 2)');
    expect(d.evaluate({ x: 2 })).toBeCloseTo(-1 / 3);
    expect(d.evaluate({ x: 2 })).toBeLessThan(0);
  });

  it('preserves bigint values when number mode is bigint', () => {
    const bigintMath = create(all, { number: 'bigint' }) as SymbolicMath;
    expect(
      (bigintMath.simplify('70000000000000000123 + 1') as ExpressionNode).evaluate()
    ).toBe(70000000000000000124n);
    expect(
      (bigintMath.simplify('70000000000000000123 + bigint(5000)') as ExpressionNode).evaluate()
    ).toBe(70000000000000005123n);
  });
});