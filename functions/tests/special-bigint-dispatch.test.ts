import { describe, expect, it } from 'vitest';
import { erf, factorial, gamma, lgamma, typeOf } from '../src/index.js';

/**
 * Functions with a number signature and a BigNumber signature but no bigint
 * signature used to convert safe-integer bigints onto the BigNumber path.
 * mathjs 15.3.0 converts bigint → number instead. Explicit bigint rows call
 * the number implementation through bigintToNumber.
 */

describe('special-function bigint dispatch', () => {
  it('gamma(2n) is a number matching gamma(2)', () => {
    expect(typeOf(gamma(2n))).toBe('number');
    expect(gamma(2n)).toBe(gamma(2));
  });

  it('lgamma(2n) is a number matching lgamma(2)', () => {
    expect(typeOf(lgamma(2n))).toBe('number');
    expect(lgamma(2n)).toBe(lgamma(2));
  });

  it('factorial(2n) is a number matching factorial(2)', () => {
    expect(typeOf(factorial(2n))).toBe('number');
    expect(factorial(2n)).toBe(factorial(2));
  });

  it('erf(2n) is a number matching erf(2) (no BigNumber signature to steal the conversion)', () => {
    expect(typeOf(erf(2n))).toBe('number');
    expect(erf(2n)).toBe(erf(2));
  });

  it('rejects bigint outside the safe integer range', () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(() => gamma(huge)).toThrow(TypeError);
    expect(() => lgamma(huge)).toThrow(TypeError);
    expect(() => factorial(huge)).toThrow(TypeError);
  });
});
