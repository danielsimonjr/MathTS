/**
 * Dogfood #1285 - the matrix 2-norm of a non-finite entry, corr of huge values, and eigs of a
 * BigNumber matrix with a complex pair of huge size.
 *
 *   1. `norm(A, 2)` with a NaN entry threw a RangeError (from eigs, #1243). It returns NaN. An
 *      Infinity entry returns Infinity. The result is a BigNumber when an entry is a BigNumber.
 *   2. `corr` of values near Number.MAX_VALUE: the mean overflowed, the deviations were NaN.
 *   3. `eigs` of the BigNumber matrix [[0,-1e200],[1e200,0]] gave NaN: a complex eigenvalue is
 *      held in numbers, and the discriminant -4e400 is not a number. The matrix is now scaled by
 *      an exact power of 10 when its squares leave the number range.
 *   4. The 2-norm of [[3e-10,1e-10],[2e-10,4e-10]] (fixed by #1268; this test pins it).
 *
 * mathjs 15.2.0 gives: item 1 NaN for a BigNumber NaN entry, 1 for a number NaN entry (a mathjs
 * defect), Infinity for an Infinity entry; item 2 NaN; item 3 Infinity, Infinity.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

type AnyFn = (...args: unknown[]) => unknown;
const fn = (name: string): AnyFn => (f as unknown as Record<string, AnyFn>)[name];
const bn = (v: string | number): BigNumber => new BigNumber(String(v));
const complex = fn('complex');
const matrix = fn('matrix');

afterEach(() => {
  BigNumber.resetConfig();
});

describe.each(['norm', 'factory_norm'])(
  '#1285 item 1: matrix 2-norm of a non-finite entry (%s)',
  (name) => {
    const norm = (...a: unknown[]) => fn(name)(...a);

    it('a BigNumber NaN entry gives a BigNumber NaN', () => {
      const r = norm(
        matrix([
          [bn(NaN), bn(0)],
          [bn(0), bn(1)],
        ]),
        2
      );
      expect(r).toBeInstanceOf(BigNumber);
      expect((r as BigNumber).isNaN()).toBe(true);
    });

    it('a number NaN entry gives NaN (mathjs gives 1)', () => {
      expect(
        norm(
          [
            [NaN, 0],
            [0, 1],
          ],
          2
        )
      ).toBeNaN();
    });

    it('a BigNumber Infinity entry gives a BigNumber Infinity', () => {
      const r = norm(
        matrix([
          [bn(Infinity), bn(0)],
          [bn(0), bn(1)],
        ]),
        2
      );
      expect(r).toBeInstanceOf(BigNumber);
      expect((r as BigNumber).isFinite()).toBe(false);
      expect((r as BigNumber).isNaN()).toBe(false);
    });

    it('a number Infinity entry gives Infinity', () => {
      expect(
        norm(
          [
            [Infinity, 0],
            [0, 1],
          ],
          2
        )
      ).toBe(Infinity);
    });

    it('a Complex NaN entry gives NaN', () => {
      expect(
        norm(
          [
            [complex(NaN, 0), 0],
            [0, 1],
          ],
          2
        )
      ).toBeNaN();
    });

    // The IEEE 754 rule of `hypot` covers every Euclidean magnitude (#1259): an infinite entry
    // gives Infinity, also with a NaN entry.
    it('Infinity beats NaN (#1259)', () => {
      expect(
        norm(
          [
            [NaN, Infinity],
            [0, 1],
          ],
          2
        )
      ).toBe(Infinity);
    });

    it('a finite matrix is unchanged', () => {
      const r = norm(
        [
          [3, 0],
          [0, 4],
        ],
        2
      );
      expect(r as number).toBeCloseTo(4, 14);
    });
  }
);

describe('#1285 item 1: eigs still rejects a non-finite entry (#1243)', () => {
  it('eigs([[NaN,0],[0,1]]) throws a RangeError', () => {
    expect(() =>
      fn('eigs')([
        [NaN, 0],
        [0, 1],
      ])
    ).toThrow(RangeError);
  });
});

describe('#1285 item 2: corr of values near Number.MAX_VALUE', () => {
  const MAX = Number.MAX_VALUE;
  const want = -9 / Math.sqrt(84);
  const relErr = (r: unknown, w: number): number => Math.abs((r as number) - w) / Math.abs(w);

  it('corr([MAX, MAX/2, MAX/4], [1, 2, 3]) = -9 / sqrt(84)', () => {
    expect(relErr(fn('corr')([MAX, MAX / 2, MAX / 4], [1, 2, 3]), want)).toBeLessThan(1e-15);
  });

  it('the y side overflows the same way', () => {
    expect(relErr(fn('corr')([1, 2, 3], [MAX, MAX / 2, MAX / 4]), want)).toBeLessThan(1e-15);
  });

  it('corr([-MAX, MAX], [1, 2]) = 1', () => {
    expect(relErr(fn('corr')([-MAX, MAX], [1, 2]), 1)).toBeLessThan(1e-15);
  });

  it('a list of ordinary size is unchanged', () => {
    expect(relErr(fn('corr')([4, 2, 1], [1, 2, 3]), want)).toBeLessThan(1e-15);
  });
});

type Ri = { re: number; im: number };
const toRi = (x: unknown): Ri => {
  const o = x as { re?: unknown; im?: unknown };
  if (typeof o.re === 'number' && typeof o.im === 'number') return { re: o.re, im: o.im };
  return { re: Number(x), im: 0 };
};

describe('#1285 item 3: eigs of a BigNumber matrix with a huge complex pair', () => {
  type Pair = { values: unknown[]; eigenvectors: Array<{ value: unknown; vector: unknown[] }> };
  const run = (A: unknown[][]): Pair => fn('eigs')(A) as Pair;
  const rotation = (a: string): BigNumber[][] => [
    [bn(0), bn(`-${a}`)],
    [bn(a), bn(0)],
  ];

  const checkPair = (r: Pair, a: number) => {
    const values = r.values.map(toRi).sort((p, q) => p.im - q.im);
    expect(values).toHaveLength(2);
    expect(Math.abs(values[0].re)).toBeLessThanOrEqual(1e-14 * a);
    expect(Math.abs(values[1].re)).toBeLessThanOrEqual(1e-14 * a);
    expect(Math.abs(values[0].im + a) / a).toBeLessThan(1e-14);
    expect(Math.abs(values[1].im - a) / a).toBeLessThan(1e-14);
    // the eigenvector of +ia is proportional to [1, -i]: v1 / v0 = -i
    const upper = r.eigenvectors.find((p) => toRi(p.value).im > 0)!;
    const [v0, v1] = upper.vector.map(toRi);
    const norm2 = v0.re * v0.re + v0.im * v0.im;
    const ratio = {
      re: (v1.re * v0.re + v1.im * v0.im) / norm2,
      im: (v1.im * v0.re - v1.re * v0.im) / norm2,
    };
    expect(Math.hypot(ratio.re - 0, ratio.im + 1)).toBeLessThan(1e-12);
  };

  it('[[0,-1e200],[1e200,0]] has the values +-1e200 i, not NaN', () => {
    checkPair(run(rotation('1e200')), 1e200);
  });

  it('the same with a wide exponent range', () => {
    const before = BigNumber.config();
    try {
      BigNumber.config({ minExponent: -1e9, maxExponent: 1e9 });
      checkPair(run(rotation('1e200')), 1e200);
    } finally {
      BigNumber.config(before);
    }
  });

  it('the real control [[1e200,1e200],[0,2e200]] gives the exact BigNumbers 1e200 and 2e200', () => {
    const r = run([
      [bn('1e200'), bn('1e200')],
      [bn(0), bn('2e200')],
    ]);
    const values = (r.values as BigNumber[]).map((v) => {
      expect(v).toBeInstanceOf(BigNumber);
      return v.toString();
    });
    expect(values.map((v) => Number(v)).sort((p, q) => p - q)).toEqual([1e200, 2e200]);
  });

  it('the small control [[0,-1],[1,0]] keeps +-i', () => {
    const r = run(rotation('1'));
    const values = r.values.map(toRi).sort((p, q) => p.im - q.im);
    expect(Math.hypot(values[0].re, values[0].im + 1)).toBeLessThan(1e-14);
    expect(Math.hypot(values[1].re, values[1].im - 1)).toBeLessThan(1e-14);
  });
});

describe('#1285 item 4: the factory 2-norm of a small 2x2 matrix (fixed by #1268)', () => {
  it.each(['norm', 'factory_norm'])('%s([[3e-10,1e-10],[2e-10,4e-10]], 2)', (name) => {
    const want = Math.sqrt(15 + Math.sqrt(125)) * 1e-10;
    const r = fn(name)(
      [
        [3e-10, 1e-10],
        [2e-10, 4e-10],
      ],
      2
    ) as number;
    expect(Math.abs(r - want) / want).toBeLessThan(1e-15);
  });
});
