import { describe, expect, it } from 'vitest';
import { create, all } from '../../src/index.js';

describe('issue #1786 parser/AST parity', () => {
  const math = create(all);

  it('evaluate accepts matrix batches of expressions', () => {
    expect(math.evaluate(math.matrix(['a=3', 'b=4', 'a*b']))).toEqual(math.matrix([3, 4, 12]));
  });

  it('nullish coalescing throws for undefined symbols in scope', () => {
    const scope = { a: null, b: 5, c: 0 };
    expect(() => math.evaluate('d ?? 0', scope)).toThrow(/Undefined symbol d/);
    expect(() => math.parse('d ?? 0').evaluate({ ...scope })).toThrow(/Undefined symbol d/);
  });

  it('parse().evaluate matches math.evaluate for inline map callbacks', () => {
    const expr = 'map([6, 0, 1, -0.2], boolean(x))';
    expect(math.parse(expr).evaluate({})).toEqual(math.evaluate(expr));
  });

  it('rewrites bare 2e to 2*E for mathjs literal parsing', () => {
    expect(math.evaluate('2e')).toBeCloseTo(2 * Math.E, 12);
    expect(math.parse('2e').toString()).toContain('*');
  });

  it('sum.toTex honors per-function template objects', () => {
    const custom = create(all);
    const sumFn = custom.sum as { toTex?: Record<number, string> };
    sumFn.toTex = {
      2: '${args[0]}+${args[1]}',
    };
    expect(custom.parse('sum(1,2)').toTex()).toBe('1+2');
  });

  it('expression.transform.std uses one-based matrix dimensions', () => {
    const std = math.expression.transform.std as (...args: unknown[]) => unknown;
    expect(
      std(
        [
          [2, 6],
          [4, 10],
        ],
        1,
        'uncorrected'
      )
    ).toEqual([1, 2]);
  });
});
