import { describe, it, expect } from 'vitest';
import {
  makeMonicP,
  divmodP,
  gcdP,
  invModP,
  powModPolyP,
  type IntPoly,
} from '../../src/typed/factorization/finite-field.js';
import type { IntPoly as _ } from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);

describe('finite-field 𝔽_p', () => {
  it('inverse and monic mod p', () => {
    expect(invModP(2n, 5n)).toBe(3n); // 2*3=6≡1
    // 2x + 4 mod 5, monic -> x + 2
    expect(makeMonicP(P(4, 2), 5n)).toEqual(P(2, 1));
  });
  it('divmod and gcd mod p', () => {
    // (x^2 - 1) = (x+1)(x-1) mod 5 ; divide by (x-1)=(x+4)
    const { q, r } = divmodP(P(-1, 0, 1), P(-1, 1), 5n);
    expect(q).toEqual(P(1, 1));
    expect(r).toEqual(P()); // zero remainder
    // gcd(x^2-1, x^2-2x+1) mod 5 = x-1 (monic: x+4)
    expect(gcdP(P(-1, 0, 1), P(1, -2, 1), 5n)).toEqual(P(4, 1));
  });
  it('powModPolyP: x^5 ≡ x mod (x^2+1, 5) since x^2≡-1, x^4≡1, x^5≡x', () => {
    expect(powModPolyP(P(0, 1), 5n, P(1, 0, 1), 5n)).toEqual(P(0, 1));
  });
});
