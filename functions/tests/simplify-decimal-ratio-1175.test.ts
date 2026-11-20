import { describe, it, expect } from 'vitest';
import { simplify } from '../src/index.js';

// #1175: simplify printed a decimal as a ratio of two large numbers (66079.39738442015 became
// 6.977852205e+9 / 1.05598e+5). _exactFraction accepted any number that a MathTS Fraction
// reproduces. mathjs asks the fraction.js class instead, and keeps the decimal when that class
// does not reproduce the number. The expected texts are the mathjs 15.2.0 results.

function text(input: string): string {
  return simplify(input).toString();
}

describe('#1175 simplify keeps a decimal that has no small exact fraction', () => {
  it('a decimal literal stays a decimal', () => {
    expect(text('66079.39738442015')).toBe('66079.39738442015');
    expect(text('154905.87719165272')).toBe('1.5490587719165272e+5');
  });

  it('a folded product stays a decimal', () => {
    expect(text('22026.465794806718*3')).toBe('66079.39738442015');
    expect(text('exp(10)*3')).toBe('66079.39738442015');
  });

  it('a decimal beside a symbol stays a decimal', () => {
    expect(text('59760.92063816244 + x')).toBe('x + 59760.92063816244');
  });

  it('a number with a tiny exact fraction is a fraction, as in mathjs', () => {
    expect(text('1e-7')).toBe('1 / 1e+7');
  });

  it('keeps the fractions of a number that has a small exact fraction', () => {
    expect(text('0.1+0.2')).toBe('3 / 10');
    expect(text('123.456')).toBe('15432 / 125');
    expect(text('0.3333333333333333')).toBe('1 / 3');
  });

  it('prints each of 400 values of exp(12u) with all of its digits', () => {
    // A seeded LCG gives u in [0, 1): the same values at each run.
    let state = 123456789;
    const next = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < 400; i++) {
      const v = Math.exp(12 * next());
      // The printed text is the decimal, or a fraction "n / d" that has the value v: it never
      // rounds the number to a ratio of numbers with fewer digits.
      expect(valueOfPrinted(text(String(v))), String(v)).toBe(v);
    }
  });
});

/** Value of a printed number or of a printed "n / d" fraction. */
function valueOfPrinted(printed: string): number {
  const [n, d] = printed.split('/').map((part) => Number(part.trim()));
  return d === undefined ? n : n / d;
}
