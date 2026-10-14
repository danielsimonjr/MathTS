/**
 * Review follow-ups for the exact-scale engine (#346):
 * - exactScaleToNumber must round correctly at any magnitude (incl. >~1e41)
 * - ExactScale carries named irrationals pi and ln2
 * - exactScaleToNumber caches so repeated conversions do not recompute
 * - number-valued A→B conversions round the exact ratio once
 */
import { describe, it, expect } from 'vitest';
import {
  ExactScale,
  UNIT_EXACT_SCALE,
  PI_EXACT_SCALE,
  LN2_EXACT_SCALE,
  binaryExactScale,
  exactScaleOf,
  exactScaleToNumber,
  ratioExactScale,
  multiplyExactScales,
  divideExactScales,
  powerExactScale,
  addExactScales,
  exactScalesEqual,
  formatExactScale,
  readScaleExpression,
  clearExactScaleNumberCache,
  exactScaleNumberCacheSize,
} from '../../src/types/unit/exact-scale';
import { Unit } from '../../src/types/unit';

/** Independent base-2 round of num/den (den > 0), ties to even. */
function binaryRound(num: bigint, den: bigint): number {
  if (num === 0n) return 0;
  const neg = num < 0n;
  let a = neg ? -num : num;
  const g = (x: bigint, y: bigint): bigint => {
    while (y !== 0n) [x, y] = [y, x % y];
    return x;
  };
  const d0 = g(a, den);
  a /= d0;
  let d = den / d0;
  let shift = 0;
  const scaled = (k: number): bigint => (k >= 0 ? (a << BigInt(k)) / d : a / (d << BigInt(-k)));
  while (scaled(shift) < 2n ** 52n) shift++;
  while (scaled(shift) >= 2n ** 53n) shift--;
  const n = shift >= 0 ? a << BigInt(shift) : a;
  const dd = shift >= 0 ? d : d << BigInt(-shift);
  let m = n / dd;
  const twice = 2n * (n % dd);
  if (twice > dd || (twice === dd && m % 2n === 1n)) m += 1n;
  if (m === 2n ** 53n) {
    m >>= 1n;
    shift -= 1;
  }
  const value = Number(m) * 2 ** -shift;
  return neg ? -value : value;
}

function nextUp(d: number): number {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, d);
  v.setBigUint64(0, v.getBigUint64(0) + 1n);
  return v.getFloat64(0);
}

describe('exactScaleToNumber rounds at any magnitude', () => {
  it('matches independent binary rounding for large and small results', () => {
    const cases: Array<[bigint, bigint]> = [
      [1n, 3n],
      [10n ** 40n, 3n],
      [10n ** 41n, 3n],
      [10n ** 60n, 7n],
      [10n ** 100n, 381n],
      [1n, 10n ** 50n],
      [10n ** 400n, 3n],
    ];
    for (const [num, den] of cases) {
      const got = exactScaleToNumber(ratioExactScale(num, den));
      const want = binaryRound(num, den);
      expect(got).toBe(want);
    }
  });

  it('rounds just above a midpoint up for magnitudes above 1e41', () => {
    const failures: string[] = [];
    for (const D of [1e17, 1e20, 1e30, 1e40, 1e41, 1e42, 1e50, 1e60, 1e100]) {
      if (!Number.isFinite(D)) continue;
      const lo = binaryExactScale(D).num;
      const hi = binaryExactScale(nextUp(D)).num;
      const tie = (lo + hi) / 2n;
      for (const den of [3n, 7n, 381n]) {
        for (const off of [1n, -1n] as const) {
          const num = tie * den + off;
          const got = exactScaleToNumber({ num, den, pi: 0, ln2: 0 });
          const want = off > 0n ? nextUp(D) : D;
          if (got !== want) failures.push(`D=${D} den=${den} off=${off}: got=${got} want=${want}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('ExactScale named irrationals', () => {
  it('carries ln2 like pi', () => {
    expect(LN2_EXACT_SCALE).toEqual({ num: 1n, den: 1n, pi: 0, ln2: 1 });
    expect(formatExactScale(LN2_EXACT_SCALE)).toBe('1*ln2');
    expect(readScaleExpression('ln2')).toEqual(LN2_EXACT_SCALE);
    expect(readScaleExpression('1/ln2')).toEqual({ num: 1n, den: 1n, pi: 0, ln2: -1 });
    expect(powerExactScale(LN2_EXACT_SCALE, 2)).toEqual({ num: 1n, den: 1n, pi: 0, ln2: 2 });
    expect(multiplyExactScales(PI_EXACT_SCALE, LN2_EXACT_SCALE)).toEqual({
      num: 1n,
      den: 1n,
      pi: 1,
      ln2: 1,
    });
    expect(addExactScales(PI_EXACT_SCALE, LN2_EXACT_SCALE)).toBeNull();
    expect(exactScalesEqual(UNIT_EXACT_SCALE, { num: 1n, den: 1n, pi: 0, ln2: 0 })).toBe(true);
  });

  it('rounds scales that include ln2 once', () => {
    const s = readScaleExpression('ln2');
    expect(exactScaleToNumber(s)).toBe(Math.LN2);
    // nat = 1/ln2 bits of information (nats to bits factor)
    expect(exactScaleToNumber(readScaleExpression('1/ln2'))).toBe(1 / Math.LN2);
  });
});

describe('exactScaleToNumber cache', () => {
  it('returns the same double without recomputing the ratio', () => {
    clearExactScaleNumberCache();
    expect(exactScaleNumberCacheSize()).toBe(0);
    const s = ratioExactScale(45359237n * 980665n, 254n ** 2n * 10n ** 5n); // psi rational
    const a = exactScaleToNumber(s);
    expect(exactScaleNumberCacheSize()).toBe(1);
    const b = exactScaleToNumber(s);
    expect(b).toBe(a);
    expect(exactScaleNumberCacheSize()).toBe(1);
    // equal-by-value different object still hits
    const s2: ExactScale = { num: s.num, den: s.den, pi: 0, ln2: 0 };
    expect(exactScaleToNumber(s2)).toBe(a);
    expect(exactScaleNumberCacheSize()).toBe(1);
  });
});

describe('number-valued conversions round the exact A→B ratio once', () => {
  it.each([
    [1, 'psi', 'kPa'],
    [1, 'parsec', 'ly'],
    [7, 'psi', 'atm'],
    [1, 'hp', 'kW'],
  ] as const)('%s %s → %s matches single exactScaleToNumber', (value, from, to) => {
    const fromS = Unit.exactScale(from)!;
    const toS = Unit.exactScale(to)!;
    const want = exactScaleToNumber(
      divideExactScales(multiplyExactScales(exactScaleOf(value), fromS), toS)
    );
    expect(new Unit(value, from).toNumeric(to)).toBe(want);
  });
});
