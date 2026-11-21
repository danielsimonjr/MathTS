/**
 * Dogfood relay: #1117 (Fraction to BigNumber kept 16 digits), #1119 (bignumber() argument
 * handling), #1120 (solveODE RK23 with BigNumber input accepted a whole-interval first step).
 * The oracle for the argument cases is mathjs 15.2.0; the oracle for the digits is exact
 * rational arithmetic.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import {
  add,
  bignumber,
  complex,
  evaluate,
  filter,
  forEach,
  fraction,
  map,
  matrix,
  quantileSeq,
  solveODE,
  sparse,
  unaryMinus,
  unit,
} from '@danielsimonjr/mathts-functions';

const bn = (s: string | number) => bignumber(s as never) as unknown as BigNumber;
const near = (x: unknown, exact: string, tol = '1e-60') =>
  expect(
    (x as BigNumber).subtract(BigNumber.parse(exact)).abs().compareTo(BigNumber.parse(tol))
  ).toBeLessThan(0);

describe('#1117 Fraction converts to BigNumber at the configured precision', () => {
  it('add(fraction(1,3), bignumber(1)) keeps 64 digits', () => {
    const r = add(fraction(1, 3) as never, bn(1) as never) as unknown as BigNumber;
    near(r, '1.' + '3'.repeat(70));
  });
  it('a negative fraction keeps its sign', () => {
    const r = add(fraction(-1, 3) as never, bn(1) as never) as unknown as BigNumber;
    near(r, '0.' + '6'.repeat(64));
    const s = add(bn(1) as never, fraction(-1, 3) as never) as unknown as BigNumber;
    near(s, '0.' + '6'.repeat(64));
  });
  it('the conversion follows the configured precision', () => {
    const saved = BigNumber.config().precision;
    try {
      BigNumber.config({ precision: 20 });
      const r = add(fraction(1, 3) as never, bn(1) as never) as unknown as BigNumber;
      near(r, '1.' + '3'.repeat(40), '1e-19');
    } finally {
      BigNumber.config({ precision: saved });
    }
  });
  it('quantileSeq of fractions with a BigNumber count gives exact outer quantiles', () => {
    const q = quantileSeq(
      [fraction(1, 3), fraction(2, 3), fraction(1)] as never,
      bn(3) as never
    ) as unknown as BigNumber[];
    near(q[0], '0.5');
    near(q[1], '0.' + '6'.repeat(70));
    near(q[2], '0.' + '8333333333333333333333333333333333333333333333333333333333333333333333');
  });
  it('a Fraction in a number context stays a number', () => {
    expect((add(fraction(1, 3) as never, 1 as never) as unknown) instanceof Fraction).toBe(true);
  });
});

describe('#1119 bignumber() argument handling matches mathjs 15.2.0', () => {
  const b = bignumber as (...a: unknown[]) => unknown;
  it('no argument gives 0', () => {
    expect((b() as BigNumber).toString()).toBe('0');
  });
  it('undefined throws a TypeError that names bignumber', () => {
    expect(() => b(undefined)).toThrow(TypeError);
    expect(() => b(undefined)).toThrow(/bignumber/);
    expect(() => b(undefined)).not.toThrow(/isMatrix/);
  });
  it('a Complex throws a TypeError', () => {
    expect(() => b(complex(1, 2))).toThrow(TypeError);
  });
  it('a plain object throws a TypeError', () => {
    expect(() => b({})).toThrow(TypeError);
  });
  it('null, booleans, strings, bigint and fractions convert as in mathjs', () => {
    expect((b(null) as BigNumber).toString()).toBe('0');
    expect((b(true) as BigNumber).toString()).toBe('1');
    expect((b(false) as BigNumber).toString()).toBe('0');
    expect((b('0x1F') as BigNumber).toString()).toBe('31');
    expect((b('0b101') as BigNumber).toString()).toBe('5');
    expect((b('0o17') as BigNumber).toString()).toBe('15');
    expect((b('-0x1F') as BigNumber).toString()).toBe('-31');
    expect((b('0x1.8') as BigNumber).toString()).toBe('1.5');
    expect((b('0xFFi8') as BigNumber).toString()).toBe('-1');
    expect((b('0x7Fi8') as BigNumber).toString()).toBe('127');
    expect(() => b('0x1FFi8')).toThrow(SyntaxError);
    expect(() => b('0xG')).toThrow(SyntaxError);
    expect((b(5n) as BigNumber).toString()).toBe('5');
    near(b(fraction(-1, 3)), '-0.' + '3'.repeat(64));
  });
  it("'' and a bad string throw", () => {
    expect(() => b('')).toThrow();
    expect(() => b('abc')).toThrow();
  });
  it('a Unit converts its value and a matrix converts element by element', () => {
    const u = b(unit(5, 'cm')) as { value: unknown };
    expect((u.value as BigNumber).toString()).toBe('0.05');
    const m = b(matrix([1, 2])) as { toArray(): unknown[] };
    expect(m.toArray().map(String)).toEqual(['1', '2']);
    expect((b([1, [2]]) as unknown[][]).flat(2).map(String)).toEqual(['1', '2']);
  });
  it('NaN and Infinity convert', () => {
    expect((b(NaN) as BigNumber).isNaN()).toBe(true);
    expect((b(-Infinity) as BigNumber).toString()).toBe('-Infinity');
  });
});

describe('#1120 solveODE RK23 and RK45 with BigNumber input', () => {
  // The invariant: a BigNumber input takes the steps of the number path. The first-step guess is
  // one function for both, so the step count is equal and the result agrees to double precision.
  type Sol = { t: unknown[]; y: unknown[] };
  const f = (_t: unknown, y: unknown) => unaryMinus(y as never);
  const fNum = ((_t: number, y: number) => -y) as never;
  const last = (r: Sol) => Number(String(r.y[r.y.length - 1]));
  const solve = (fn: unknown, tspan: unknown, y0: unknown, method: string) =>
    solveODE(fn as never, tspan as never, y0 as never, { method } as never) as unknown as Sol;
  // Number-path pins. Before #1120 the BigNumber path gave 2 points and 1/3 (RK23), and 4 points
  // and 0.36788579700682765 (RK45).
  const pins = {
    RK23: { points: 22, y: 0.3678768529675089 },
    RK45: { points: 6, y: 0.3678805744341225 },
  };
  for (const method of ['RK23', 'RK45'] as const) {
    it(`${method}: the number path keeps its steps and its result`, () => {
      // Not a bit pin: the step-size factor uses `**`, and Node 22 differs from Node 24 by 1 ulp.
      const r = solve(fNum, [0, 1], 1, method);
      expect(r.t.length).toBe(pins[method].points);
      expect(Math.abs(last(r) - pins[method].y)).toBeLessThan(1e-12);
    });
    it(`${method}: a BigNumber y0 takes the steps of the number path`, () => {
      const r = solve(f, [0, 1], bn(1), method);
      expect(r.t.length).toBe(pins[method].points);
      expect(Math.abs(last(r) - pins[method].y)).toBeLessThan(1e-12);
      expect(r.y[r.y.length - 1] instanceof BigNumber).toBe(true);
    });
    it(`${method}: a BigNumber tspan takes the steps of the number path`, () => {
      const r = solve(f, [bn(0), bn(1)], 1, method);
      expect(r.t.length).toBe(pins[method].points);
      expect(Math.abs(last(r) - pins[method].y)).toBeLessThan(1e-12);
    });
    it(`${method}: a backward BigNumber span takes the steps of the number path`, () => {
      const grow = (_t: unknown, y: unknown) => y;
      const big = solve(grow, [bn(1), bn(0)], bn(Math.E), method);
      const num = solve(grow, [1, 0], Math.E, method);
      expect(big.t.length).toBe(num.t.length);
      expect(Math.abs(last(big) - last(num))).toBeLessThan(1e-12);
      expect(Math.abs(last(big) - 1)).toBeLessThan(1e-3);
    });
  }
});

describe('#1120 review: a BigNumber state rounds to precision and large states start finite', () => {
  type Sol = { t: unknown[]; y: unknown[] };
  const f = (_t: unknown, y: unknown) => unaryMinus(y as never);
  const solve = (fn: unknown, y0: unknown, options: Record<string, unknown>) =>
    solveODE(fn as never, [0, 1] as never, y0 as never, options as never) as unknown as Sol;
  it('RK23 with bignumber(1): every accepted y keeps at most precision + 3 characters', () => {
    // BigNumber add keeps every digit (#1118); without the rounding y(1) had 10205 characters.
    const r = solve(f, bn(1), { method: 'RK23' });
    const precision = BigNumber.config().precision;
    expect(String(r.y[r.y.length - 1]).length).toBeLessThanOrEqual(precision + 3);
    expect(String(r.t[r.t.length - 1]).length).toBeLessThanOrEqual(precision + 3);
  });
  it('RK23 with bignumber(1e2) takes the 177 points of the number path', () => {
    // With the first-step guess and no rounding, the digits grow on each step (107k digits after
    // 271 f calls) and the call does not return. The forcing function throws on the first long
    // state, so that fault fails this test at once and cannot hold the run. A stage state inside
    // one step is not rounded: it has at most 280 characters here.
    const limit = 16 * BigNumber.config().precision;
    const guarded = (_t: unknown, y: unknown) => {
      if (String(y).length > limit) throw new Error(`the state has ${String(y).length} characters`);
      return unaryMinus(y as never);
    };
    const r = solve(guarded, bn('1e2'), { method: 'RK23' });
    expect(r.t.length).toBe(177);
  });
  it('the rounding follows a precision below the default', () => {
    const saved = BigNumber.config().precision;
    try {
      BigNumber.config({ precision: 30 });
      const r = solve(f, bn(1), { method: 'RK23' });
      expect(r.t.length).toBe(22);
      for (const v of [...r.t, ...r.y]) expect(String(v).length).toBeLessThanOrEqual(33);
      expect(Math.abs(Number(String(r.y[21])) - 0.3678768529675089)).toBeLessThan(1e-12);
    } finally {
      BigNumber.config({ precision: saved });
    }
  });
  it('the number path keeps the bits of its first step for a state of several components', () => {
    // The first-step norm must be the plain root mean square. A norm that divides by the largest
    // magnitude gives 0.0022587697572631284 here, and that moves every later step. The first step
    // uses only +, *, / and sqrt, so its bits are the same on every engine.
    const lotka = (_t: number, y: number[]) => [1.5 * y[0] - y[0] * y[1], -3 * y[1] + y[0] * y[1]];
    const rms = (v: number[]) => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0) / v.length);
    const h0 = 0.01 * (rms([10, 5]) / rms(lotka(0, [10, 5])));
    expect(h0).toBe(0.002258769757263128);
    for (const method of ['RK45', 'Rosenbrock', 'RODAS']) {
      const r = solveODE(
        lotka as never,
        [0, 7] as never,
        [10, 5] as never,
        { method } as never
      ) as {
        t: number[];
      };
      expect(r.t[1]).toBe(h0);
    }
  });
  for (const method of ['RK23', 'RK45']) {
    for (const [label, y0] of [
      ['number', 1e160],
      ['BigNumber', bn('1e160')],
    ] as const) {
      it(`${method}: a ${label} y0 of 1e160 gives a finite first step`, () => {
        // The squares of the RMS norm overflowed, so h0 was NaN and f was called with t = NaN.
        const g = (t: unknown, y: unknown) => {
          if (Number.isNaN(Number(String(t)))) throw new Error('f called with t = NaN');
          return unaryMinus(y as never);
        };
        const r = solve(g, y0, { method, tol: 1e157 });
        expect(Number(String(r.t[1]))).toBeGreaterThan(0);
        expect(Number(String(r.t[r.t.length - 1]))).toBe(1);
      });
    }
  }
  for (const method of ['Rosenbrock', 'RODAS']) {
    it(`${method}: a number y0 of 1e160 gives a finite first step`, () => {
      // The stiff engines take the same norm. f throws on a NaN state, so a fault fails at once.
      const g = (_t: number, y: number[]) => {
        if (y.some(Number.isNaN)) throw new Error('f called with y = NaN');
        return y.map((v) => -v);
      };
      const r = solve(g, 1e160, { method }) as { t: number[] };
      expect(r.t[1]).toBe(0.01);
      expect(r.t[r.t.length - 1]).toBe(1);
    });
  }
});

describe('#1119 review: bignumber() extra arguments and radix strings', () => {
  const b = bignumber as (...a: unknown[]) => unknown;
  const s = (x: string) => String(b(x));
  it('a second argument throws a TypeError, as mathjs', () => {
    expect(() => b(1, 2)).toThrow(TypeError);
    expect(() => b(1, 2)).toThrow(
      'Too many arguments in function bignumber (expected: 1, actual: 2)'
    );
  });
  it('an array still converts element by element', () => {
    expect((b([1, 2, 3]) as unknown[]).map(String)).toEqual(['1', '2', '3']);
  });
  it('bignumber is a callback of map, forEach, filter and the map method of a matrix', () => {
    // A collection calls its callback with (value, index, collection).
    const strs = (v: unknown) =>
      ((v as { toArray?: () => unknown[] }).toArray?.() ?? (v as unknown[])).flat().map(String);
    const isBig = (v: unknown) => v instanceof BigNumber;
    const fromMap = map([1, 2] as never, bignumber as never) as unknown as unknown[];
    expect(fromMap.every(isBig)).toBe(true);
    expect(strs(fromMap)).toEqual(['1', '2']);
    expect(strs(map(matrix([1, 2]) as never, bignumber as never))).toEqual(['1', '2']);
    expect(
      strs((matrix([1, 2]) as unknown as { map(f: unknown): unknown }).map(bignumber))
    ).toEqual(['1', '2']);
    const sp = sparse([
      [1, 0],
      [0, 2],
    ] as never) as unknown as { map(f: unknown): unknown };
    expect(strs(sp.map(bignumber))).toEqual(['1', '0', '0', '2']);
    expect(strs(filter([1, 0] as never, bignumber as never))).toEqual(['1', '0']);
    expect(() => forEach([1, 4] as never, bignumber as never)).not.toThrow();
    expect(strs(evaluate('map([1, 2], bignumber)'))).toEqual(['1', '2']);
    expect([1, 2, 3].map(b).every(isBig)).toBe(true);
    // Any other extra argument throws.
    expect(() => b(1, 0)).toThrow(/Too many arguments/);
    expect(() => b(1, 0, 3)).toThrow(/Too many arguments/);
    expect(() => b(1, 'a', [1])).toThrow(/Too many arguments/);
    expect(() => b(1, 0, [1], 4)).toThrow(/Too many arguments/);
    expect(() => evaluate('bignumber(1, 2)')).toThrow(/Too many arguments/);
  });
  it('a BigNumber or a Fraction of another library converts', () => {
    // decimal.js and fraction.js (mathjs) values have the marker, not the brand of core.
    const digits = '1.' + '234567891'.repeat(5);
    expect(String(b({ isBigNumber: true, toString: () => digits }))).toBe(digits);
    expect(String(b({ isBigNumber: true, toString: () => '-1.5e+30' }))).toBe(
      String(bn('-1.5e30'))
    );
    near(
      b({ isFraction: true, s: -1n, n: 1n, d: 3n, valueOf: () => -1 / 3 }),
      '-0.' + '3'.repeat(70)
    );
    expect(String(b({ isFraction: true, s: 1, n: 1, d: 4, valueOf: () => 0.25 }))).toBe('0.25');
  });
  it('a huge word size costs nothing and keeps the value, as mathjs', () => {
    expect(s('0xFFi999999999')).toBe('255');
    expect(s('0xFFi1000000')).toBe('255');
  });
  it('the binary exponent p reads as in mathjs', () => {
    expect(s('0x1p3')).toBe('8');
    expect(s('0x1P3')).toBe('8');
    expect(s('-0x1p3')).toBe('-8');
    expect(s('0x1p-2')).toBe('0.25');
    expect(s('0x1.8p1')).toBe('3');
    // rounded to the configured precision, as mathjs: at most 64 significant digits
    expect(s('0x1p1000').replace(/0+$/, '').length).toBeLessThanOrEqual(
      BigNumber.config().precision
    );
    expect(s('0x1p1000').length).toBe(302);
  });
  it('a fraction with a word size and surrounding spaces throw, as mathjs', () => {
    expect(() => b('0x1.8i8')).toThrow(SyntaxError);
    expect(() => b(' 0x1F ')).toThrow(SyntaxError);
    expect(() => b('0xFFI8')).toThrow(SyntaxError);
  });
  it('departures from mathjs 15.2.0 are pinned', () => {
    // A sign applies after the word-size conversion; mathjs ignores the sign and gives -1.
    expect(s('-0xFFi8')).toBe('1');
    expect(s('-0x80i8')).toBe('128');
    // The binary exponent is bounded; mathjs reads any exponent.
    expect(() => b('0x1p100001')).toThrow(SyntaxError);
    // A radix string rounds to the configured precision. mathjs keeps the 97 digits of this
    // integer, and keeps 20 digits when the string has a binary exponent.
    expect(s('0x' + 'f'.repeat(80)).replace(/0+$/, '')).toBe(
      '2135987035920910082395021706169552114602704522356652769947041608'
    );
    // mathjs reads these two by accident ('0x1i8p3' is 1, '0xFFi8.0' is -1).
    expect(() => b('0x1i8p3')).toThrow(SyntaxError);
    expect(() => b('0xFFi8.0')).toThrow(SyntaxError);
  });
});
