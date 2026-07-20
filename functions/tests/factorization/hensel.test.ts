import { describe, it, expect } from 'vitest';
import { henselLift } from '../../src/typed/factorization/hensel.js';
import { factorModP } from '../../src/typed/factorization/finite-field.js';
import { mul, modSymmetric, type IntPoly } from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);

describe('Hensel lifting', () => {
  it('lifts x^2-1 factors from mod 5 to mod 25 and reconstructs f', () => {
    const f = P(-1, 0, 1); // x^2 - 1 = (x-1)(x+1)
    const modp = factorModP(f, 5n);
    const lifted = henselLift(f, modp, 5n, 25n);
    let prod = P(1);
    for (const g of lifted) prod = mul(prod, g);
    expect(modSymmetric(prod, 25n)).toEqual(f); // exact over Z after symmetric reduce
  });
  it('lifted factors multiply back to f mod p^k for a larger case', () => {
    // f = x^3 - 2 (irreducible over Q but this checks the lift arithmetic,
    // product congruence mod p^k), p=5, target 125
    const f = P(-2, 0, 0, 1);
    const modp = factorModP(f, 5n);
    const lifted = henselLift(f, modp, 5n, 125n);
    let prod = P(1);
    for (const g of lifted) prod = mul(prod, g);
    expect(modSymmetric(prod, 125n)).toEqual(f);
  });
});
