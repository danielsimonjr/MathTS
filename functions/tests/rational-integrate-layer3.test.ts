import { describe, it, expect } from 'vitest';
import { symbolicIntegral, evaluate } from '../src/index.js';
import { integrateRationalFunction } from '../src/cas/rational-integrate.js';
import { resultantZ, rothsteinResultant, hermiteReduce } from '../src/cas/layer3.js';

const f = (e: string, x: number) => evaluate(e, { x }) as number;
function dF(F: string, x: number): number {
  const h = 1e-6;
  return (f(F, x + h) - f(F, x - h)) / (2 * h);
}

describe('layer3: resultant + Hermite primitives', () => {
  it('resultant(x-1, x-2) = 1 (difference of roots)', () => {
    expect(
      resultantZ([-1n, 1n], [-2n, 1n]) === 1n || resultantZ([-1n, 1n], [-2n, 1n]) === -1n
    ).toBe(true);
  });
  it('resultant(x^2+1, x) = 1', () => {
    expect(resultantZ([1n, 0n, 1n], [0n, 1n])).toBe(1n);
  });
  it('Rothstein–Trager resultant of 1/(x^2+1) is quadratic in t', () => {
    const R = rothsteinResultant([1n], [1n, 0n, 1n]);
    expect(R.length).toBeGreaterThan(1);
  });
  it('Hermite on an already square-free denom leaves it alone', () => {
    const h = hermiteReduce([1n], [1n, 0n, 1n], 'x');
    expect(h.rational).toBe('0');
    expect(h.squareFreeDenom).toEqual([1n, 0n, 1n]);
  });
});

describe('symbolicIntegral: Layer 3 (deg-≥3 irreducible)', () => {
  it('1/(x^3-2) is no longer a marker and differentiates back', () => {
    const F = symbolicIntegral('1/(x^3-2)', 'x');
    expect(F).not.toContain('integral(');
    for (const x of [0.4, 1.3, -0.7]) {
      expect(dF(F, x)).toBeCloseTo(f('1/(x^3-2)', x), 4);
    }
  });
  it('1/(x^3+x+1) differentiates back on the real line away from poles', () => {
    const F = symbolicIntegral('1/(x^3+x+1)', 'x');
    expect(F).not.toContain('integral(');
    for (const x of [0.2, 1.1, -0.4]) {
      expect(dF(F, x)).toBeCloseTo(f('1/(x^3+x+1)', x), 4);
    }
  });
  it('x/(x^3+1) (reducible cubic) still differentiates back', () => {
    const F = symbolicIntegral('x/(x^3+1)', 'x');
    expect(F).not.toContain('integral(');
    for (const x of [0.3, 1.4, -0.5]) {
      if (Math.abs(x + 1) < 0.2) continue;
      expect(dF(F, x)).toBeCloseTo(f('x/(x^3+1)', x), 4);
    }
  });
  it('integrateRationalFunction returns a string for a cubic irreducible', () => {
    const F = integrateRationalFunction('1/(x^3-2)', 'x');
    expect(F).not.toBeNull();
    expect(F).not.toContain('integral(');
  });
});

describe('symbolicIntegral: transcendental extras', () => {
  it('1/(x*log(x)) → log(log(x))', () => {
    const F = symbolicIntegral('1/(x*log(x))', 'x');
    expect(F).not.toContain('integral(');
    for (const x of [1.5, 2.2, 3.7]) {
      expect(dF(F, x)).toBeCloseTo(f('1/(x*log(x))', x), 5);
    }
  });
});
