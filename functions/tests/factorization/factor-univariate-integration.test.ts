import { describe, it, expect } from 'vitest';
import { factor } from '../../src/typed/algebra.js';
import { evaluate } from '../../src/index.js';

const at = (e: string, x: number): number => evaluate(e, { x }) as number;

describe('factor() — univariate irreducible factorization', () => {
  it('now factors what the old path left whole', () => {
    expect(factor('x^4 - 1')).toBe('(x - 1)*(x + 1)*(x^2 + 1)');
    expect(factor('x^4 + 3*x^2 + 2')).toBe('(x^2 + 1)*(x^2 + 2)');
  });
  it('leaves Q-irreducibles unchanged', () => {
    expect(factor('x^4 + 1')).toBe('x^4 + 1');
    expect(factor('x^2 + x + 1')).toBe('x^2 + x + 1');
  });
  it('regression: existing linear/content outputs are byte-identical', () => {
    expect(factor('x^2 - 1')).toBe('(x - 1)*(x + 1)'); // unchanged contract
    expect(factor('x^3 - x')).toBe('(x)*(x - 1)*(x + 1)'); // linear order preserved
    expect(factor('x^2 - 5*x + 6')).toBe('(x - 2)*(x - 3)'); // fully-linear preserved
    expect(factor('2*x^2 + 2')).toBe('2*(x^2 + 1)'); // content extraction preserved
    expect(factor('6*x^2 - 6')).toBe('6*(x - 1)*(x + 1)'); // content + linears preserved
  });
  it('numeric cross-check: rendered factorization equals the input', () => {
    const cases: Array<[string, (x: number) => number]> = [
      ['x^4 - 1', (x) => x ** 4 - 1],
      ['x^4 + 3*x^2 + 2', (x) => x ** 4 + 3 * x ** 2 + 2],
      ['x^4 + 2*x^2 + 1', (x) => x ** 4 + 2 * x ** 2 + 1], // (x^2+1)^2
      ['x^5 - x', (x) => x ** 5 - x],
    ];
    for (const [e, f] of cases) {
      const factored = factor(e);
      for (const x of [-2, -0.5, 0.5, 1.5, 3]) {
        expect(at(factored, x)).toBeCloseTo(f(x), 8);
      }
    }
  });
});
