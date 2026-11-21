/**
 * #1086: the default expression scope returns a Complex for a negative real outside the real
 * domain, as mathjs does (`predictable: false`).
 *
 * `pow`, `sqrt` and `log` of the default scope used `Math.pow`, `Math.sqrt` and `Math.log` for a
 * real operand, so `sqrt(-4)`, `(-8)^(1/3)` and `log(-1)` were NaN. Every Complex value below is
 * the mathjs 15.2.0 result (bit exact). A NaN argument keeps the number NaN: mathjs gives a
 * Complex NaN there, the functions layer keeps the number (`log(NaN)`), and the scope follows
 * the functions layer (decision D6).
 */
import { describe, it, expect } from 'vitest';
import { evaluate as mathjsEvaluate } from 'mathjs';
import { isComplex } from '@danielsimonjr/mathts-core';
import { evaluate, parse, compileExpression } from '../src/index.js';

/** Two numbers are the same value: `Object.is`, and a NaN equals a NaN. */
function sameNumber(a: number, b: number): boolean {
  return Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b));
}

/**
 * The expected value is the result of the mathjs 15.2.0 `evaluate`, computed in the same process.
 * The default scope and complex.js use the same steps (hypot, atan2, exp, cos, sin), so both read
 * the one libm of the running engine, and the two agree to the last bit on V8 and on
 * JavaScriptCore. A fixed table of numbers cannot do this: `Math.exp(-0.5 * Math.log(2))` is
 * 0.7071067811865475 on V8 and 0.7071067811865476 on JavaScriptCore, so a literal is right on one
 * engine only, and a tolerance for the other engine would also pass a real one-ulp drift of the
 * algorithm.
 */
function oracle(expr: string): { re: number; im: number } {
  return mathjsEvaluate(expr) as { re: number; im: number };
}

function expectComplex(expr: string, re?: number, im?: number): void {
  const value = evaluate(expr);
  expect(isComplex(value), `${expr} is a Complex, got ${String(value)}`).toBe(true);
  const z = value as { re: number; im: number };
  const want = oracle(expr);
  expect(sameNumber(z.re, want.re), `${expr} re ${z.re}, mathjs ${want.re}`).toBe(true);
  expect(sameNumber(z.im, want.im), `${expr} im ${z.im}, mathjs ${want.im}`).toBe(true);
  // A row with no libm call has one value on every engine: pin it as well.
  if (re !== undefined && im !== undefined) {
    expect(sameNumber(z.re, re), `${expr} re ${z.re}, want ${re}`).toBe(true);
    expect(sameNumber(z.im, im), `${expr} im ${z.im}, want ${im}`).toBe(true);
  }
}

function expectNumber(expr: string, want: number): void {
  const value = evaluate(expr);
  expect(typeof value, `${expr} is a number, got ${String(value)}`).toBe('number');
  expect(Object.is(value, want), `${expr} is ${String(value)}`).toBe(true);
}

describe('default scope returns a Complex outside the real domain (#1086)', () => {
  // [expression, re, im]: the pinned value is given only for a row with no libm call. A row that
  // calls exp, log, sin, cos or pow compares to the live mathjs value alone.
  const pinnedRows: Array<[string, number, number]> = [
    ['sqrt(-4)', 0, 2],
    ['log(-1)', 0, 3.141592653589793],
    ['sqrt(-Infinity)', 0, Infinity],
    ['log(-Infinity)', Infinity, 3.141592653589793],
    ['sqrt(-4) + 1', 1, 2],
    ['(-8)^NaN', NaN, NaN],
    ['(-8)^Infinity', NaN, NaN],
    ['(-1)^Infinity', NaN, NaN],
    ['(-0.5)^(-Infinity)', NaN, NaN],
  ];
  const libmRows = [
    '(-8)^(1/3)', // mathjs 15.2.0 on V8: 1 + 1.732050807568877i
    'pow(-8, 1/3)',
    '(-8)^0.5', // 1.7319121124709863e-16 + 2.82842712474619i on V8
    '(-2)^(-0.5)', // 4.329780281177466e-17 - 0.7071067811865475i on V8, ...467e-17 and ...476 on JSC
    '(-8)^(-1/3)',
    '(-8)^(2/3)',
    '(-3)^0.25',
    '(-10)^0.1',
    '(-7)^2.5',
    '(-0.3)^(-0.7)',
  ];
  for (const [expr, re, im] of pinnedRows) {
    it(`${expr} is ${re} + ${im}i`, () => {
      expectComplex(expr, re, im);
    });
  }
  for (const expr of libmRows) {
    it(`${expr} equals the mathjs value to the last bit`, () => {
      expectComplex(expr);
    });
  }

  it('parse(...).evaluate() of the default instance returns a Complex', () => {
    const value = parse('sqrt(-4)').evaluate();
    expect(isComplex(value)).toBe(true);
    expect([(value as { re: number }).re, (value as { im: number }).im]).toEqual([0, 2]);
  });

  it('the one-argument compileExpression returns a Complex', () => {
    const value = compileExpression('(-8)^(1/3)').evaluate();
    expect(isComplex(value)).toBe(true);
    const want = oracle('(-8)^(1/3)');
    expect(sameNumber((value as { re: number }).re, want.re)).toBe(true);
    expect(sameNumber((value as { im: number }).im, want.im)).toBe(true);
  });

  // The mathjs value of a power of a negative real is complex.js's `exp(w * log(z))`. A seeded
  // corpus compares the whole path (sign, magnitude, rounding) with the live oracle, exactly.
  it('a seeded corpus of negative bases and fractional exponents equals mathjs to the last bit', () => {
    let state = 2026;
    const next = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < 300; i++) {
      const a = -(next() * 10 ** Math.floor(next() * 6 - 2));
      const b = (next() - 0.5) * 10 ** Math.floor(next() * 3 - 1);
      if (Number.isInteger(b)) continue;
      const expr = `(${a})^(${b})`;
      expectComplex(expr);
      expectComplex(`pow(${a}, ${b})`);
    }
    for (let i = 0; i < 100; i++) {
      const a = -(next() * 10 ** Math.floor(next() * 8 - 3));
      expectComplex(`sqrt(${a})`);
      expectComplex(`log(${a})`);
    }
  });
});

describe('default scope keeps a real result where mathjs does (#1086)', () => {
  const numberRows: Array<[string, number]> = [
    ['(-0.5)^Infinity', 0],
    ['(-8)^(-Infinity)', 0],
    ['(-Infinity)^(-Infinity)', 0],
    ['(-8)^(1e300)', Infinity],
    ['(-0)^0.5', 0],
    ['abs(sqrt(-4))', 2],
    ['(-8)^3', -512],
    ['(-8)^2', 64],
    ['sqrt(4)', 2],
    ['sqrt(-0)', -0],
    ['sqrt(NaN)', NaN],
    ['log(0)', -Infinity],
    ['-8^(1/3)', -2],
    ['2^0.5', 1.4142135623730951],
    ['cbrt(-8)', -2],
    ['nthRoot(-8, 3)', -2],
  ];
  for (const [expr, want] of numberRows) {
    it(`${expr} is the number ${want}`, () => {
      expectNumber(expr, want);
    });
  }

  it('log(NaN) and NaN^0.5 stay the number NaN (deliberate: mathjs gives a Complex NaN)', () => {
    expectNumber('log(NaN)', NaN);
    expectNumber('NaN^0.5', NaN);
  });
});
