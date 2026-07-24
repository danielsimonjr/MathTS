import { describe, it, expect } from 'vitest';
import { factorModP, makeMonicP, mulP } from '../../src/typed/factorization/finite-field.js';
import type { IntPoly } from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);
const sortByDeg = (fs: IntPoly[]) =>
  [...fs].sort((a, b) => a.length - b.length || Number(a[0] - b[0]));

describe('factor mod p', () => {
  it('x^2+1 splits mod 5 into (x+2)(x-2)', () => {
    // sympy: modulus=5 -> (x+2)(x-2); as monic in [0,5): (x+2),(x+3)
    const fs = sortByDeg(factorModP(P(1, 0, 1), 5n));
    expect(fs).toEqual([P(2, 1), P(3, 1)]);
  });
  it('x^2+1 is irreducible mod 7', () => {
    expect(factorModP(P(1, 0, 1), 7n)).toEqual([P(1, 0, 1)]);
  });
  it('product of returned factors reconstructs the input (monic) mod p', () => {
    // x^3 + x + 1 mod 2 is irreducible; mod 3 factor and re-multiply
    const f = P(1, 1, 0, 1); // 1 + x + x^3
    const fs = factorModP(f, 3n);
    let prod = P(1);
    for (const g of fs) prod = mulP(prod, g, 3n);
    expect(makeMonicP(prod, 3n)).toEqual(makeMonicP(f, 3n));
  });
});
