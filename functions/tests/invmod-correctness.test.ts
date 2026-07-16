import { describe, it, expect } from 'vitest';
import { invmod } from '../src/index.js';

describe('invmod (modular multiplicative inverse)', () => {
  it('invmod(3, 11) = 4  (3·4 = 12 ≡ 1 mod 11)', () => {
    expect(invmod(3, 11)).toBe(4);
  });
  it('invmod(7, 13) = 2', () => {
    expect(invmod(7, 13)).toBe(2);
  });
  it('invmod(15151, 15122) = 10429', () => {
    expect(invmod(15151, 15122)).toBe(10429);
  });
  it('returns NaN when a,b are not coprime (invmod(8,12))', () => {
    expect(Number.isNaN(invmod(8, 12) as number)).toBe(true);
  });
});
