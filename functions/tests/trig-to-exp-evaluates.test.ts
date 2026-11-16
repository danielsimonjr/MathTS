import { describe, it, expect } from 'vitest';
import { evaluate } from '@danielsimonjr/mathts-expression';
import { trigToExp } from '../src/typed/algebra.js';

/** Real and imaginary parts of an evaluated result (a number or a Complex). */
function parts(value: unknown): { re: number; im: number } {
  if (typeof value === 'number') return { re: value, im: 0 };
  const c = value as { re: number; im: number };
  return { re: c.re, im: c.im };
}

describe('trigToExp output evaluates (#1025)', () => {
  const cases: Array<[string, (x: number) => number]> = [
    ['sin', Math.sin],
    ['cos', Math.cos],
    ['tan', Math.tan],
  ];

  for (const [fn, oracle] of cases) {
    it(`${fn}: evaluate(trigToExp('${fn}(x)'), {x: 0.5}) equals Math.${fn}(0.5)`, () => {
      const expr = trigToExp(`${fn}(x)`);
      const { re, im } = parts(evaluate(expr, { x: 0.5 }));
      expect(Math.abs(re - oracle(0.5))).toBeLessThan(1e-12);
      expect(Math.abs(im)).toBeLessThan(1e-12);
    });
  }
});
