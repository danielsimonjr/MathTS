import { describe, it, expect } from 'vitest';
import { expand } from '../src/index.js';
import {
  MAX_POLYNOMIAL_TERMS,
  PolynomialSizeError,
  polynomialSizeMessage,
} from '../src/cas/polynomial-limits.js';

// #1176: the polynomial reader bounded the degree but not the number of terms. A power such as
// (a+b+c+d+x)^21 has 12650 terms and took seconds; ^40 took 28 s and ^60 did not end in 100 s.
// The reader now refuses a polynomial of more than MAX_POLYNOMIAL_TERMS (10000) terms.
// The tests carry no timer: the test timeout and the external `timeout` of the check bound a
// regression, and a refusal of the huge power ends at once.

function termCount(text: string): number {
  return text.split(' + ').length;
}

describe('#1176 the polynomial reader has a term limit', () => {
  it('names the limit', () => {
    expect(MAX_POLYNOMIAL_TERMS).toBe(10_000);
    expect(new PolynomialSizeError()).toBeInstanceOf(RangeError);
    expect(new PolynomialSizeError().name).toBe('PolynomialSizeError');
    expect(polynomialSizeMessage()).toBe(
      'the polynomial has more than 10000 terms, the most that the CAS builds'
    );
  });

  it('refuses (a+b+c+d+x)^21, a polynomial of 12650 terms', () => {
    expect(() => expand('(a+b+c+d+x)^21')).toThrow(PolynomialSizeError);
    expect(() => expand('(a+b+c+d+x)^21')).toThrow(/more than 10000 terms/);
  });

  it('refuses (a+b+c+d+x)^20, a polynomial of 10626 terms', () => {
    expect(() => expand('(a+b+c+d+x)^20')).toThrow(/more than 10000 terms/);
  });

  it('refuses a huge power of five variables at once', () => {
    expect(() => expand('(a+b+c+d+x)^60')).toThrow(/more than 10000 terms/);
  });

  it('refuses a huge power of constants and a variable at once', () => {
    expect(() => expand('(pi+e+sqrt(2)+log(2)+x)^60')).toThrow(/more than 10000 terms/);
  });

  it('says that expand refused it', () => {
    expect(() => expand('(a+b+c+d+x)^60')).toThrow(/^expand: /);
  });

  it('keeps the degree error before the term error', () => {
    expect(() => expand('(x+y)^1000000000')).toThrow(RangeError);
    expect(() => expand('(x+y)^1000000000')).toThrow(/degree above 1000/);
    expect(() => expand('(x+1)^1001')).toThrow(/degree above 1000/);
  });

  it('still expands (a+b+c+d+x)^19, a polynomial of 8855 terms', () => {
    const text = expand('(a+b+c+d+x)^19');
    expect(termCount(text)).toBe(8855);
    expect(text.startsWith('a^19 + 19*a^18*b + ')).toBe(true);
  });

  it('still expands (x+1)^1000, a univariate polynomial of 1001 terms', () => {
    const text = expand('(x+1)^1000');
    expect(termCount(text)).toBe(1001);
    expect(text.startsWith('x^1000 + 1000*x^999 + ')).toBe(true);
    expect(text.endsWith(' + 1000*x + 1')).toBe(true);
  });

  it('still expands a dense univariate product of two long sums', () => {
    // 200 x 200 = 40000 products (four times the limit) with 399 distinct powers.
    const left = Array.from({ length: 200 }, (_, i) => `x^${i}`).join('+');
    const text = expand(`(${left})*(${left})`);
    expect(termCount(text)).toBe(399);
  });
});
