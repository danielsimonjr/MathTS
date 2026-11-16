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

  const x = 0.5;
  const y = 0.3;
  const compound: Array<[string, number]> = [
    ['sin(x+1)', Math.sin(x + 1)],
    ['sin(2*x+1)^2', Math.sin(2 * x + 1) ** 2],
    ['cos(x)^2', Math.cos(x) ** 2],
    ['1/sin(x)', 1 / Math.sin(x)],
    ['sin(x)/cos(x)', Math.sin(x) / Math.cos(x)],
    ['sin(cos(x))', Math.sin(Math.cos(x))],
    ['tan(tan(x))', Math.tan(Math.tan(x))],
    ['sin(x - y)', Math.sin(x - y)],
    ['sin(x)sin(y)', Math.sin(x) * Math.sin(y)],
    ['sin(x)^2+cos(x)^2', 1],
    ['2sin(x)', 2 * Math.sin(x)],
    ['sin (x)', Math.sin(x)],
    ['sin(x)^-1', 1 / Math.sin(x)],
    ['sqrt(sin(x)+2)', Math.sqrt(Math.sin(x) + 2)],
    ['abs(sin(x))', Math.abs(Math.sin(x))],
    ['log(2+cos(x))', Math.log(2 + Math.cos(x))],
  ];
  for (const [input, expected] of compound) {
    it(`${input} keeps its value after trigToExp`, () => {
      const { re, im } = parts(evaluate(trigToExp(input), { x, y }));
      expect(Math.abs(re - expected)).toBeLessThan(1e-12);
      expect(Math.abs(im)).toBeLessThan(1e-12);
    });
  }

  it('other functions and unbalanced input pass through unchanged', () => {
    for (const input of ['asin(x)', 'sinh(x)', 'mysin(x)', 'sin(x']) {
      expect(trigToExp(input)).toBe(input);
    }
  });
});
