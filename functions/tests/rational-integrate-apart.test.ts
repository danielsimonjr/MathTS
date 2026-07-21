import { describe, it, expect } from 'vitest';
import {
  parseRationalFunction,
  polynomialPart,
  factorDenominator,
  partialFractions,
} from '../src/cas/rational-integrate.js';

// Evaluate the PF decomposition numerically and compare to remainder/denom.
function pfValue(terms: ReturnType<typeof partialFractions>, x: number): number {
  let s = 0;
  for (const t of terms) {
    let n = 0;
    for (let i = t.numer.length - 1; i >= 0; i--)
      n = n * x + Number(t.numer[i].num) / Number(t.numer[i].den);
    let f = 0;
    for (let i = t.factor.length - 1; i >= 0; i--) f = f * x + Number(t.factor[i]);
    s += n / Math.pow(f, t.power);
  }
  return s;
}
const polyVal = (p: bigint[], x: number) => {
  let s = 0;
  for (let i = p.length - 1; i >= 0; i--) s = s * x + Number(p[i]);
  return s;
};

describe('rational-integrate: partial fractions (exact Q)', () => {
  it('(3x+2)/(x^2+1): single quadratic term equals the input', () => {
    const rf = parseRationalFunction('(3*x+2)/(x^2+1)', 'x')!;
    const { remainder } = polynomialPart(rf);
    const terms = partialFractions(remainder, factorDenominator(rf.denom)!);
    for (const x of [0.3, 2, -1.5])
      expect(pfValue(terms, x)).toBeCloseTo(polyVal(remainder, x) / polyVal(rf.denom, x), 8);
  });
  it('1/((x-1)^2 (x+2)) reconstructs', () => {
    const rf = parseRationalFunction('1/((x-1)^2*(x+2))', 'x')!;
    const { remainder } = polynomialPart(rf);
    const terms = partialFractions(remainder, factorDenominator(rf.denom)!);
    for (const x of [0.3, 2, 3.5])
      expect(pfValue(terms, x)).toBeCloseTo(polyVal(remainder, x) / polyVal(rf.denom, x), 8);
  });
});
