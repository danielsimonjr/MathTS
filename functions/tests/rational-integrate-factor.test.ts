import { describe, it, expect } from 'vitest';
import { factorDenominator } from '../src/cas/rational-integrate.js';

describe('rational-integrate: denominator factorization', () => {
  it('x^3 + x = x(x^2+1): one linear, one negative-disc quadratic', () => {
    const fs = factorDenominator([0n, 1n, 0n, 1n])!; // x + x^3
    const kinds = fs.map((f) => f.kind).sort();
    expect(kinds).toEqual(['linear', 'quadratic-neg']);
  });
  it('x^2 - 2 (disc > 0, mult 1): positive-disc quadratic', () => {
    const fs = factorDenominator([-2n, 0n, 1n])!;
    expect(fs).toHaveLength(1);
    expect(fs[0].kind).toBe('quadratic-pos');
  });
  it('declines (x^2 - 2)^2: repeated positive-disc quadratic (Layer-3 boundary)', () => {
    // (x^2 - 2)^2 = x^4 - 4x^2 + 4
    expect(factorDenominator([4n, 0n, -4n, 0n, 1n])).toBeNull();
  });
  it('(x-1)^2 (x+2): repeated linear', () => {
    // (x-1)^2 (x+2) = x^3 - 3x + 2
    const fs = factorDenominator([2n, -3n, 0n, 1n])!;
    const lin = fs.find((f) => f.mult === 2)!;
    expect(lin.kind).toBe('linear');
    expect(lin.poly).toEqual([-1n, 1n]); // x - 1
  });
  it('declines a degree-3 irreducible denominator (Layer-2 boundary)', () => {
    // x^3 - 2 is irreducible over Q
    expect(factorDenominator([-2n, 0n, 0n, 1n])).toBeNull();
  });
});
