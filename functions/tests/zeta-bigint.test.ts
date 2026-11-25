import { describe, expect, it } from 'vitest';
import { typeOf, zeta } from '../src/factories/index.js';

describe('zeta(bigint) (#1585)', () => {
  it('returns a number in default number config (not BigNumber)', () => {
    expect(typeOf(zeta(2n))).toBe('number');
    expect(zeta(2n)).toBe(zeta(2));
    expect(typeOf(zeta(2))).toBe('number');
  });

  it('rejects bigint outside the safe integer range', () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(() => zeta(huge)).toThrow(TypeError);
  });
});
