import { describe, expect, it } from 'vitest';
import { runWithConfig, typeOf, zeta } from '../src/index.js';

describe('zeta(bigint) (#1585)', () => {
  it('returns a number in default number config (not BigNumber)', () => {
    expect(typeOf(zeta(2n))).toBe('number');
    expect(zeta(2n)).toBe(zeta(2));
    expect(typeOf(zeta(2))).toBe('number');
  });

  it('stays a number under BigNumber config (bigint→number, not BigNumber)', () => {
    runWithConfig({ number: 'BigNumber' }, () => {
      expect(typeOf(zeta(2n))).toBe('number');
      expect(zeta(2n)).toBe(zeta(2));
    });
  });

  it('rejects bigint outside the safe integer range', () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    const tiny = BigInt(Number.MIN_SAFE_INTEGER) - 1n;
    expect(() => zeta(huge)).toThrow(TypeError);
    expect(() => zeta(tiny)).toThrow(TypeError);
  });

  it('negative even integer is the trivial zero; s=1 is the pole', () => {
    expect(zeta(-2n)).toBe(0);
    expect(Number.isNaN(zeta(1n) as number)).toBe(true);
  });
});
