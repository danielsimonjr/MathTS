/**
 * Review follow-ups for the exact-scale engine (#346):
 * - exactScaleToNumber must round correctly at any magnitude (incl. >~1e41 and subnormals)
 * - ExactScale carries named irrationals pi and ln2, with correct ln2 digits
 * - exactScaleToNumber caches so repeated conversions do not recompute, within a bound
 * - number-valued A→B conversions round the exact ratio once, while the reading is unchanged
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
  exactScaleNumberCacheHas,
  EXACT_SCALE_NUMBER_CACHE_LIMIT,
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
          const got = exactScaleToNumber({ num, den, irrationals: {} });
          const want = off > 0n ? nextUp(D) : D;
          if (got !== want) failures.push(`D=${D} den=${den} off=${off}: got=${got} want=${want}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

/** The 64-bit pattern of a double: tells +0 from -0 and pins an exact result. */
function bitsOf(d: number): string {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, d);
  return v.getBigUint64(0).toString(16).padStart(16, '0');
}

/** `{ pi, ln2 }` with the zero powers left out, the shape ExactScale stores. */
const powers = (pi: number, ln2: number) => ({ ...(pi ? { pi } : {}), ...(ln2 ? { ln2 } : {}) });

describe('exactScaleToNumber below the smallest normal double (subnormals)', () => {
  // The bit patterns come from Python's correctly rounded int / int true division
  // (fractions.Fraction.__float__), with pi and ln 2 to 450 digits. They do not come
  // from this module's own rounding.
  const cases: Array<[string, bigint, bigint, number, number, string]> = [
    ['1 / 2^1074, the smallest subnormal', 1n, 1n << 1074n, 0, 0, '0000000000000001'],
    ['1 / 2^1075, a tie that rounds to even zero', 1n, 1n << 1075n, 0, 0, '0000000000000000'],
    ['3 / 2^1076, 0.75 ulp rounds up', 3n, 1n << 1076n, 0, 0, '0000000000000001'],
    ['3 / 2^1075, 1.5 ulp ties to even 2', 3n, 1n << 1075n, 0, 0, '0000000000000002'],
    ['5 / 2^1075, 2.5 ulp ties to even 2', 5n, 1n << 1075n, 0, 0, '0000000000000002'],
    [
      '(2^52 - 1) / 2^1074, the largest subnormal',
      (1n << 52n) - 1n,
      1n << 1074n,
      0,
      0,
      '000fffffffffffff',
    ],
    [
      '(2^54 - 1) / 2^1076 rounds up to the smallest normal',
      (1n << 54n) - 1n,
      1n << 1076n,
      0,
      0,
      '0010000000000000',
    ],
    ['-1 / 2^1075, a negative tie gives negative zero', -1n, 1n << 1075n, 0, 0, '8000000000000000'],
    ['7 / 10^310', 7n, 10n ** 310n, 0, 0, '000080dbd0164b2d'],
    ['-3 / 10^320', -3n, 10n ** 320n, 0, 0, '80000000000017b8'],
    ['pi / 10^320', 1n, 10n ** 320n, 1, 0, '00000000000018d7'],
    ['1 / (ln2 * 10^320)', 1n, 10n ** 320n, 0, -1, '0000000000000b68'],
    [
      'ln2 / (pi * 10^323) is below half the smallest subnormal',
      1n,
      10n ** 323n,
      -1,
      1,
      '0000000000000000',
    ],
  ];

  it.each(cases)('%s', (_name, num, den, pi, ln2, bits) => {
    expect(bitsOf(exactScaleToNumber({ num, den, irrationals: powers(pi, ln2) }))).toBe(bits);
  });

  it('agrees with the engine parse of a decimal literal across the subnormal range', () => {
    const failures: string[] = [];
    const digitsList = [
      '1',
      '2.5',
      '4.9406564584124654',
      '7',
      '9.999999999999999',
      '2.2250738585072011',
    ];
    for (let e = -324; e <= -300; e++) {
      for (const digits of digitsList) {
        const text = digits + 'e' + e;
        const got = exactScaleToNumber(readScaleExpression(text));
        const want = Number(text);
        if (!Object.is(got, want)) failures.push(text + ': got=' + got + ' want=' + want);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('exactScaleToNumber with ln2 next to a rounding midpoint', () => {
  // ln 2 to 140 places, from an independent computation (the series sum of 1 / (k 2^k)).
  const LN2_REF =
    69314718055994530941723212145817656807550013436025525412068000949339362196969471560586332699641868754200148102057068573368552023575813055703n;
  const TWO53 = 1n << 53n;
  // 1 + 2^-53 lies exactly between the doubles 1 and 1 + 2^-52.
  const SCALE = 10n ** 112n;

  it('rounds r * ln2 down when it lies about 1e-113 below the midpoint', () => {
    // r = floor(midpoint / ln2) at 112 places, so r * ln2 is just below 1 + 2^-53.
    const r = ((TWO53 + 1n) * 10n ** 252n) / (TWO53 * LN2_REF);
    const scale: ExactScale = { num: r, den: SCALE, irrationals: { ln2: 1 } };
    expect(exactScaleToNumber(scale)).toBe(1);
  });

  it('rounds r / ln2 up when it lies about 1e-112 above the midpoint', () => {
    // r = ceil(midpoint * ln2) at 112 places, so r / ln2 is just above 1 + 2^-53.
    const top = (TWO53 + 1n) * LN2_REF * SCALE;
    const bottom = TWO53 * 10n ** 140n;
    const r = (top + bottom - 1n) / bottom;
    const scale: ExactScale = { num: r, den: SCALE, irrationals: { ln2: -1 } };
    expect(exactScaleToNumber(scale)).toBe(1 + 2 ** -52);
  });
});

describe('exactScaleToNumber memo bound', () => {
  const reading = (i: number) => ratioExactScale(BigInt(i), 7n);

  it('stays bounded when many distinct readings are converted', () => {
    clearExactScaleNumberCache();
    for (let i = 1; i <= EXACT_SCALE_NUMBER_CACHE_LIMIT * 3; i++) exactScaleToNumber(reading(i));
    expect(exactScaleNumberCacheSize()).toBe(EXACT_SCALE_NUMBER_CACHE_LIMIT);
  });

  it('drops the entry used longest ago and keeps one that is read again', () => {
    clearExactScaleNumberCache();
    const hot = ratioExactScale(45359237n * 980665n, 254n ** 2n * 10n ** 5n);
    const hotValue = exactScaleToNumber(hot);
    for (let i = 1; i <= EXACT_SCALE_NUMBER_CACHE_LIMIT * 3; i++) {
      exactScaleToNumber(reading(i));
      if (i % 8 === 0) exactScaleToNumber(hot);
    }
    expect(exactScaleNumberCacheHas(hot)).toBe(true);
    expect(exactScaleNumberCacheHas(reading(1))).toBe(false);
    expect(exactScaleNumberCacheHas(reading(EXACT_SCALE_NUMBER_CACHE_LIMIT * 3))).toBe(true);
    expect(exactScaleToNumber(hot)).toBe(hotValue);
  });

  it('answers the same value for an evicted reading', () => {
    clearExactScaleNumberCache();
    const first = exactScaleToNumber(reading(1));
    for (let i = 2; i <= EXACT_SCALE_NUMBER_CACHE_LIMIT + 2; i++) exactScaleToNumber(reading(i));
    expect(exactScaleNumberCacheHas(reading(1))).toBe(false);
    expect(exactScaleToNumber(reading(1))).toBe(first);
  });
});

describe('exactScaleToNumber at the top of the range and at the screens', () => {
  const MAX_MANTISSA = (1n << 53n) - 1n; // Number.MAX_VALUE = MAX_MANTISSA * 2^971
  const tieAboveMax = ((1n << 54n) - 1n) << 970n; // MAX_VALUE + half an ulp: ties to even, which is 2^1024
  const at = (num: bigint, den = 1n) => exactScaleToNumber({ num, den, irrationals: {} });

  it('keeps the largest finite double and overflows only at the tie', () => {
    expect(at(MAX_MANTISSA << 971n)).toBe(Number.MAX_VALUE);
    expect(at(tieAboveMax - 1n)).toBe(Number.MAX_VALUE);
    expect(at(tieAboveMax)).toBe(Infinity);
    expect(at(-tieAboveMax)).toBe(-Infinity);
    expect(at(-(tieAboveMax - 1n))).toBe(-Number.MAX_VALUE);
  });

  it('rounds the carry into the next binade', () => {
    expect(at((1n << 54n) - 1n, 2n)).toBe(2 ** 53); // 2^53 - 1/2 ties to even
    expect(at((1n << 54n) - 3n, 2n)).toBe(2 ** 53 - 2); // 2^53 - 3/2 ties to even
  });

  it('answers at both magnitude screens', () => {
    expect(at(1n << 1024n)).toBe(Infinity);
    expect(at((1n << 1024n) - 1n)).toBe(Infinity);
    expect(at(1n, 1n << 1081n)).toBe(0);
    expect(at(1n, 1n << 1076n)).toBe(0);
  });
});

describe('ExactScale named irrationals', () => {
  it('carries ln2 like pi', () => {
    expect(LN2_EXACT_SCALE).toEqual({ num: 1n, den: 1n, irrationals: { ln2: 1 } });
    expect(formatExactScale(LN2_EXACT_SCALE)).toBe('1*ln2');
    expect(readScaleExpression('ln2')).toEqual(LN2_EXACT_SCALE);
    expect(readScaleExpression('1/ln2')).toEqual({ num: 1n, den: 1n, irrationals: { ln2: -1 } });
    expect(powerExactScale(LN2_EXACT_SCALE, 2)).toEqual({
      num: 1n,
      den: 1n,
      irrationals: { ln2: 2 },
    });
    expect(multiplyExactScales(PI_EXACT_SCALE, LN2_EXACT_SCALE)).toEqual({
      num: 1n,
      den: 1n,
      irrationals: { pi: 1, ln2: 1 },
    });
    expect(addExactScales(PI_EXACT_SCALE, LN2_EXACT_SCALE)).toBeNull();
    expect(exactScalesEqual(UNIT_EXACT_SCALE, { num: 1n, den: 1n, irrationals: {} })).toBe(true);
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
    const s2: ExactScale = { num: s.num, den: s.den, irrationals: {} };
    expect(exactScaleToNumber(s2)).toBe(a);
    expect(exactScaleNumberCacheSize()).toBe(1);
  });
});

describe('a stored exact quantity is used only while the value still matches it', () => {
  it('converts the absolute value of a negative kelvin reading', () => {
    expect(new Unit(-5, 'K').abs().toNumeric('degC')).toBeCloseTo(-268.15, 10);
    expect(new Unit(-5, 'K').abs().to('degC').toNumeric('degC')).toBeCloseTo(-268.15, 10);
  });

  it('converts the absolute value of a degC reading below the offset', () => {
    expect(new Unit(-300, 'degC').abs().to('K').toNumeric('K')).toBeCloseTo(26.85, 9);
  });

  it('converts a clone whose value was assigned afterwards', () => {
    const copy = new Unit(300, 'K').clone();
    copy.value = 305;
    expect(copy.to('degC').toNumeric('degC')).toBeCloseTo(31.85, 10);
  });

  it('keeps the single rounding for a reading that was not edited', () => {
    // 0.1 K as degC is exactly -273.05; two roundings through doubles give -273.04999999999995.
    expect(new Unit(0.1, 'K').to('degC').toNumeric('degC')).toBe(-273.05);
    expect(new Unit(0.1, 'K').clone().to('degC').toNumeric('degC')).toBe(-273.05);
    expect(new Unit(0.1, 'K').abs().to('degC').toNumeric('degC')).toBe(-273.05);
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
