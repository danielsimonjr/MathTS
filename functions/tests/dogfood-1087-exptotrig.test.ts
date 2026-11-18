import { describe, it, expect } from 'vitest';
import { evaluate } from '@danielsimonjr/mathts-expression';
import { expToTrig, trigToExp } from '../src/typed/algebra.js';

function parts(value: unknown): { re: number; im: number } {
  if (typeof value === 'number') return { re: value, im: 0 };
  const c = value as { re: number; im: number };
  return { re: c.re, im: c.im };
}

const POINTS = [
  { x: 0.5, y: 0.3 },
  { x: -1.2, y: 2.1 },
  { x: 3.3, y: -0.7 },
];

describe('expToTrig keeps the value of its input (#1087)', () => {
  const inputs = [
    'exp(i*x)',
    'exp(-i*x)',
    'exp(i * x)',
    'exp(i*(x+1))',
    'exp(-i*(x+1))',
    'exp(i*(x+1)*y)',
    'exp(i*sin(x))',
    'exp(i*exp(i*x))',
    'exp(i*x)*exp(-i*y)',
    '2*exp(i*x)',
    '2/exp(i*x)',
    'exp(i*x)^2',
    '1-exp(i*x)',
    'exp(x*i)',
    'exp(i*x^2)',
    'exp(i*x/2)',
    'exp(i*x)+exp(-i*x)',
    'sqrt(exp(i*(x+y)))',
  ];
  for (const input of inputs) {
    it(`${input}`, () => {
      const out = expToTrig(input);
      for (const scope of POINTS) {
        const a = parts(evaluate(input, scope));
        const b = parts(evaluate(out, scope));
        expect(Math.abs(a.re - b.re), `${out} re`).toBeLessThan(1e-12);
        expect(Math.abs(a.im - b.im), `${out} im`).toBeLessThan(1e-12);
      }
    });
  }

  it('round trip trigToExp then expToTrig keeps the value', () => {
    for (const input of ['sin(x+1)', 'cos(2*x)^2', 'sin(x)*cos(y)']) {
      const out = expToTrig(trigToExp(input));
      for (const scope of POINTS) {
        const a = parts(evaluate(input, scope));
        const b = parts(evaluate(out, scope));
        expect(Math.abs(a.re - b.re)).toBeLessThan(1e-12);
        expect(Math.abs(b.im)).toBeLessThan(1e-12);
      }
    }
  });

  it('leaves non-Euler and unbalanced input unchanged', () => {
    for (const input of [
      'exp(x)',
      'exp(i*x+1)',
      'exp(2+i*x)',
      'myexp(i*x)',
      'exp(i*x',
      'exp(i*(x+1)',
    ]) {
      expect(expToTrig(input)).toBe(input);
    }
  });
});
