import { describe, it, expect } from 'vitest';
import {
  parseRationalFunction,
  polynomialPart,
  integratePolynomial,
} from '../src/cas/rational-integrate.js';

describe('rational-integrate: parse + polynomial part', () => {
  it('parses a rational function to integer numer/denom', () => {
    const rf = parseRationalFunction('(3*x+2)/(x^2+1)', 'x')!;
    expect(rf.numer).toEqual([2n, 3n]); // 2 + 3x
    expect(rf.denom).toEqual([1n, 0n, 1n]); // 1 + x^2
  });
  it('declines non-rational input', () => {
    expect(parseRationalFunction('sin(x)/x', 'x')).toBeNull();
  });
  it('splits the polynomial part: x^3/(x^2+1) = x + (-x)/(x^2+1)', () => {
    const rf = parseRationalFunction('x^3/(x^2+1)', 'x')!;
    const { quotient, remainder } = polynomialPart(rf);
    expect(quotient).toEqual([0n, 1n]); // x
    expect(remainder).toEqual([0n, -1n]); // -x
  });
  it('integrates a polynomial termwise', () => {
    // x -> x^2/2 ; the exact rendered form is checked by the integration suite,
    // here assert a differentiation-independent structural fact:
    expect(integratePolynomial([0n, 1n], 'x')).toContain('x^2');
  });
});
