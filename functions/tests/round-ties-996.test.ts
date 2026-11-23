/**
 * #996: typed `round` rounds a tie away from zero for a number and a BigNumber, as mathjs 15.2.0
 * does, and `round(fraction, n)` and `round(complex, n)` work.
 *
 * Before, the typed `round` used `Math.round` for a number (`round(-2.5)` was -2), computed
 * `round(1.005, 2)` as 1, rounded a BigNumber with `'halfCeil'`, gave a BigNumber for
 * `round(fraction, n)`, and threw for `round(complex, n)`. The kernel is shared with the factory
 * `round`; the oracle is the mathjs devDependency (15.2.0), and the expected values below were
 * read from it. A number result is compared with `Object.is`: the tables rely on the sign of zero.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { BigNumber, Complex, Fraction } from '@danielsimonjr/mathts-core';
import * as math from '../src/index.js';
import { ROUND_DECIMALS_NOT_INTEGER } from '../src/utils/bignumber/round-decimals.js';

type Fn = (...a: unknown[]) => unknown;
const round = math.round as unknown as Fn;
const factoryRound = math.factory_round as unknown as Fn;
const bignumber = math.bignumber as unknown as Fn;
const fraction = math.fraction as unknown as Fn;
const complex = math.complex as unknown as Fn;
const matrix = math.matrix as unknown as (d: unknown) => { toArray(): unknown };
const sparse = math.sparse as unknown as (d: unknown) => { toArray(): unknown };
const config = math.config as unknown as (c?: Record<string, unknown>) => { relTol: number };
const mj = mathjs as unknown as Record<string, Fn>;

function same(got: unknown, want: unknown, label: string): void {
  expect(Object.is(got, want), `${label}: got ${String(got)}, want ${String(want)}`).toBe(true);
}

function sameList(got: ArrayLike<number>, want: number[], label: string): void {
  expect(got.length, `${label} length`).toBe(want.length);
  want.forEach((w, i) => same(got[i], w, `${label}[${i}]`));
}

function fractionParts(value: unknown): [bigint, bigint] {
  expect(value).toBeInstanceOf(Fraction);
  const f = value as Fraction;
  return [f.numerator, f.denominator];
}

/** Calls `fn(x, decimals)` for a count of 0 as the one-argument form. */
function call(fn: Fn, x: unknown, decimals: number): unknown {
  return decimals === 0 ? fn(x) : fn(x, decimals);
}

/** [x, decimals, result] with the default config; a 0 count is the one-argument `round`. */
const ROWS: Array<[number, number, number]> = [
  [2.5, 0, 3],
  [-2.5, 0, -3],
  [0.5, 0, 1],
  [-0.5, 0, -1],
  [-0.4, 0, -0],
  [0.49999999999999994, 0, 1],
  [4503599627370495.5, 0, 4503599627370496],
  [1.5e300, 0, 1.5e300],
  [NaN, 0, NaN],
  [-Infinity, 0, -Infinity],
  [1.005, 2, 1.01],
  [-1.005, 2, -1.01],
  [2.675, 2, 2.68],
  [1.45, 1, 1.5],
  [1.23456, 15, 1.23456],
  [Infinity, 2, Infinity],
  [-0, 0, 0],
  [0, 0, 0],
  [-1e-16, 0, 0],
  [-1e-15, 0, 0],
  [-1.1e-15, 0, -0],
  [-1e-13, 0, -0],
  [-5e-324, 0, 0],
  [0.4999999999995, 0, 1],
  [0.49999999999949, 0, 0],
  [2.4999999999995, 0, 3],
  [2.49999999999949, 0, 2],
  [-2.4999999999995, 0, -3],
  [-2.49999999999949, 0, -2],
  [1000000.4999999999, 0, 1000000],
  [0.5000000000000001, 0, 1],
  [-4503599627370495.5, 0, -4503599627370496],
  [4503599627370496, 0, 4503599627370496],
  [1e21, 0, 1e21],
  [-1.5e300, 0, -1.5e300],
  [-0, 2, 0],
  [-1e-16, 2, 0],
  [-0.004, 2, -0],
  [-1e-16, 13, -0],
  [-1.45, 1, -1.5],
  [8.345, 2, 8.35],
  [1.0049999999999, 2, 1.01],
  [0.1 + 0.2, 15, 0.3],
  [123456789.12345679, 9, 123456789.12345679],
  [0.000015, 5, 0.00002],
  [1.5e-7, 7, 2e-7],
  [2.5e-10, 9, 0],
  [5e-324, 15, 0],
  [1e21, 2, 1e21],
  [NaN, 3, NaN],
];

describe('typed round of a number follows mathjs (#996)', () => {
  for (const [x, decimals, want] of ROWS) {
    it(`round(${x}, ${decimals}) is ${Object.is(want, -0) ? '-0' : want}`, () => {
      same(call(round, x, decimals), want, `round(${x}, ${decimals})`);
      same(call(factoryRound, x, decimals), want, `factory_round(${x}, ${decimals})`);
      // The two-argument form takes the same kernel as the one-argument form for a count of 0.
      same(round(x, decimals), want, `round(${x}, ${decimals}) with the count`);
    });
  }

  it('equals mathjs.round on a seeded corpus (default config)', () => {
    let s = 4242n;
    const rnd = (): number => {
      s = (s * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
      return Number(s >> 11n) / 2 ** 53;
    };
    const view = new DataView(new ArrayBuffer(8));
    const nextUp = (x: number, steps: number): number => {
      view.setFloat64(0, x);
      view.setBigInt64(0, view.getBigInt64(0) + BigInt(x >= 0 ? steps : -steps));
      return view.getFloat64(0);
    };
    let total = 0;
    let first: string | undefined;
    const check = (x: number, d: number): void => {
      total++;
      const want = d === 0 ? mj.round(x) : mj.round(x, d);
      const got = d === 0 ? round(x) : round(x, d);
      if (!Object.is(got, want) && first === undefined) {
        first = `round(${x}, ${d}): got ${String(got)}, mathjs ${String(want)}`;
      }
    };
    for (let i = 0; i < 500; i++) {
      const d = Math.floor(rnd() * 16);
      const p = 10 ** d;
      const k = Math.floor((rnd() - 0.5) * 2 * 10 ** Math.floor(rnd() * 14));
      const tie = (k + 0.5) / p;
      for (let j = -3; j <= 3; j++) check(nextUp(tie, j), d);
      for (const gap of [5e-13, 1e-12, 1e-11, 1e-10]) {
        check(tie + gap / p, d);
        check(tie - gap / p, d);
      }
      check((rnd() - 0.5) * 10 ** (Math.floor(rnd() * 30) - 12), d);
      check((rnd() - 0.5) * 2000, d);
      check(nextUp(Math.floor((rnd() - 0.5) * 2e6) + 0.5, Math.floor(rnd() * 9) - 4), 0);
    }
    expect(total).toBeGreaterThan(8000);
    expect(first).toBeUndefined();
  });

  it('keeps a decimal count outside 0 to 15 as an extension (mathjs throws there)', () => {
    same(round(123.456, -1), 120, 'round(123.456, -1)');
    same(round(-25, -1), -30, 'round(-25, -1)');
    same(round(25, -1), 30, 'round(25, -1)');
    same(round(1234.5, -2), 1200, 'round(1234.5, -2)');
    same(round(1.2345678901234567, 16), 1.2345678901234567, 'round(1.2345678901234567, 16)');
    same(round(2.5, NaN), NaN, 'round(2.5, NaN)');
  });
});

describe('typed round of a collection (#996)', () => {
  it('an array', () => {
    sameList(round([-2.5, 1.5]) as number[], [-3, 2], 'round([-2.5, 1.5])');
  });

  it('a dense matrix', () => {
    const m = round(matrix([-2.5, 1.5])) as { toArray(): number[] };
    sameList(m.toArray(), [-3, 2], 'round(matrix([-2.5, 1.5]))');
  });

  it('a Float64Array keeps the sign of zero as the scalar does', () => {
    const out = round(new Float64Array([-2.5, 0.5, -0.4, -0, -1e-300])) as Float64Array;
    sameList(out, [-3, 1, -0, 0, 0], 'round(Float64Array)');
  });

  it('a sparse matrix', () => {
    const out = (
      round(
        sparse([
          [2.5, 0],
          [0, -2.5],
        ])
      ) as { toArray(): number[][] }
    ).toArray();
    expect(out[0][0]).toBe(3);
    expect(out[1][1]).toBe(-3);
  });
});

describe('typed round of the other types (#996)', () => {
  it('a BigNumber tie goes away from zero', () => {
    expect(String(round(bignumber(-2.5)))).toBe('-3');
    expect(String(round(bignumber(2.5)))).toBe('3');
  });

  it('a BigNumber within relTol below a tie takes the snap, as mathjs does', () => {
    expect(String(round(bignumber('0.49999999999999999999')))).toBe('1');
  });

  it('a Fraction tie goes toward +Infinity (unchanged)', () => {
    expect(fractionParts(round(fraction(-5, 2)))).toEqual([-2n, 1n]);
  });

  it('a Complex rounds each part with the Complex rule (unchanged)', () => {
    const r = round(complex(-2.5, 2.5)) as Complex;
    expect([r.re, r.im]).toEqual([-2, 3]);
  });
});

describe('typed round(fraction, n) returns a Fraction (#996, R1)', () => {
  // [numerator, denominator, places, result numerator, result denominator]
  const rows: Array<[number, number, number, bigint, bigint]> = [
    [-201, 200, 2, -1n, 1n],
    [201, 200, 2, 101n, 100n],
    [1, 3, 3, 333n, 1000n],
    [-1, 3, 3, -333n, 1000n],
    [7, 8, 2, 22n, 25n],
    [-7, 8, 2, -87n, 100n],
    [1, 8, 2, 13n, 100n],
    [-1, 8, 2, -3n, 25n],
    [12345, 100, 1, 247n, 2n],
    [-12345, 100, 1, -617n, 5n],
    [5, 2, 20, 5n, 2n],
    [5, 2, 0, 3n, 1n],
    [-5, 2, 0, -2n, 1n],
  ];
  for (const [n, d, places, rn, rd] of rows) {
    it(`round(fraction(${n}, ${d}), ${places}) is ${rn}/${rd}`, () => {
      expect(fractionParts(round(fraction(n, d), places))).toEqual([rn, rd]);
      expect(fractionParts(factoryRound(fraction(n, d), places))).toEqual([rn, rd]);
    });
  }

  it('a BigNumber count', () => {
    expect(fractionParts(round(fraction(7, 8), bignumber(2)))).toEqual([22n, 25n]);
  });

  it('a negative count rounds (extension: mathjs throws a RangeError)', () => {
    expect(fractionParts(round(fraction(12345, 100), -1))).toEqual([120n, 1n]);
  });

  it('a count that is not an integer throws a TypeError', () => {
    expect(() => round(fraction(5, 2), 1.5)).toThrow(TypeError);
    expect(() => round(fraction(5, 2), 1.5)).toThrow(ROUND_DECIMALS_NOT_INTEGER);
    expect(() => round(fraction(7, 8), bignumber(1.5))).toThrow(TypeError);
    expect(() => round(fraction(7, 8), bignumber(1.5))).toThrow(ROUND_DECIMALS_NOT_INTEGER);
  });

  it('the TypeError message of core equals the message of functions', () => {
    expect(() => new Fraction(5n, 2n).round(1.5)).toThrow(ROUND_DECIMALS_NOT_INTEGER);
  });
});

describe('typed round(complex, n) works as in mathjs (#996, R3)', () => {
  // [re, im, count, result re, result im]
  const rows: Array<[number, number, number, number, number]> = [
    [1.005, -1.005, 2, 1, -1],
    [2.345, -2.345, 2, 2.35, -2.35],
    [1.25, -1.25, 1, 1.3, -1.2],
    [1.23456789, 9.87654321, 5, 1.23457, 9.87654],
    [123.456, -123.456, -1, 120, -120],
    [-2.5, 2.5, 0, -2, 3],
  ];
  for (const [re, im, places, wantRe, wantIm] of rows) {
    it(`round(complex(${re}, ${im}), ${places}) is ${wantRe} + ${wantIm}i`, () => {
      const z = round(complex(re, im), places) as Complex;
      expect(z).toBeInstanceOf(Complex);
      same(z.re, wantRe, 're');
      same(z.im, wantIm, 'im');
      const f = factoryRound(complex(re, im), places) as Complex;
      same(f.re, wantRe, 'factory re');
      same(f.im, wantIm, 'factory im');
    });
  }

  it('a BigNumber count', () => {
    const z = round(complex(1.25, 2.5), bignumber(1)) as Complex;
    expect([z.re, z.im]).toEqual([1.3, 2.5]);
  });

  it('a count that is not an integer throws a TypeError', () => {
    expect(() => round(complex(1.5, 2.5), 1.5)).toThrow(TypeError);
    expect(() => round(complex(1.5, 2.5), 1.5)).toThrow(ROUND_DECIMALS_NOT_INTEGER);
    expect(() => round(complex(1.25, 2.5), bignumber(1.5))).toThrow(TypeError);
    expect(() => round(complex(1.25, 2.5), bignumber(1.5))).toThrow(ROUND_DECIMALS_NOT_INTEGER);
  });
});

describe('the new rows do not capture a call that another row took (#996)', () => {
  it('a number and a BigNumber count is still a BigNumber', () => {
    const r = round(2.55, bignumber(1));
    expect(r).toBeInstanceOf(BigNumber);
    expect(String(r)).toBe('2.6');
  });

  it('a string and a boolean still convert to a number', () => {
    same(round('2.5'), 3, "round('2.5')");
    same(round(true), 1, 'round(true)');
    same(round(true, 1), 1, 'round(true, 1)');
    same(round('2.55', 1), 2.6, "round('2.55', 1)");
  });

  it('a BigNumber and a number count is still a BigNumber', () => {
    const r = round(bignumber('2.345'), 2);
    expect(r).toBeInstanceOf(BigNumber);
    expect(String(r)).toBe('2.35');
  });
});

describe('typed round preserves bigint inputs (#1339)', () => {
  it.each([
    ['round(5n)', () => round(5n)],
    ['round(5n, 2)', () => round(5n, 2)],
    ['round(5n, bignumber(2))', () => round(5n, bignumber(2))],
  ])('%s returns 5n', (_label, call) => {
    expect(call()).toBe(5n);
  });
});

describe('typed round follows the live config (#996)', () => {
  it('relTol of the config moves the snap window, for a scalar, a Float64Array and an array', () => {
    const before = config().relTol;
    config({ relTol: 1e-3 });
    try {
      same(round(2.4996), 3, 'round(2.4996) with relTol 1e-3');
      same((round(new Float64Array([2.4996])) as Float64Array)[0], 3, 'Float64Array');
      same((round([2.4996]) as number[])[0], 3, 'array');
    } finally {
      config({ relTol: before });
    }
    same(round(2.4996), 2, 'round(2.4996) with the default relTol');
  });
});
