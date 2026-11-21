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
import { isComplex } from '@danielsimonjr/mathts-core';
import { evaluate, parse, compileExpression } from '../src/index.js';

/** Distance in representable doubles (0 for equal values, Infinity when only one is NaN). */
function ulpDistance(a: number, b: number): number {
  if (Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b))) return 0;
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  const view = new DataView(new ArrayBuffer(8));
  const ordered = (x: number): bigint => {
    view.setFloat64(0, Math.abs(x));
    const bits = view.getBigInt64(0);
    return x < 0 ? -bits : bits;
  };
  const gap = ordered(a) - ordered(b);
  return Number(gap < 0n ? -gap : gap);
}

/**
 * The libm of JavaScriptCore (`bun test`) can differ from V8 (Node, the engine of CI and of the
 * mathjs values below) by one ulp in `exp`, `log`, `sin`, `cos` and `pow`. A row that calls them is
 * exact on V8 and within 2 ulp on another engine. A row with no libm call is exact everywhere.
 */
const IS_V8 = (process.versions as Record<string, string | undefined>).bun === undefined;

function expectPart(expr: string, name: string, got: number, want: number, libm: boolean): void {
  const limit = libm && !IS_V8 ? 2 : 0;
  expect(ulpDistance(got, want), `${expr} ${name} ${got}, want ${want}`).toBeLessThanOrEqual(limit);
}

function expectComplex(expr: string, re: number, im: number, libm = false): void {
  const value = evaluate(expr);
  expect(isComplex(value), `${expr} is a Complex, got ${String(value)}`).toBe(true);
  const z = value as { re: number; im: number };
  expectPart(expr, 're', z.re, re, libm);
  expectPart(expr, 'im', z.im, im, libm);
}

function expectNumber(expr: string, want: number): void {
  const value = evaluate(expr);
  expect(typeof value, `${expr} is a number, got ${String(value)}`).toBe('number');
  expect(Object.is(value, want), `${expr} is ${String(value)}`).toBe(true);
}

describe('default scope returns a Complex outside the real domain (#1086)', () => {
  // [expression, re, im, the row calls a libm function]
  const complexRows: Array<[string, number, number, boolean]> = [
    ['sqrt(-4)', 0, 2, false],
    ['(-8)^(1/3)', 1, 1.732050807568877, true],
    ['pow(-8, 1/3)', 1, 1.732050807568877, true],
    ['log(-1)', 0, 3.141592653589793, false],
    ['(-8)^0.5', 1.7319121124709863e-16, 2.82842712474619, true],
    ['(-2)^(-0.5)', 4.329780281177466e-17, -0.7071067811865475, true],
    ['(-8)^(-1/3)', 0.2500000000000001, -0.4330127018922194, true],
    ['sqrt(-Infinity)', 0, Infinity, false],
    ['log(-Infinity)', Infinity, 3.141592653589793, false],
    ['(-8)^(2/3)', -1.9999999999999987, 3.464101615137754, true],
    ['sqrt(-4) + 1', 1, 2, false],
    ['(-8)^NaN', NaN, NaN, false],
    ['(-8)^Infinity', NaN, NaN, false],
    ['(-1)^Infinity', NaN, NaN, false],
    ['(-0.5)^(-Infinity)', NaN, NaN, false],
  ];
  for (const [expr, re, im, libm] of complexRows) {
    it(`${expr} is ${re} + ${im}i`, () => {
      expectComplex(expr, re, im, libm);
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
    expectPart('(-8)^(1/3)', 're', (value as { re: number }).re, 1, true);
    expectPart('(-8)^(1/3)', 'im', (value as { im: number }).im, 1.732050807568877, true);
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
