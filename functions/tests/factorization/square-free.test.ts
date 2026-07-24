import { describe, it, expect } from 'vitest';
import { squareFreeDecompose } from '../../src/typed/factorization/square-free.js';
import { type IntPoly } from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);

describe('Yun square-free decomposition', () => {
  it('(x-1)^2 (x+2): mult-2 part is (x-1), mult-1 part is (x+2)', () => {
    // f = (x-1)^2 (x+2) = (x^2-2x+1)(x+2) = x^3 - 3x + 2
    const f = P(2, -3, 0, 1);
    const d = squareFreeDecompose(f);
    const m1 = d.find((e) => e.mult === 1)!.factor;
    const m2 = d.find((e) => e.mult === 2)!.factor;
    expect(m2).toEqual(P(-1, 1)); // x - 1
    expect(m1).toEqual(P(2, 1)); // x + 2
  });
  it('square-free input returns itself at mult 1', () => {
    // x^2 - 1
    expect(squareFreeDecompose(P(-1, 0, 1))).toEqual([{ factor: P(-1, 0, 1), mult: 1 }]);
  });
});
