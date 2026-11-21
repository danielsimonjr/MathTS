/**
 * Dogfood #940 - the distribution factories ignored an argument that they did not declare.
 *
 * `gammaDist(2, 2, { scale: 2 })` gave the rate distribution (mean 1) with no error, because
 * JavaScript drops the third argument. The same held for `exponentialDist(2, { scale: 2 })`,
 * an unknown key of an options object (`gammaDist(2, { scale: 2, loc: 1 })`) and an unknown
 * key of `sampleN` options. A factory now throws a `TypeError` for an options object after its
 * last parameter, for a value that is not a number in a number position, and for an unknown
 * option key. Calls that stay valid: an explicit `undefined`, a call from `Array.prototype.map`
 * (the factory gets `(value, index, array)`), a BigNumber parameter and a missing parameter.
 *
 * Each factory also documents its parameter convention. The closed forms below pin the mapping
 * from the arguments of each factory to its mean and variance. The inputs are asymmetric on
 * purpose, so a swapped parameter order fails.
 */
import { describe, expect, it } from 'vitest';
import { bignumber } from '@danielsimonjr/mathts-core';
import { evaluate, fraction } from '../src/index.js';
import {
  betaDist,
  binomialDist,
  chiSquaredDist,
  discreteUniformDist,
  exponentialDist,
  fDist,
  gammaDist,
  gumbelDist,
  hypergeometricDist,
  invGaussDist,
  logNormalDist,
  multivariateNormal,
  negativeBinomialDist,
  normalDist,
  paretoDist,
  poissonDist,
  rayleighDist,
  tDist,
  triangularDist,
  uniformDist,
  weibullDist,
} from '../src/typed/dist-objects.js';

const G = 0.5772156649015329; // the Euler-Mascheroni constant
const gam = (x: number): number => {
  // gamma(1) = 1, gamma(1.5) = sqrt(pi)/2, gamma(2) = 1: the only values that the table needs
  if (x === 1.5) return Math.sqrt(Math.PI) / 2;
  return 1;
};

type Factory = (...args: never[]) => unknown;
const call = (f: unknown, ...args: unknown[]): unknown =>
  (f as (...a: unknown[]) => unknown)(...args);

/** A valid call of each factory: the name, the function and its valid arguments. */
const FACTORIES: [string, Factory, unknown[]][] = [
  ['normalDist', normalDist, [1.5, 2]],
  ['betaDist', betaDist, [2, 3]],
  ['binomialDist', binomialDist, [10, 0.3]],
  ['chiSquaredDist', chiSquaredDist, [3]],
  ['exponentialDist', exponentialDist, [4]],
  ['fDist', fDist, [3, 7]],
  ['gammaDist', gammaDist as unknown as Factory, [3, 4]],
  ['logNormalDist', logNormalDist, [0.5, 0.75]],
  ['poissonDist', poissonDist, [3.5]],
  ['tDist', tDist, [5]],
  ['uniformDist', uniformDist, [1, 4]],
  ['weibullDist', weibullDist, [2, 3]],
  ['hypergeometricDist', hypergeometricDist, [20, 7, 5]],
  ['negativeBinomialDist', negativeBinomialDist, [3, 0.4]],
  ['paretoDist', paretoDist, [3, 2]],
  ['rayleighDist', rayleighDist, [2]],
  ['triangularDist', triangularDist, [1, 2, 5]],
  ['discreteUniformDist', discreteUniformDist, [2, 7]],
  ['gumbelDist', gumbelDist, [1, 2]],
  ['invGaussDist', invGaussDist, [2, 3]],
  [
    'multivariateNormal',
    multivariateNormal as unknown as Factory,
    [
      [1, 2],
      [
        [2, 0.5],
        [0.5, 1],
      ],
    ],
  ],
];

describe('#940 gammaDist: an ignored option is an error', () => {
  it('a third argument that is an options object throws (the rate distribution before)', () => {
    expect(() => call(gammaDist, 2, 2, { scale: 2 })).toThrow(TypeError);
    expect(() => call(gammaDist, 2, 2, { scale: 2 })).toThrow(/argument 3 would be ignored/);
  });
  it('an unknown key of the second argument throws (mean 4 before)', () => {
    expect(() => call(gammaDist, 2, { scale: 2, loc: 1 })).toThrow(/unknown option "loc"/);
  });
  it('an unknown key of the named form throws (mean 4 before)', () => {
    expect(() => call(gammaDist, { shape: 2, scale: 2, loc: 1 })).toThrow(/unknown option "loc"/);
  });
  it('an explicit undefined is not an option', () => {
    expect((call(gammaDist, 2, 2, undefined) as { pdf(x: number): number }).pdf(1)).toBe(
      0.5413411329464507
    );
    expect(call(gammaDist, { shape: 2, scale: 2 }, undefined)).toMatchObject({ mean: 4 });
  });
  it('rate and scale together still throw', () => {
    expect(() => call(gammaDist, { shape: 2, scale: 2 }, 2)).toThrow(
      /pass rate or scale, not both/
    );
    expect(() => call(gammaDist, 2, { rate: 1, scale: 2 })).toThrow(/pass rate or scale, not both/);
  });
  it('GUARD: the values that the issue lists stay', () => {
    expect(gammaDist(2, 2).pdf(1)).toBe(0.5413411329464507);
    expect(gammaDist(2, { scale: 2 }).pdf(1)).toBe(0.15163266492815836);
    expect(gammaDist(2, { scale: 2 }).mean).toBe(4);
    expect(gammaDist({ shape: 2, scale: 2 }).mean).toBe(4);
  });
});

describe('#940 the other factories: an options object after the parameters is an error', () => {
  it('exponentialDist(2, { scale: 2 }) throws (mean 0.5 before)', () => {
    expect(() => call(exponentialDist, 2, { scale: 2 })).toThrow(/argument 2 would be ignored/);
  });
  it('exponentialDist({ scale: 2 }) throws (a NaN distribution before)', () => {
    expect(() => call(exponentialDist, { scale: 2 })).toThrow(/lambda must be a number/);
  });
  it.each(FACTORIES)(
    '%s: valid arguments and one extra {} throw, an extra undefined does not',
    (name, f, args) => {
      expect(() => call(f, ...args, {})).toThrow(TypeError);
      expect(() => call(f, ...args, {})).toThrow(
        new RegExp(`${name}: takes at most ${args.length} arguments`)
      );
      expect(() => call(f, ...args, undefined)).not.toThrow();
    }
  );
  it.each(FACTORIES.filter(([name]) => name !== 'multivariateNormal'))(
    '%s: an options object in the first number position throws',
    (_name, f, args) => {
      expect(() => call(f, { scale: 2 }, ...args.slice(1))).toThrow(TypeError);
    }
  );
  it('an expression call is checked too', () => {
    expect(() => evaluate('gammaDist(2, 2, {scale: 2})')).toThrow(/argument 3 would be ignored/);
    expect((evaluate('gammaDist(2, {scale: 2})') as unknown as { mean: number }).mean).toBe(4);
    expect((evaluate('normalDist(0, 1)') as unknown as { mean: number }).mean).toBe(0);
  });
});

describe('#940 calls that stay valid', () => {
  it('a BigNumber parameter (the factories are in the expression scope)', () => {
    expect(normalDist(bignumber(0) as unknown as number, 1).pdf(0)).toBe(0.3989422804014327);
  });
  it('a call from Array.prototype.map gets (value, index, array): no error, same result', () => {
    expect([1, 2, 3].map(poissonDist).map((d) => d.mean)).toEqual([1, 2, 3]);
    expect([1, 2, 3].map(chiSquaredDist).map((d) => d.mean)).toEqual([1, 2, 3]);
    expect([1, 2, 3].map(exponentialDist).map((d) => d.mean)).toEqual([1, 0.5, 1 / 3]);
    expect([3, 4, 5].map(tDist).map((d) => d.variance)).toEqual([3, 2, 5 / 3]);
  });
  it('a one-parameter factory called as an object iteration helper (value, key, object)', () => {
    expect(() => call(poissonDist, 3, 'key', { a: 1 })).not.toThrow();
  });
  it('a missing parameter is not part of this issue: defaults and NaN stay', () => {
    expect(normalDist().mean).toBe(0);
    expect(exponentialDist().mean).toBe(1);
    expect(Number.isNaN(betaDist(2 as number, undefined as never).mean)).toBe(true);
  });
  it('a value with no numeric reading in a number position throws', () => {
    expect(() => call(normalDist, 'x', 1)).toThrow(/mu must be a number, got string/);
    expect(() => call(binomialDist, 10, {})).toThrow(/p must be a number, got object/);
  });
});

describe('#940 sampleN: an unknown option is an error', () => {
  it('an unknown key rejects (it was ignored)', async () => {
    await expect(normalDist().sampleN(3, { seed: 1, sead: 2 } as never)).rejects.toThrow(
      /unknown option "sead"/
    );
  });
  it('the known options still work', async () => {
    const out = await normalDist().sampleN(3, { seed: 1 });
    expect(out).toHaveLength(3);
  });
});

describe('#940 parameter conventions: the arguments of each factory give the documented mean and variance', () => {
  const cases: [string, unknown, number, number][] = [
    ['normalDist(1.5, 2)', normalDist(1.5, 2), 1.5, 4],
    ['betaDist(2, 3)', betaDist(2, 3), 0.4, 0.04],
    ['binomialDist(10, 0.3)', binomialDist(10, 0.3), 3, 2.1],
    ['chiSquaredDist(3)', chiSquaredDist(3), 3, 6],
    ['exponentialDist(4): the argument is the RATE', exponentialDist(4), 1 / 4, 1 / 16],
    ['fDist(3, 7)', fDist(3, 7), 7 / 5, (2 * 49 * 8) / (3 * 25 * 3)],
    ['gammaDist(3, 4): the second argument is the RATE', gammaDist(3, 4), 3 / 4, 3 / 16],
    ['gammaDist(3, { scale: 4 })', gammaDist(3, { scale: 4 }), 12, 48],
    [
      'logNormalDist(0.5, 0.75)',
      logNormalDist(0.5, 0.75),
      Math.exp(0.5 + 0.75 ** 2 / 2),
      (Math.exp(0.75 ** 2) - 1) * Math.exp(1 + 0.75 ** 2),
    ],
    ['poissonDist(3.5)', poissonDist(3.5), 3.5, 3.5],
    ['tDist(5)', tDist(5), 0, 5 / 3],
    ['uniformDist(1, 4)', uniformDist(1, 4), 2.5, 0.75],
    ['weibullDist(2, 3)', weibullDist(2, 3), 3 * gam(1.5), 9 * (gam(2) - gam(1.5) ** 2)],
    [
      'hypergeometricDist(20, 7, 5)',
      hypergeometricDist(20, 7, 5),
      (5 * 7) / 20,
      5 * (7 / 20) * (13 / 20) * (15 / 19),
    ],
    [
      'negativeBinomialDist(3, 0.4)',
      negativeBinomialDist(3, 0.4),
      (3 * 0.6) / 0.4,
      (3 * 0.6) / 0.16,
    ],
    ['paretoDist(3, 2)', paretoDist(3, 2), 3, 3],
    ['rayleighDist(2)', rayleighDist(2), 2 * Math.sqrt(Math.PI / 2), ((4 - Math.PI) / 2) * 4],
    ['triangularDist(1, 2, 5)', triangularDist(1, 2, 5), 8 / 3, 13 / 18],
    ['discreteUniformDist(2, 7)', discreteUniformDist(2, 7), 4.5, 35 / 12],
    ['gumbelDist(1, 2)', gumbelDist(1, 2), 1 + 2 * G, (4 * Math.PI ** 2) / 6],
    ['invGaussDist(2, 3)', invGaussDist(2, 3), 2, 8 / 3],
  ];
  it.each(cases)('%s', (_label, d, mean, variance) => {
    const dist = d as { mean: number; variance: number };
    expect(dist.mean).toBeCloseTo(mean, 12);
    expect(dist.variance).toBeCloseTo(variance, 12);
  });
  it('multivariateNormal([1, 2], [[2, 0.5], [0.5, 1]])', () => {
    const d = multivariateNormal(
      [1, 2],
      [
        [2, 0.5],
        [0.5, 1],
      ]
    );
    expect(d.mean).toEqual([1, 2]);
    expect(d.pdf([1, 2])).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(1.75)), 12);
  });
});

describe('#940 an array in a number parameter throws (Number([2]) is 2)', () => {
  it.each([
    ['normalDist([2], 1)', () => normalDist([2] as never, 1)],
    ['normalDist(0, [1])', () => normalDist(0, [1] as never)],
    ['poissonDist([3])', () => poissonDist([3] as never)],
    ['poissonDist(new Float64Array([3]))', () => poissonDist(new Float64Array([3]) as never)],
  ])('%s', (_label, call) => {
    expect(call).toThrow(TypeError);
  });
  it('GUARD: a number still passes', () => {
    expect(normalDist(2, 1).mean).toBe(2);
    expect(poissonDist(3).mean).toBe(3);
  });
});

describe('#1384 a parameter with a numeric reading is stored as that number', () => {
  type D = { mean: number; variance: number; pdf(x: number): number };
  const SCALAR = FACTORIES.filter(([name]) => name !== 'multivariateNormal');
  it.each(SCALAR)('%s: string arguments give the distribution of the numbers', (_n, f, args) => {
    const want = call(f, ...args) as D;
    const got = call(f, ...args.map(String)) as D;
    expect(typeof got.mean).toBe('number');
    expect(got.mean).toBe(want.mean);
    expect(got.variance).toBe(want.variance);
  });
  it('the issue input: normalDist("2", 1).mean is the number 2 (the string "2" before)', () => {
    expect(call(normalDist, '2', 1)).toMatchObject({ mean: 2, variance: 1 });
  });
  it('a BigNumber parameter is stored as a number', () => {
    const d = normalDist(bignumber(1.5) as unknown as number, 2);
    expect(typeof d.mean).toBe('number');
    expect(d.mean).toBe(1.5);
  });
  it('gammaDist: a string shape and rate (a TypeError before: not finite)', () => {
    expect(call(gammaDist, '3', '4')).toMatchObject({ mean: 0.75 });
  });
  it('gammaDist options: a string or BigNumber shape and scale (a TypeError before)', () => {
    expect(call(gammaDist, { shape: '2', scale: '2' })).toMatchObject({ mean: 4 });
    expect(call(gammaDist, 2, { scale: '2' })).toMatchObject({ mean: 4 });
    expect(call(gammaDist, { shape: bignumber(2), scale: bignumber(2) })).toMatchObject({
      mean: 4,
    });
    expect(() => call(gammaDist, { shape: 'x', scale: 2 })).toThrow(/shape must be a number/);
  });
  it('gammaDist: a BigNumber or Fraction rate is a rate, not an options object (#1360)', () => {
    // A BigNumber is an object, so it took the options branch: 'unknown option "type"' (J3) and
    // 'expected a positive rate or { scale }' (main). evaluate in a BigNumber scope passes one.
    expect(call(gammaDist, bignumber(2), bignumber(2))).toMatchObject({ mean: 1 });
    expect(call(gammaDist, 2, fraction(1, 2))).toMatchObject({ mean: 4 });
    expect(gammaDist(2, 2).pdf(1)).toBe(0.5413411329464507);
  });
  it('multivariateNormal: string entries of mean and cov are stored as numbers (strings before)', () => {
    const want = multivariateNormal(
      [1, 2],
      [
        [2, 0.5],
        [0.5, 1],
      ]
    );
    const got = call(
      multivariateNormal,
      ['1', '2'],
      [
        ['2', '0.5'],
        ['0.5', '1'],
      ]
    ) as typeof want;
    expect(got.mean).toEqual([1, 2]);
    expect(typeof got.mean[0]).toBe('number');
    expect(got.cov).toEqual([
      [2, 0.5],
      [0.5, 1],
    ]);
    expect(got.pdf([1.5, 1])).toBe(want.pdf([1.5, 1]));
    expect(() =>
      call(
        multivariateNormal,
        ['x', 2],
        [
          [1, 0],
          [0, 1],
        ]
      )
    ).toThrow(/mean\[0\] must be a number/);
  });
});
