import { describe, it, expect } from 'vitest';
import { evaluate } from '@danielsimonjr/mathts-expression';
import { expToTrig, trigToExp } from '../src/typed/algebra.js';
import { topLevelFactors, isParenthesised } from '../src/typed/call-rewrite.js';

function parts(value: unknown): { re: number; im: number } {
  if (typeof value === 'number') return { re: value, im: 0 };
  const c = value as { re: number; im: number };
  return { re: c.re, im: c.im };
}

const POINTS = [
  { x: 0.5, y: 0.3, ix: 0.7, index: 1.3 },
  { x: -1.2, y: 2.1, ix: -0.4, index: 0.2 },
  { x: 3.3, y: -0.7, ix: 2.2, index: -3 },
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
    'exp(2*i*x)',
    'exp(-2*i*x)',
    'exp(x*i*y)',
    'exp(2/3*i*x)',
    'exp(x*-i)',
    'exp(- i*x)',
    'exp(i*x*i)',
    'exp(i*1e-3)',
    'exp(1e+3*i)',
    'exp(ix*-i)',
    'exp(index*i)',
    'exp(i*x?1:2)',
    'exp(i*x y)',
    'x exp(i*y)',
    '2 exp(i*y)',
    '(x) exp(i*y)',
    'x exp(i*exp(i*y))',
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
      'exp(i)',
      'exp(i*x+1)',
      'exp(2+i*x)',
      'exp(i*x - y)',
      'exp(i*x,y)',
      'exp(i*x?1:2)',
      'exp(i*x%2)',
      'exp(i*x mod 2)',
      'exp(i*x==y)',
      'exp(i*x.*y)',
      'exp(i*x y)',
      'exp(i*x1e-3)',
      'x exp(i*y)',
      'x[1] exp(i*y)',
      'x[1]exp(i*y)',
      'myexp(i*x)',
      'exp(i*x',
      'exp(i*(x+1)',
    ]) {
      expect(expToTrig(input)).toBe(input);
    }
  });

  it('returns these exact strings', () => {
    const golden: Record<string, string> = {
      'exp(i*x)': '(cos(x) + i*sin(x))',
      'exp(-i*x)': '(cos(x) - i*sin(x))',
      'exp(i*(x+1))': '(cos((x+1)) + i*sin((x+1)))',
      'exp(i*(x+1)*(y))': '(cos(((x+1)*(y))) + i*sin(((x+1)*(y))))',
      'exp(2*i*x)': '(cos((2*x)) + i*sin((2*x)))',
      'exp(-2*i*x)': '(cos((-2*x)) + i*sin((-2*x)))',
      'exp(x * -i * y)': '(cos((x*y)) - i*sin((x*y)))',
      'exp(i*1e-3)': '(cos((1e-3)) + i*sin((1e-3)))',
      'exp(i*0.5)': '(cos(0.5) + i*sin(0.5))',
      'exp(ix*-i)': '(cos(ix) - i*sin(ix))',
      'exp(i*exp(i*x))': '(cos((cos(x) + i*sin(x))) + i*sin((cos(x) + i*sin(x))))',
      'exp(x+exp(i*y))': 'exp(x+(cos(y) + i*sin(y)))',
      'x exp(i*exp(i*y))': 'x exp(i*(cos(y) + i*sin(y)))',
      'x mod exp(i*y)': 'x mod (cos(y) + i*sin(y))',
      '2 exp(i*y)': '2 (cos(y) + i*sin(y))',
    };
    for (const [input, output] of Object.entries(golden)) {
      expect(expToTrig(input), input).toBe(output);
    }
  });

  it('scans a nested call that is not rewritten one time', () => {
    // When each level is scanned two times, depth 20 takes about 3 s.
    let input = 'x';
    for (let depth = 0; depth < 20; depth++) input = `exp(x+${input})`;
    const start = performance.now();
    expect(expToTrig(input)).toBe(input);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('trigToExp output strings (#1087)', () => {
  it('returns these exact strings', () => {
    const golden: Record<string, string> = {
      'sin(x)': '((exp(i*x) - exp(-i*x))/(2*i))',
      'cos(x)': '((exp(i*x) + exp(-i*x))/2)',
      'tan(x)': '((exp(i*x) - exp(-i*x))/(i*(exp(i*x) + exp(-i*x))))',
      'sin(x+1)': '((exp(i*(x+1)) - exp(-i*(x+1)))/(2*i))',
      'cos(sin(x))':
        '((exp(i*(((exp(i*x) - exp(-i*x))/(2*i)))) + exp(-i*(((exp(i*x) - exp(-i*x))/(2*i)))))/2)',
      '2sin(x)^2': '2((exp(i*x) - exp(-i*x))/(2*i))^2',
      '2 cos(x)': '2 ((exp(i*x) + exp(-i*x))/2)',
      'x mod cos(y)': 'x mod ((exp(i*y) + exp(-i*y))/2)',
      'asin(x) + sinh(x) + mysin(x)': 'asin(x) + sinh(x) + mysin(x)',
      'sin(x': 'sin(x',
      // An implicit product after a name stays as written: `x (...)` is a call of `x`.
      'x sin(y)': 'x sin(y)',
      'x[1]sin(y)': 'x[1]sin(y)',
      'x sin(cos(y))': 'x sin(((exp(i*y) + exp(-i*y))/2))',
    };
    for (const [input, output] of Object.entries(golden)) {
      expect(trigToExp(input), input).toBe(output);
    }
  });

  it('keeps the value of an implicit product', () => {
    for (const input of ['x sin(y)', '2 sin(y)', '(x) cos(y)', 'x sin(cos(y))', 'v[1] sin(y)']) {
      const out = trigToExp(input);
      for (const point of POINTS) {
        const scope = { ...point, v: [2, 3] };
        const a = parts(evaluate(input, scope));
        const b = parts(evaluate(out, scope));
        expect(Math.abs(a.re - b.re), out).toBeLessThan(1e-12);
        expect(Math.abs(b.im), out).toBeLessThan(1e-12);
      }
    }
  });
});

describe('call-rewrite helpers (#1087)', () => {
  it('topLevelFactors splits a product and refuses other text', () => {
    expect(topLevelFactors('2 * i*(x+1)')).toEqual(['2', 'i', '(x+1)']);
    expect(topLevelFactors('-i*x^-2/3')).toEqual(['-i', 'x^-2/3']);
    expect(topLevelFactors('1e-3*sin(x, y)')).toEqual(['1e-3', 'sin(x, y)']);
    const refused = ['', 'x+1', 'x - 1', 'x,y', 'x y', 'x*', '*x', 'x%2', 'x.*y', '(x', 'x1e-3'];
    for (const text of refused) {
      expect(topLevelFactors(text), text).toBeUndefined();
    }
  });

  it('isParenthesised needs one pair around all of the text', () => {
    expect(isParenthesised('(x+1)')).toBe(true);
    expect(isParenthesised('((x)*(y))')).toBe(true);
    expect(isParenthesised('(x)*(y)')).toBe(false);
    expect(isParenthesised('x')).toBe(false);
    expect(isParenthesised('(x')).toBe(false);
  });
});
