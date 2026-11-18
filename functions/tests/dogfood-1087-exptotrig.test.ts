import { describe, it, expect, vi } from 'vitest';
import { evaluate } from '@danielsimonjr/mathts-expression';
import { expToTrig, trigToExp } from '../src/typed/algebra.js';
import {
  rewriteCalls,
  topLevelFactors,
  isParenthesised,
  hasTopLevelComma,
} from '../src/typed/call-rewrite.js';

// Count the scans of rewriteCalls, so the nesting test does not depend on the wall clock.
const scans = vi.hoisted(() => ({ count: 0 }));
vi.mock('../src/typed/call-rewrite.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/typed/call-rewrite.js')>();
  return {
    ...actual,
    rewriteCalls: (...args: Parameters<typeof actual.rewriteCalls>) => {
      scans.count++;
      return actual.rewriteCalls(...args);
    },
  };
});

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
    'exp(i*2. * x)',
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
      // `2.*x` reads as `2 .* x`, so the factor `2.` keeps a space.
      'exp(i*2. * x)': '(cos((2. *x)) + i*sin((2. *x)))',
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
    // When each level is scanned again, depth 20 makes 2^20 scans.
    let input = 'x';
    for (let depth = 0; depth < 20; depth++) input = `exp(x+${input})`;
    scans.count = 0;
    expect(expToTrig(input)).toBe(input);
    expect(scans.count).toBe(1);
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

describe('the scanner follows the expression parser (#1087)', () => {
  const both = (input: string): [string, string] => [expToTrig(input), trigToExp(input)];

  it('leaves text in a string literal or a comment as written', () => {
    for (const input of [
      '"exp(i*x) sin(x)"',
      "'exp(i*x) sin(x)'",
      '"a\\"exp(i*x) sin(x)"',
      "x mod 'exp(i*x) sin(x)'",
      'x # exp(i*x) sin(x)',
    ]) {
      expect(both(input), input).toEqual([input, input]);
    }
    // The scan goes on after the string or the comment.
    expect(expToTrig('"exp(i*x)" + exp(i*y)')).toBe('"exp(i*x)" + (cos(y) + i*sin(y))');
    expect(trigToExp('x # sin(x)\ncos(y)')).toBe('x # sin(x)\n((exp(i*y) + exp(-i*y))/2)');
    // A parenthesis in a string does not close a call.
    expect(trigToExp('sin(f(")")) + 1')).toBe('((exp(i*(f(")"))) - exp(-i*(f(")"))))/(2*i)) + 1');
    expect(expToTrig('exp(i*f(")")) + 1')).toBe('(cos((f(")"))) + i*sin((f(")")))) + 1');
    // A quote after a value is the transpose operator, not a string.
    expect(expToTrig("x' * exp(i*y) * z'")).toBe("x' * (cos(y) + i*sin(y)) * z'");
    expect(expToTrig('x # c\nexp(i*y)')).toBe('x # c\n(cos(y) + i*sin(y))');
    // After `%` the role of a quote is not certain: the expression stays as written.
    expect(expToTrig("5%'a' + exp(i*y)")).toBe("5%'a' + exp(i*y)");
  });

  it('rewrites a call after a number, a constant, a matrix or a line end', () => {
    const golden: Record<string, string> = {
      '1e3 exp(i*y)': '1e3 (cos(y) + i*sin(y))',
      '1.5e3 exp(i*y)': '1.5e3 (cos(y) + i*sin(y))',
      '0x1F exp(i*y)': '0x1F (cos(y) + i*sin(y))',
      '0b11 exp(i*y)': '0b11 (cos(y) + i*sin(y))',
      '2. exp(i*y)': '2. (cos(y) + i*sin(y))',
      'true exp(i*y)': 'true (cos(y) + i*sin(y))',
      '[1, 2] exp(i*y)': '[1, 2] (cos(y) + i*sin(y))',
      'x mod [2] exp(i*y)': 'x mod [2] (cos(y) + i*sin(y))',
      'x\nexp(i*y)': 'x\n(cos(y) + i*sin(y))',
      'x in exp(i*y)': 'x in (cos(y) + i*sin(y))',
    };
    for (const [input, output] of Object.entries(golden)) {
      expect(expToTrig(input), input).toBe(output);
    }
    for (const input of [
      '1e3 exp(i*y)',
      '0x1F exp(i*y)',
      '2.sin(y)',
      '1e3 sin(y)',
      '0b11 cos(y)',
    ]) {
      const out = input.includes('exp') ? expToTrig(input) : trigToExp(input);
      expect(out).not.toBe(input);
      for (const scope of POINTS) {
        const a = parts(evaluate(input, scope));
        const b = parts(evaluate(out, scope));
        expect(Math.abs(a.re - b.re), out).toBeLessThan(1e-9);
        expect(Math.abs(a.im - b.im), out).toBeLessThan(1e-9);
      }
    }
  });

  it('leaves a call as written where the replacement reads as a call or a property', () => {
    for (const input of [
      // `2x`, `1e3x` and `x1F` are names or end with one; `2 in (...)` calls the symbol `in`.
      '2x exp(i*y)',
      '1e3x exp(i*y)',
      '2.0x1F exp(i*y)',
      '2 in exp(i*y)',
      'pi exp(i*y)',
      'o.mod exp(i*y)',
      'o.true exp(i*y)',
      'v[1] exp(i*y)',
      '[1, 2][1] exp(i*y)',
      'f(x)[1] exp(i*y)',
      '(x\nexp(i*y))',
      '\u{1d465} exp(i*y)',
      // A method call.
      'o.exp(i*y)',
      'o. exp(i*y)',
      'o?.exp(i*y)',
      'x2.exp(i*y)',
    ]) {
      expect(expToTrig(input), input).toBe(input);
      const trig = input.replace('exp(i*y)', 'sin(y)');
      expect(trigToExp(trig), trig).toBe(trig);
    }
  });

  it('trigToExp leaves a call with no argument or with two as written', () => {
    expect(trigToExp('sin() + sin(x)')).toBe('sin() + ((exp(i*x) - exp(-i*x))/(2*i))');
    expect(trigToExp('sin(x, y)')).toBe('sin(x, y)');
    expect(trigToExp('sin(f(x, y))')).toBe('((exp(i*(f(x, y))) - exp(-i*(f(x, y))))/(2*i))');
    expect(trigToExp('cos(v[1, 2])')).toBe('((exp(i*(v[1, 2])) + exp(-i*(v[1, 2])))/2)');
    expect(trigToExp('tan(x, cos(y))')).toBe('tan(x, ((exp(i*y) + exp(-i*y))/2))');
  });

  it('expToTrig reads an index, a property and a postfix operator as part of a factor', () => {
    const golden: Record<string, string> = {
      'exp(i*v[1])': '(cos((v[1])) + i*sin((v[1])))',
      'exp(v [1]*i)': '(cos((v [1])) + i*sin((v [1])))',
      'exp(i*o.y)': '(cos(o.y) + i*sin(o.y))',
      'exp(i*x!)': '(cos((x!)) + i*sin((x!)))',
      "exp(i*x')": "(cos((x')) + i*sin((x')))",
      'exp(i*f(x)[1].y)': '(cos((f(x)[1].y)) + i*sin((f(x)[1].y)))',
    };
    for (const [input, output] of Object.entries(golden)) {
      expect(expToTrig(input), input).toBe(output);
    }
    for (const input of [
      'exp(i*[1, 2])',
      'exp(i*"a")',
      "exp(i*'a')",
      'exp(i*x!=y)',
      'exp(i*x .* y)',
    ]) {
      expect(expToTrig(input), input).toBe(input);
    }
    for (const scope of POINTS) {
      const withVector = { ...scope, v: [2, 3], o: { y: 0.4 } };
      for (const input of ['exp(i*v[1])', 'exp(i*o.y)']) {
        const a = parts(evaluate(input, withVector));
        const b = parts(evaluate(expToTrig(input), withVector));
        expect(Math.abs(a.re - b.re), input).toBeLessThan(1e-12);
        expect(Math.abs(a.im - b.im), input).toBeLessThan(1e-12);
      }
    }
  });

  it('pairs the brackets one time, so a group is not walked again at each level', () => {
    // The callback gets the group ends of its argument from the one pass.
    const ends: number[] = [];
    rewriteCalls('1 + exp(2*(x+(y))*v[a(b)]) + exp(x[1)]', ['exp'], (_name, arg, groupEnd) => {
      if (arg === '2*(x+(y))*v[a(b)]') ends.push(groupEnd(2), groupEnd(5), groupEnd(11));
      else ends.push(groupEnd(1)); // `x[1`: the bracket closes after the call
      return undefined;
    });
    expect(ends).toEqual([9, 8, 17, -1]);
    // topLevelFactors uses those group ends; it does not walk the group.
    expect(topLevelFactors('2*(((', () => 5)).toEqual(['2', '(((']);
    expect(topLevelFactors('2*(x', () => -1)).toBeUndefined();
    // Deep nesting that stays as written. Each level was walked again before.
    for (const shape of ['exp(x+@)', 'exp(2*(@))', 'asin(sin(x, y)+@)']) {
      let input = 'x';
      for (let depth = 0; depth < 3000; depth++) input = shape.replace('@', input);
      expect(expToTrig(input)).toBe(input);
      expect(trigToExp(input)).toBe(input);
    }
  });
});

describe('call-rewrite helpers (#1087)', () => {
  it('hasTopLevelComma reads a comma outside the groups', () => {
    const ends =
      (text: string) =>
      (pos: number): number => {
        const close = text.indexOf(text[pos] === '(' ? ')' : ']', pos);
        return close < 0 ? -1 : close + 1;
      };
    for (const [text, expected] of [
      ['x, y', true],
      ['f(x, y)', false],
      ['v[1, 2]*f(x, y)', false],
      ['f(x), y', true],
      ['f(x', true],
      ['', false],
    ] as const) {
      expect(hasTopLevelComma(text, ends(text)), text).toBe(expected);
    }
  });

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
