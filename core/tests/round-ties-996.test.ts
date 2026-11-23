/**
 * #996: `round` rounds a tie away from zero for a number and a BigNumber, as mathjs 15.2.0 does.
 *
 * Before, core rounded a number with `Math.round` (a tie goes toward +Infinity: `round(-2.5)` was
 * -2), a BigNumber with `'halfCeil'`, and it ignored the decimal count. The new kernel
 * (`roundNumberTol`) is the contract of the issue: snap to the `relTol` decimals, then round the
 * shortest decimal string, half away from zero. Every expected value is the mathjs 15.2.0 result.
 *
 * Two more items ship with it: core `round(x, decimals)` uses its second argument, and
 * `Fraction.round(places)` rounds to a decimal count (a Fraction result).
 *
 * A number result is compared with `Object.is`: the tables rely on the sign of zero.
 */
import { describe, it, expect } from 'vitest';
import {
  roundHalfAway,
  roundNumberTol,
  roundNumberTolExact,
  roundNumberWide,
} from '../src/number.js';
import { round } from '../src/arithmetic/scalar.js';
import { BigNumber } from '../src/types/bignumber.js';
import { Complex } from '../src/types/complex.js';
import { Fraction } from '../src/types/fraction.js';

const REL = 1e-12;
const ABS = 1e-15;
const RANGE_MESSAGE =
  'Number of decimals in function round must be an integer from 0 to 15 inclusive';
const NOT_INTEGER_MESSAGE = 'Number of decimals in function round must be an integer';

/** `Object.is` with both values in the failure message (it tells -0 from 0). */
function same(got: unknown, want: unknown, label: string): void {
  expect(Object.is(got, want), `${label}: got ${String(got)}, want ${String(want)}`).toBe(true);
}

/** [x, decimals, result] with the default tolerances; a 0 count is the one-argument `round`. */
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

describe('roundNumberTol follows the mathjs rule (#996)', () => {
  for (const [x, decimals, want] of ROWS) {
    it(`round(${x}, ${decimals}) is ${Object.is(want, -0) ? '-0' : want}`, () => {
      same(roundNumberTol(x, decimals, REL, ABS), want, `roundNumberTol(${x}, ${decimals})`);
      same(
        roundNumberTolExact(x, decimals, REL, ABS),
        want,
        `roundNumberTolExact(${x}, ${decimals})`
      );
    });
  }

  it('a decimal count outside the integers 0 to 15 throws', () => {
    for (const bad of [16, -1, 1.5, NaN]) {
      expect(() => roundNumberTol(1.5, bad, REL, ABS), `decimals ${bad}`).toThrow(RANGE_MESSAGE);
    }
  });

  it('the exponent of relTol is capped at 15: a relTol below 1e-15 rounds and does not throw', () => {
    same(roundNumberTol(2.5, 0, 1e-16, ABS), 3, 'round(2.5)');
    same(roundNumberTol(0.49999999999999994, 0, 1e-16, ABS), 1, 'round(0.49999999999999994)');
  });

  it('a bad tolerance still throws the nearlyEqual error', () => {
    expect(() => roundNumberTol(2.3, 0, -1e-12, ABS)).toThrow(
      'Relative tolerance must be greater than 0'
    );
    expect(() => roundNumberTol(2.3, 0, REL, -1)).toThrow('Absolute tolerance must be at least 0');
  });
});

describe('roundNumberWide keeps a count outside 0 to 15 as an extension (#996)', () => {
  it('rounds to tens with the tie away from zero', () => {
    same(roundNumberWide(123.456, -1, REL, ABS), 120, 'round(123.456, -1)');
    same(roundNumberWide(-25, -1, REL, ABS), -30, 'round(-25, -1)');
    same(roundNumberWide(25, -1, REL, ABS), 30, 'round(25, -1)');
  });

  it('takes the kernel for a count from 0 to 15', () => {
    same(roundNumberWide(1.005, 2, REL, ABS), 1.01, 'round(1.005, 2)');
  });

  it('roundHalfAway rounds a tie away from zero and keeps the sign of a small negative value', () => {
    same(roundHalfAway(2.5), 3, 'roundHalfAway(2.5)');
    same(roundHalfAway(-2.5), -3, 'roundHalfAway(-2.5)');
    same(roundHalfAway(-0.4), -0, 'roundHalfAway(-0.4)');
  });
});

describe('core round of a number (#996)', () => {
  for (const [x, decimals, want] of ROWS) {
    it(`round(${x}${decimals === 0 ? '' : `, ${decimals}`}) is ${Object.is(want, -0) ? '-0' : want}`, () => {
      const got = decimals === 0 ? round(x) : round(x, decimals);
      same(got, want, `round(${x}, ${decimals})`);
    });
  }

  it('the default decimal count is 0', () => {
    same(round(2.5), 3, 'round(2.5)');
    same(round(2.5, 0), 3, 'round(2.5, 0)');
  });

  it('round(123.456, -1) is 120 (extension)', () => {
    same(round(123.456, -1), 120, 'round(123.456, -1)');
  });
});

/** Seeded generator (no `Math.random`): the same corpus on every run. */
function lcg(seed: number): () => number {
  let s = BigInt(seed);
  return () => {
    s = (s * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    return Number(s >> 11n) / 2 ** 53;
  };
}

const view = new DataView(new ArrayBuffer(8));
/** `x` moved by `steps` representable doubles. */
function nextUp(x: number, steps: number): number {
  view.setFloat64(0, x);
  view.setBigInt64(0, view.getBigInt64(0) + BigInt(x >= 0 ? steps : -steps));
  return view.getFloat64(0);
}

const SPECIALS = [
  0,
  -0,
  5e-324,
  -5e-324,
  -1e-16,
  -1e-15,
  -1.1e-15,
  -1e-13,
  -1e-9,
  -1.1e-9,
  2 ** 52 - 0.5,
  2 ** 52,
  2 ** 53 + 2,
  1e21,
  1.5e300,
  -1.5e300,
  NaN,
  Infinity,
  -Infinity,
];

/**
 * Calls `visit(x, decimals)` on a corpus of ties, snap windows, guard boundaries and specials. The
 * seed picks the ties: two seeds give two corpora, so every test below takes its own.
 */
function corpus(iterations: number, seed: number, visit: (x: number, d: number) => void): void {
  const rnd = lcg(seed);
  for (const x of SPECIALS) for (let d = 0; d <= 15; d++) visit(x, d);
  for (let i = 0; i < iterations; i++) {
    const d = Math.floor(rnd() * 16);
    const p = 10 ** d;
    const k = Math.floor((rnd() - 0.5) * 2 * 10 ** Math.floor(rnd() * 14));
    const tie = (k + 0.5) / p;
    for (let j = -3; j <= 3; j++) visit(nextUp(tie, j), d);
    for (const gap of [1e-13, 5e-13, 1e-12, 1e-11, 5e-11, 1e-10, 1e-9]) {
      visit(tie + gap, d);
      visit(tie - gap, d);
      visit(tie + gap / p, d);
      visit(tie - gap / p, d);
    }
    const t = Math.abs(k) + 0.5;
    const guard = d === 0 ? 1e-9 : 1e-10 * p + t * 2 ** -50;
    for (const f of [0.9, 0.999, 1, 1.001, 1.1, 3]) {
      visit((k + 0.5 + guard * f) / p, d);
      visit((k + 0.5 - guard * f) / p, d);
    }
    visit((rnd() - 0.5) * 10 ** (Math.floor(rnd() * 30) - 12), d);
    visit((rnd() - 0.5) * 2000, d);
  }
}

describe('roundNumberTol against the decimal-string path (#996)', () => {
  // [relTol, absTol, seed]. Each pair has its own seed: four tests on one seed are one corpus run
  // four times, and a fast path whose guard had lost its `t * 2^-50` term passed all four.
  const pairs: Array<[number, number, number]> = [
    [1e-12, 1e-15, 2026],
    [1e-10, 1e-15, 2027],
    [5e-11, 0, 2028],
    [1e-9, 1e-15, 2029],
  ];

  // One test for each pair: the exact path costs about 55 microseconds a call, so the four pairs
  // together went over the 5 s default of `bun test` (6.2 s measured). Each test keeps its own budget.
  it.each(pairs)(
    'equals the exact path on a seeded corpus, relTol %s and absTol %s',
    (relTol, absTol, seed) => {
      let total = 0;
      let first: string | undefined;
      corpus(80, seed, (x, d) => {
        total++;
        const got = roundNumberTol(x, d, relTol, absTol);
        const want = roundNumberTolExact(x, d, relTol, absTol);
        if (!Object.is(got, want) && first === undefined) {
          first = `round(${x}, ${d}) got ${got}, want ${want}`;
        }
      });
      expect(total).toBeGreaterThan(4000);
      expect(first).toBeUndefined();
    }
  );

  it('can fail: a kernel without the test of tiny values returns -0 where the exact path gives 0', () => {
    // Local copy of the fast path without `a >= 1e-9`. A negative value that the snap moves to -0
    // prints as "0", so the exact path gives +0 and the copy gives -0.
    function withoutTinyTest(x: number, d: number): number {
      if (!Number.isFinite(x)) return x;
      if (x === 0) return 0;
      const a = Math.abs(x);
      const p = 10 ** d;
      const t = a * p;
      const guard = d === 0 ? 1e-9 : 1e-10 * p + t * 2 ** -50;
      if (d < 10 && Math.abs(t - Math.floor(t) - 0.5) > guard) {
        if (t >= 2 ** 52) return x;
        const r = Math.round(t) / p;
        return x < 0 ? -r : r;
      }
      return roundNumberTolExact(x, d, REL, ABS);
    }
    let mismatches = 0;
    corpus(40, 2026, (x, d) => {
      if (!Object.is(withoutTinyTest(x, d), roundNumberTolExact(x, d, REL, ABS))) mismatches++;
    });
    expect(mismatches).toBeGreaterThan(0);
    same(withoutTinyTest(-1e-16, 0), -0, 'copy of the fast path, round(-1e-16)');
    same(roundNumberTolExact(-1e-16, 0, REL, ABS), 0, 'exact path, round(-1e-16)');
  });

  it('can fail: a guard without the term that grows with the value is caught by the corpora', () => {
    // Local copy of the fast path with the guard `1e-10 * p` alone (no `t * 2^-50`). `t` is the
    // scaled value: its spacing near 2^k is 2^(k-52), so for a large `t` that guard is below one ulp
    // of `t * p`, and the fast path rounds a value that the exact path decides. The corpora of the
    // four pairs above must catch the copy. With one seed on every pair they did not.
    function withoutScaledGuard(x: number, d: number, relTol: number, absTol: number): number {
      if (!Number.isFinite(x)) return x;
      if (x === 0) return 0;
      const a = Math.abs(x);
      const p = 10 ** d;
      const t = a * p;
      const guard = d === 0 ? 1e-9 : 1e-10 * p;
      if (d < 10 && relTol <= 1e-10 && a >= 1e-9 && Math.abs(t - Math.floor(t) - 0.5) > guard) {
        if (t >= 2 ** 52) return x;
        const r = Math.round(t) / p;
        return x < 0 ? -r : r;
      }
      return roundNumberTolExact(x, d, relTol, absTol);
    }
    let caught = 0;
    for (const [relTol, absTol, seed] of pairs) {
      corpus(80, seed, (x, d) => {
        if (
          !Object.is(
            withoutScaledGuard(x, d, relTol, absTol),
            roundNumberTolExact(x, d, relTol, absTol)
          )
        ) {
          caught++;
        }
      });
    }
    expect(caught).toBeGreaterThan(0);
  });
});

describe('core round of the other types (#996)', () => {
  const B = (v: number | string): BigNumber => new BigNumber(v);
  const F = (n: bigint, d: bigint): Fraction => new Fraction(n, d);

  it('a BigNumber tie goes away from zero', () => {
    expect((round(B(-2.5)) as BigNumber).toString()).toBe('-3');
    expect((round(B(2.5)) as BigNumber).toString()).toBe('3');
  });

  it('core BigNumber round snaps within the configured tolerance', () => {
    expect((round(B('0.49999999999999999999')) as BigNumber).toString()).toBe('1');
  });

  it('a Fraction tie goes toward +Infinity (the Fraction rule, unchanged)', () => {
    const r = round(F(-5n, 2n)) as Fraction;
    expect([r.numerator, r.denominator]).toEqual([-2n, 1n]);
  });

  it('a Complex rounds each part with the Complex rule (unchanged)', () => {
    const r = round(new Complex(-2.5, 2.5)) as Complex;
    expect([r.re, r.im]).toEqual([-2, 3]);
  });

  it('a bigint is returned as it is', () => {
    expect(round(5n)).toBe(5n);
    expect(round(5n, 2)).toBe(5n);
  });
});

describe('core round uses its decimal count (#996, R2)', () => {
  const B = (v: number | string): BigNumber => new BigNumber(v);
  const F = (n: bigint, d: bigint): Fraction => new Fraction(n, d);

  it('a number', () => {
    same(round(1.005, 2), 1.01, 'round(1.005, 2)');
    same(round(-1.005, 2), -1.01, 'round(-1.005, 2)');
    same(round(2.675, 2), 2.68, 'round(2.675, 2)');
  });

  it('a BigNumber ties away from zero at the count', () => {
    expect((round(B('2.345'), 2) as BigNumber).toString()).toBe('2.35');
    expect((round(B('-2.345'), 2) as BigNumber).toString()).toBe('-2.35');
    expect((round(B('1.23456789'), 4) as BigNumber).toString()).toBe('1.2346');
  });

  it('a Fraction gives a Fraction', () => {
    const r = round(F(-201n, 200n), 2) as Fraction;
    expect(r).toBeInstanceOf(Fraction);
    expect([r.numerator, r.denominator]).toEqual([-1n, 1n]);
  });

  it('a Complex rounds each part', () => {
    const r = round(new Complex(1.005, -1.005), 2) as Complex;
    expect([r.re, r.im]).toEqual([1, -1]);
  });

  it('a count that is not an integer throws a TypeError for Complex, Fraction and BigNumber', () => {
    expect(() => round(new Complex(1.5, 2.5), 1.5)).toThrow(TypeError);
    expect(() => round(F(5n, 2n), 1.5)).toThrow(TypeError);
    expect(() => round(B('2.5'), 1.5)).toThrow(TypeError);
    expect(() => round(B('2.5'), 1.5)).toThrow(NOT_INTEGER_MESSAGE);
  });
});

describe('Fraction.round(places) (#996, R1)', () => {
  // [numerator, denominator, places, result numerator, result denominator]
  const rows: Array<[bigint, bigint, number, bigint, bigint]> = [
    [-201n, 200n, 2, -1n, 1n],
    [201n, 200n, 2, 101n, 100n],
    [1n, 3n, 3, 333n, 1000n],
    [-1n, 3n, 3, -333n, 1000n],
    [7n, 8n, 2, 22n, 25n],
    [-7n, 8n, 2, -87n, 100n],
    [1n, 8n, 2, 13n, 100n],
    [-1n, 8n, 2, -3n, 25n],
    [12345n, 100n, 1, 247n, 2n],
    [-12345n, 100n, 1, -617n, 5n],
    [5n, 2n, 20, 5n, 2n],
    [5n, 2n, 0, 3n, 1n],
    [-5n, 2n, 0, -2n, 1n],
    [12345n, 100n, -1, 120n, 1n],
  ];
  for (const [n, d, places, rn, rd] of rows) {
    it(`round(${n}/${d}, ${places}) is ${rn}/${rd}`, () => {
      const method = new Fraction(n, d).round(places);
      expect(method).toBeInstanceOf(Fraction);
      expect([method.numerator, method.denominator]).toEqual([rn, rd]);
      const viaRound = round(new Fraction(n, d), places) as Fraction;
      expect([viaRound.numerator, viaRound.denominator]).toEqual([rn, rd]);
    });
  }

  it('round() with no count is the integer rounding of today', () => {
    const r = new Fraction(5n, 2n).round();
    expect([r.numerator, r.denominator]).toEqual([3n, 1n]);
  });

  it('a count that is not an integer throws a TypeError', () => {
    expect(() => new Fraction(5n, 2n).round(1.5)).toThrow(TypeError);
    expect(() => new Fraction(5n, 2n).round(1.5)).toThrow(NOT_INTEGER_MESSAGE);
  });
});
