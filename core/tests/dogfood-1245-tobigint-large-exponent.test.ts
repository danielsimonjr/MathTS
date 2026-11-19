/**
 * #1245: `BigNumber.toBigInt()` built a zero-padded string for a large exponent and parsed it.
 * It now multiplies the coefficient by a power of ten. It throws its own RangeError, before it builds
 * a power, only when the result is certainly above the V8 bigint limit of 2^30 bits (323231232
 * digits or more).
 */
import { describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const bn = (s: string): BigNumber => BigNumber.parse(s);

/** The truncated integer from the fixed-point text: a second method that builds no power of ten. */
function viaString(x: BigNumber): bigint {
  const [integerPart] = x.toFixed().split('.');
  return BigInt(integerPart);
}

/** A seeded generator (xorshift32), so every run tests the same values. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 2 ** 32;
  };
}

describe('#1245 toBigInt with a large exponent', () => {
  it('gives the exact value of 1e2000000 (main returned it, a 1e6 digit cap threw)', () => {
    const v = bn('1e2000000').toBigInt();
    expect(v === 10n ** 2000000n).toBe(true);
    const s = v.toString();
    expect(s.length).toBe(2000001);
    expect(s.startsWith('10000')).toBe(true);
    expect(s.endsWith('00000')).toBe(true);
  });

  it('gives the exact value of -2.5e1000000', () => {
    const s = bn('-2.5e1000000').toBigInt().toString();
    expect(s.length).toBe(1000002);
    expect(s.startsWith('-25000')).toBe(true);
    expect(s.endsWith('00000')).toBe(true);
  });

  it.each(['1e1000000000', '-1e1000000000', '1e100000000000', '1e1000000000000'])(
    '%s is above the V8 limit and throws the RangeError of the pre-check',
    (s) => {
      // The message is the one of the pre-check, which runs before any power is built. V8 has
      // another message (Maximum BigInt size exceeded) and gives it only after minutes of work.
      expect(() => bn(s).toBigInt()).toThrow(RangeError);
      expect(() => bn(s).toBigInt()).toThrow(/too large to convert to bigint/);
    }
  );

  it('rejects 323231232 digits, the smallest count whose minimum bit length the bound puts above 2^30', () => {
    // floor((323231232 - 1) * 3.3219) = 1073741826 >= 2^30, and floor((323231231 - 1) * 3.3219) is below.
    // The true minimum bit length of a 323231232-digit value is 1073750908, above the limit of 2^30.
    expect(Math.floor((323231232 - 1) * 3.3219)).toBeGreaterThanOrEqual(2 ** 30);
    expect(Math.floor((323231231 - 1) * 3.3219)).toBeLessThan(2 ** 30);
    expect(() => bn('1e323231231').toBigInt()).toThrow(/323231232 digits/);
    expect(() => bn('-123456789e323231223').toBigInt()).toThrow(/323231232 digits/);
  });

  it.each([2047, 2048, 2049, 5000])(
    'is exact on each side of the power cache, exponent %i',
    (e) => {
      expect(bn(`7e${e}`).toBigInt() === 7n * 10n ** BigInt(e)).toBe(true);
      expect(bn(`-123456789e${e}`).toBigInt() === -123456789n * 10n ** BigInt(e)).toBe(true);
      // A coefficient of e + 3 digits with the exponent -e keeps its first 3 digits.
      const digits = '987' + '6'.repeat(e);
      expect(bn(`${digits}e-${e}`).toBigInt()).toBe(987n);
      expect(bn(`-${digits}e-${e}`).toBigInt()).toBe(-987n);
    }
  );

  it.each([1, 17, 301, 2047, 2048, 2049, 4100])(
    'keeps the leading digit when the shift is one below the %i digits, and gives 0 at and above',
    (count) => {
      const digits = '9'.repeat(count);
      expect(bn(`${digits}e-${count - 1}`).toBigInt()).toBe(9n);
      expect(bn(`${digits}e-${count}`).toBigInt()).toBe(0n);
      expect(bn(`-${digits}e-${count + 1}`).toBigInt()).toBe(0n);
      expect(bn(`1${'0'.repeat(count - 1)}.5`).toBigInt() === 10n ** BigInt(count - 1)).toBe(true);
    }
  );

  it('agrees with the fixed-point text on 2000 seeded values', () => {
    const random = seeded(12451245);
    const int = (low: number, high: number): number =>
      low + Math.floor(random() * (high - low + 1));
    const digitString = (count: number): string => {
      let text = String(int(1, 9));
      for (let i = 1; i < count; i++) text += int(0, 9);
      return text;
    };
    let mismatches = 0;
    for (let i = 0; i < 2000; i++) {
      const sign = random() < 0.5 ? '-' : '';
      const kind = i % 5;
      let text: string;
      if (kind === 0) text = sign + digitString(int(1, 40));
      else if (kind === 1) text = `${sign}${digitString(int(1, 30))}.${digitString(int(1, 30))}`;
      else if (kind === 2) text = `${sign}${digitString(int(1, 25))}e${int(0, 2100)}`;
      else if (kind === 3) text = `${sign}${digitString(int(1, 400))}e-${int(0, 420)}`;
      else text = `${sign}${digitString(int(300, 2200))}e-${int(290, 2210)}`;
      const x = bn(text);
      if (x.toBigInt() !== viaString(x)) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it.each([
    ['0', 0n],
    ['-0', 0n],
    ['1e20', 10n ** 20n],
    ['-1.5e20', -150000000000000000000n],
    ['1.9', 1n],
    ['-1.9', -1n],
    ['0.5', 0n],
    ['-123.456', -123n],
    ['1e-5', 0n],
    ['1.5e-1000000000', 0n],
    ['12345678901234567890.99', 12345678901234567890n],
  ])('%s keeps the truncating result', (s, expected) => {
    expect(bn(s).toBigInt() === expected).toBe(true);
  });

  it('still throws for NaN and Infinity', () => {
    expect(() => bn('NaN').toBigInt()).toThrow('Cannot convert NaN or Infinity to bigint');
    expect(() => bn('Infinity').toBigInt()).toThrow('Cannot convert NaN or Infinity to bigint');
    expect(() => bn('-Infinity').toBigInt()).toThrow('Cannot convert NaN or Infinity to bigint');
  });
});
