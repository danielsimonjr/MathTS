/**
 * #1001: multinomial is exact for every result that fits a double, and returns
 * Infinity in a bounded number of steps for every result that does not.
 *
 * Expected values come from mathjs 15.2.0 where mathjs is finite, and from a BigInt
 * oracle where mathjs returns NaN. The step counts of the exact kernel pin the work
 * of each call. A wall-clock bound does not belong in a vitest file, and a
 * synchronous hang cannot fail a vitest timeout.
 */
import { describe, it, expect } from 'vitest';
import { multinomial } from '../src/typed/probability.js';
import { multinomialExact } from '../src/probability/multinomial-exact.js';
import { parse, matrix, bignumber } from '../src/index.js';

const bigFactorial = (n: number): bigint => {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r;
};

/** Exact multinomial of a small input, via factorials. */
const bigMultinomial = (parts: number[]): bigint => {
  const total = parts.reduce((s, a) => s + a, 0);
  let denom = 1n;
  for (const a of parts) denom *= bigFactorial(a);
  return bigFactorial(total) / denom;
};

const steps = (parts: number[]): number => {
  const stats = { steps: 0 };
  multinomialExact(parts, stats);
  return stats.steps;
};

describe('multinomial equals mathjs 15.2.0 where mathjs is finite', () => {
  it('matches mathjs for small and moderate inputs', () => {
    expect(multinomial([2, 3, 4])).toBe(1260);
    expect(multinomial([1, 2, 1])).toBe(12);
    expect(multinomial([20, 20])).toBe(137846528820);
    expect(multinomial([2.0, 3])).toBe(10);
    expect(multinomial([3, 5, 7, 11])).toBe(2784199017600);
    // mathjs 15.3.0 (#3790, #1563) rejects a multidimensional multinomial input.
    expect(() =>
      multinomial([
        [1, 2],
        [3, 4],
      ])
    ).toThrow(RangeError);
  });

  it('is 1 for the empty array, as in mathjs', () => {
    expect(multinomial([])).toBe(1);
  });
});

describe('multinomial is exact where mathjs returns NaN (deliberate difference)', () => {
  it('a large sum with a small result is exact', () => {
    expect(multinomial([1, 1e7])).toBe(10000001);
    expect(multinomial([1, 1e9])).toBe(1000000001);
    const n = 100000000000000002n;
    expect(multinomial([1e17, 2])).toBe(Number((n * (n - 1n)) / 2n));
  });

  it('[100,100] is the correctly rounded BigInt value', () => {
    expect(multinomial([100, 100])).toBe(Number(bigMultinomial([100, 100])));
    expect(multinomial([100, 100])).toBe(9.054851465610328e58);
  });

  it('[1e300] is 1, the only arrangement', () => {
    expect(multinomial([1e300])).toBe(1);
  });
});

describe('multinomial overflow returns Infinity', () => {
  it('returns Infinity when the exact value rounds to Infinity', () => {
    expect(multinomial([1e7, 1e7])).toBe(Infinity);
    expect(multinomial([1e9, 1e9])).toBe(Infinity);
    expect(multinomial([1e300, 1e300])).toBe(Infinity);
    expect(multinomial([1e308, 1e308])).toBe(Infinity);
  });

  it('the boundary is between [514,514] and [515,515]', () => {
    expect(multinomial([514, 514])).toBe(7.156051054877897e307);
    expect(multinomial([515, 515])).toBe(Infinity);
  });
});

describe('the exact kernel stops after a bounded number of steps', () => {
  it('pins the step count of each case', () => {
    expect(steps([1e9, 1e9])).toBe(40);
    expect(steps([1e7, 1e7])).toBe(55);
    expect(steps([5000, 5000])).toBe(160);
    expect(steps([512, 512])).toBe(512);
    expect(steps([1e300, 1e300])).toBe(2);
    expect(steps([1, 1e9])).toBe(1);
    expect(steps([1e300])).toBe(0);
    expect(steps(Array(200).fill(1))).toBe(170);
  });
});

describe('parse() gives the same result as the typed function (#1001)', () => {
  const both = (s: string): [unknown, unknown] => {
    const node = parse(s) as { evaluate(): unknown; compile(): { evaluate(): unknown } };
    return [node.evaluate(), node.compile().evaluate()];
  };

  it('plain-number entries use the exact kernel', () => {
    expect(both('multinomial([1e9, 1e9])')).toStrictEqual([Infinity, Infinity]);
    expect(both('multinomial([1e7, 1e7])')).toStrictEqual([Infinity, Infinity]);
    expect(both('multinomial([100, 100])')).toStrictEqual([
      9.054851465610328e58, 9.054851465610328e58,
    ]);
    expect(both('multinomial([1, 1e15])')).toStrictEqual([1000000000000001, 1000000000000001]);
    expect(both('multinomial([2, 1, 1])')).toStrictEqual([12, 12]);
  });

  it('a Matrix, BigNumber and boolean entries keep their results', () => {
    const scope = { m: matrix([2, 3]), b: [bignumber(2), bignumber(3)] };
    const p = (s: string): unknown =>
      (parse(s) as { evaluate(scope: object): unknown }).evaluate(scope);
    expect(p('multinomial(m)')).toBe(10);
    expect(String(p('multinomial(b)'))).toBe('10');
    expect(p('multinomial([true, true])')).toBe(2);
  });

  it('accepts a zero entry (mathjs 15.3.0 #3790, #1563)', () => {
    expect(both('multinomial([1e9, 0])')).toStrictEqual([1, 1]);
  });
});

describe('multinomial rejects entries that are not positive integers, as mathjs does', () => {
  it('throws for negative, fraction, NaN and Infinity entries (zero is valid since 15.3.0)', () => {
    expect(() => multinomial([-1, 2])).toThrow(TypeError);
    expect(() => multinomial([1.5, 1])).toThrow(TypeError);
    expect(() => multinomial([NaN, 1])).toThrow(TypeError);
    expect(() => multinomial([Infinity, 1])).toThrow(TypeError);
  });

  it('validates later entries even when an earlier entry would overflow', () => {
    expect(() => multinomial([1e9, 1.5])).toThrow(TypeError);
  });

  it('uses the mathjs 15.3.0 message', () => {
    expect(() => multinomial([0.5, 1])).toThrow(
      'Nonnegative integer value expected in function multinomial, but got 0.5'
    );
  });
});
