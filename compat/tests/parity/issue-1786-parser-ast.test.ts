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
});
