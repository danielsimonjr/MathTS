/**
 * #1779 — fraction.js surface: `toString`, `valueOf`, `toJSON`, `fraction()`, and replacer.
 */
import { describe, expect, it } from 'vitest';
import { Fraction as CoreFraction } from '@danielsimonjr/mathts-core';
import { create, all, replacer, reviver, type MathjsFraction } from '../src/index.js';
import { isMathjsFraction } from '../src/mathjs-fraction-class.js';
import { mathjsPowFractionPair } from '../src/mathjs-fraction-pow.js';
import { isCompatZeroScalar, isSparseStructuralZero } from '../src/sparse-structural-zero.js';
import FractionJS from 'fraction.js';

const math = create(all);

type FractionFields = { s: bigint | number; n: bigint | number; d: bigint | number };

function equalFraction(a: FractionFields, b: FractionFields): void {
  expect(a.s).toBe(b.s);
  expect(a.n).toBe(b.n);
  expect(a.d).toBe(b.d);
}

describe('#1779 Fraction type', () => {
  it('valueOf on fraction(1, 2)', () => {
    expect(math.fraction(1, 2).valueOf()).toBe(0.5);
  });

  it('toJSON uses string n and d', () => {
    expect((new math.Fraction(0.375) as MathjsFraction).toJSON()).toEqual({
      mathjs: 'Fraction',
      n: '3',
      d: '8',
    });
    expect((new math.Fraction(-0.375) as MathjsFraction).toJSON()).toEqual({
      mathjs: 'Fraction',
      n: '-3',
      d: '8',
    });
  });

  it('fromJSON decimal toString', () => {
    expect(math.Fraction.fromJSON({ n: 3, d: 8 }).toString()).toBe('0.375');
    expect(math.Fraction.fromJSON({ n: -3, d: 8 }).toString()).toBe('-0.375');
    expect(math.Fraction.fromJSON({ n: 3, d: -8 }).toString()).toBe('-0.375');
  });
});

describe('#1779 fraction()', () => {
  it('creates rationals matching fraction.js', () => {
    equalFraction(math.fraction(1, 3), new FractionJS(1, 3));
    equalFraction(math.fraction(0.3), new FractionJS(0.3));
    equalFraction(math.fraction('1/3'), new FractionJS(1, 3));
    equalFraction(math.fraction({ n: 1, d: 3 }) as MathjsFraction, new FractionJS(1, 3));
    equalFraction(math.fraction(null) as MathjsFraction, new FractionJS(0));
  });

  it('approximates pi like mathjs', () => {
    equalFraction(math.fraction(math.pi) as MathjsFraction, new FractionJS(11985110, 3814979));
  });

  it('rejects non-integer two-arg quotient', () => {
    expect(() => math.fraction(4, 5.1)).toThrow(/Parameters must be integer/);
    expect(() => math.fraction(62.8, 10)).toThrow(/Parameters must be integer/);
    expect(() => math.fraction(Infinity, 3)).toThrow(/Parameters must be integer/);
  });

  it('converts BigNumber and bigint', () => {
    const b = math.bignumber(2).div(3);
    equalFraction(
      math.fraction(b),
      new FractionJS('0.6666666666666666666666666666666666666666666666666666666666666667')
    );
    equalFraction(math.fraction(42), new FractionJS(42));
    equalFraction(math.fraction(42n), new FractionJS(42));
    equalFraction(math.fraction(1n, 3n), new FractionJS(1, 3));
  });

  it('converts unit magnitudes', () => {
    equalFraction(
      (math.fraction(math.unit(0.5, 'cm')) as { toNumeric: (u: string) => unknown }).toNumeric(
        'cm'
      ) as MathjsFraction,
      new FractionJS(1, 2)
    );
    equalFraction(
      (
        math.fraction(math.unit(math.bignumber(0.5), 'cm')) as { toNumeric: (u: string) => unknown }
      ).toNumeric('cm') as MathjsFraction,
      new FractionJS(1, 2)
    );
    equalFraction(
      (math.fraction(math.unit(10, 'inch')) as { toNumeric: (u: string) => unknown }).toNumeric(
        'cm'
      ) as MathjsFraction,
      new FractionJS(127, 5)
    );
  });

  it('maps arrays and matrices', () => {
    const arr = math.fraction([0.2, 0.25, 0.125]) as MathjsFraction[];
    expect(Array.isArray(arr)).toBe(true);
    equalFraction(arr[0] as MathjsFraction, new FractionJS(1, 5));
    equalFraction(arr[1] as MathjsFraction, new FractionJS(1, 4));
    equalFraction(arr[2] as MathjsFraction, new FractionJS(1, 8));

    const mat = math.fraction(math.matrix([0.2, 0.25, 0.125])) as ReturnType<typeof math.matrix>;
    const rows = mat.toArray() as MathjsFraction[];
    equalFraction(rows[0] as MathjsFraction, new FractionJS(1, 5));
  });
});

describe('#1779 replacer', () => {
  it('stringifies Fraction with string n/d', () => {
    const b = new math.Fraction(0.375);
    const json = '{"mathjs":"Fraction","n":"3","d":"8"}';
    expect(JSON.stringify(b)).toBe(json);
    expect(JSON.stringify(b, replacer)).toBe(json);
  });
});

describe('#1779 reviver', () => {
  it('revives v5 string and v4 number Fraction JSON to compat MathjsFraction', () => {
    const v5 = JSON.parse('{"mathjs":"Fraction","n":"3","d":"8"}', math.reviver) as MathjsFraction;
    expect(v5).toBeInstanceOf(math.Fraction);
    expect(isMathjsFraction(v5)).toBe(true);
    equalFraction(v5, new FractionJS(3, 8));

    const v4 = JSON.parse('{"mathjs":"Fraction","n":3,"d":8}', math.reviver) as MathjsFraction;
    expect(v4).toBeInstanceOf(math.Fraction);
    equalFraction(v4, new FractionJS(3, 8));

    const neg = JSON.parse('{"mathjs":"Fraction","n":"-3","d":"8"}', reviver) as MathjsFraction;
    expect(neg).toBeInstanceOf(math.Fraction);
    equalFraction(neg, new FractionJS(-3, 8));
  });
});

describe('#1779 core Fraction prototype isolation', () => {
  it('does not mutate native core Fraction instances or crash on compat predicates', () => {
    const coreFrac = new CoreFraction(1, 3);
    expect(isMathjsFraction(coreFrac)).toBe(false);
    expect(isMathjsFraction(null)).toBe(false);
    expect(isMathjsFraction(42)).toBe(false);
    expect(coreFrac.toString()).toBe('0.(3)');
    expect(CoreFraction.prototype.toJSON.name).toBe('toJSON');
    expect(math.isPositive(coreFrac)).toBe(true);
    expect(math.isNegative(new CoreFraction(-1, 3))).toBe(true);
    expect(math.isZero(new CoreFraction(0, 1))).toBe(true);
    expect(math.isInteger(new CoreFraction(2, 1))).toBe(true);
  });
});

describe('#1779 isPrime on Fraction', () => {
  it('throws TypeError matching mathjs 15.3.0 on Fraction input', () => {
    expect(() => math.isPrime(math.fraction(7, 1))).toThrow(
      /Cannot implicitly convert a Fraction to BigNumber/
    );
    expect(math.isPrime(7)).toBe(true);
    expect(math.isPrime(4)).toBe(false);
  });
});

describe('#1779 unit with Fraction formatting', () => {
  it('formats unit magnitudes as ratios matching mathjs 15.3.0', () => {
    const u1 = math.fraction(math.unit('2 m')) as {
      toString(): string;
      valueOf(): string;
      format(opts?: unknown): string;
    };
    expect(u1.toString()).toBe('2/1 m');
    expect(u1.valueOf()).toBe('2/1 m');
    expect(u1.format({ fraction: 'decimal' })).toBe('2 m');

    expect((math.fraction(math.unit(0.5, 'cm')) as { toString(): string }).toString()).toBe(
      '1/2 cm'
    );
    expect((math.fraction(math.unit(-1.5, 'm')) as { toString(): string }).toString()).toBe(
      '-3/2 m'
    );
  });
});

describe('#1779 fraction helpers and edge cases', () => {
  it('covers fraction() empty, undefined, non-finite, passthrough, and sparse matrix', () => {
    equalFraction(math.fraction() as MathjsFraction, new FractionJS(0));
    equalFraction(math.fraction(undefined) as MathjsFraction, new FractionJS(0));
    expect(() => math.fraction(NaN)).toThrow(/cannot be represented as a fraction/);
    expect(() => math.fraction(Infinity)).toThrow(/cannot be represented as a fraction/);

    const existing = math.fraction(2, 5);
    expect(math.fraction(existing)).toBe(existing);

    const sparse = math.sparse([
      [0.5, 0],
      [0, 0.25],
    ]);
    const mapped = math.fraction(sparse) as ReturnType<typeof math.sparse>;
    expect(mapped.size()).toEqual([2, 2]);
  });

  it('covers MathjsFraction numerator, denominator, equals, and multiply', () => {
    const f = math.fraction(-3, 4);
    expect(f.numerator).toBe(-3n);
    expect(f.denominator).toBe(4n);
    const fCompat = f as MathjsFraction & {
      equals(y: unknown): boolean;
      multiply(y: unknown): MathjsFraction;
    };
    expect(fCompat.equals(new CoreFraction(-3, 4))).toBe(true);
    expect(fCompat.equals(new CoreFraction(1, 4))).toBe(false);
    expect(fCompat.equals({ invalid: true })).toBe(false);
    equalFraction(fCompat.multiply(math.fraction(2, 3)), new FractionJS(-1, 2));
  });

  it('covers equal, unary predicates, fix, and multiplyScalar on fractions', () => {
    expect(math.equal(math.fraction(1, 2), 0.5)).toBe(true);
    expect(math.equal(0.5, math.fraction(1, 2))).toBe(true);
    expect(math.equal(math.fraction(1, 2), math.fraction(2, 4))).toBe(true);

    expect(math.isPositive([math.fraction(1, 2), math.fraction(-1, 2)])).toEqual([true, false]);
    expect(math.isNegative([math.fraction(1, 2), math.fraction(-1, 2)])).toEqual([false, true]);
    expect(math.isInteger([math.fraction(2, 1), math.fraction(1, 2)])).toEqual([true, false]);
    expect(math.isZero([math.fraction(0, 1), math.fraction(1, 2)])).toEqual([true, false]);

    equalFraction(math.fix(math.fraction(3, 2)) as MathjsFraction, new FractionJS(1));
    equalFraction(math.fix(math.fraction(-3, 2)) as MathjsFraction, new FractionJS(-1));
    equalFraction(math.fix(math.fraction(1, 3), 2) as MathjsFraction, new FractionJS(33, 100));
    equalFraction(math.fix(math.fraction(1, 3), 2n) as MathjsFraction, new FractionJS(33, 100));
    expect(() => math.fix(math.fraction(1, 3), 1.5)).toThrow(/not an integer/);
    const fixedArr = math.fix([math.fraction(3, 2), math.fraction(-3, 2)]) as MathjsFraction[];
    equalFraction(fixedArr[0] as MathjsFraction, new FractionJS(1));
    equalFraction(fixedArr[1] as MathjsFraction, new FractionJS(-1));
    expect(math.fix([1.5, -1.5], 0)).toEqual([1, -1]);

    equalFraction(math.multiplyScalar(math.fraction(2, 3), 3) as MathjsFraction, new FractionJS(2));
    equalFraction(math.multiplyScalar(3, math.fraction(2, 3)) as MathjsFraction, new FractionJS(2));
    equalFraction(
      math.multiplyScalar(math.fraction(2, 3), math.fraction(3, 4)) as MathjsFraction,
      new FractionJS(1, 2)
    );

    equalFraction(math.pow(math.fraction(2, 3), 2) as MathjsFraction, new FractionJS(4, 9));
    equalFraction(math.pow(math.fraction(2, 3), -2) as MathjsFraction, new FractionJS(9, 4));
    equalFraction(math.pow(math.fraction(2, 3), 0) as MathjsFraction, new FractionJS(1, 1));
    equalFraction(
      math.pow(math.fraction(4, 9), math.fraction(1, 2)) as MathjsFraction,
      new FractionJS(2, 3)
    );
    equalFraction(
      math.pow(math.fraction(2, 3), math.fraction(2, 1)) as MathjsFraction,
      new FractionJS(4, 9)
    );

    expect(math.equal(math.fraction(1, 2), '0.5')).toBe(true);
    expect(math.equal('0.5', math.fraction(1, 2))).toBe(true);
    expect(() => math.equal(math.fraction(1, 2), Infinity)).toThrow();
    expect(() => math.equal(Infinity, math.fraction(1, 2))).toThrow();

    const toCore = (n: number) => new CoreFraction(n);
    expect(
      mathjsPowFractionPair(new CoreFraction(4, 9), new CoreFraction(1, 2), false, toCore)
    ).toEqual(new CoreFraction(2, 3));
    expect(() =>
      mathjsPowFractionPair(new CoreFraction(-8, 1), new CoreFraction(1, 3), true, toCore)
    ).toThrow(/non-rational/);
    expect(
      mathjsPowFractionPair(new CoreFraction(-1, 1), new CoreFraction(1, 2), false, toCore)
    ).toBeDefined();
    expect(
      mathjsPowFractionPair(new CoreFraction(2, 1), new CoreFraction(1, 2), false, toCore)
    ).toBeCloseTo(Math.SQRT2);
  });

  it('covers isCompatZeroScalar and isSparseStructuralZero across scalar types', () => {
    expect(isCompatZeroScalar(0)).toBe(true);
    expect(isCompatZeroScalar(1e-20)).toBe(true);
    expect(isCompatZeroScalar(1)).toBe(false);
    expect(isCompatZeroScalar(false)).toBe(true);
    expect(isCompatZeroScalar(true)).toBe(false);
    expect(isCompatZeroScalar(0n)).toBe(true);
    expect(isCompatZeroScalar(1n)).toBe(false);
    expect(isCompatZeroScalar('0')).toBe(true);
    expect(isCompatZeroScalar('5')).toBe(false);
    expect(isCompatZeroScalar(math.bignumber(0))).toBe(true);
    expect(isCompatZeroScalar(math.bignumber(2))).toBe(false);
    expect(isCompatZeroScalar(math.complex(0, 0))).toBe(true);
    expect(isCompatZeroScalar(math.complex(1, 0))).toBe(false);
    expect(isCompatZeroScalar(new CoreFraction(0, 1))).toBe(true);
    expect(isCompatZeroScalar(new CoreFraction(1, 2))).toBe(false);
    expect(isCompatZeroScalar(math.fraction(0, 1))).toBe(true);
    expect(isCompatZeroScalar(math.fraction(1, 2))).toBe(false);
    expect(isCompatZeroScalar(math.unit(0, 'm'))).toBe(true);
    expect(isCompatZeroScalar(math.unit(2, 'm'))).toBe(false);
    expect(() => isCompatZeroScalar(math.unit('m'))).toThrow(/Signature not found/);
    expect(isCompatZeroScalar({ isZero: () => true })).toBe(true);
    expect(isCompatZeroScalar({ n: 0 })).toBe(true);
    expect(isCompatZeroScalar({})).toBe(false);

    expect(isSparseStructuralZero(null)).toBe(true);
    expect(isSparseStructuralZero(0)).toBe(true);
    expect(isSparseStructuralZero(1e-100)).toBe(false);
    expect(isSparseStructuralZero(false)).toBe(true);
    expect(isSparseStructuralZero(0n)).toBe(true);
    expect(isSparseStructuralZero(new CoreFraction(0, 1))).toBe(true);
    expect(isSparseStructuralZero(math.fraction(0, 1))).toBe(true);
    expect(isSparseStructuralZero(math.bignumber(0))).toBe(true);
    expect(isSparseStructuralZero(math.unit(0, 'm'))).toBe(true);
    expect(isSparseStructuralZero(math.unit('m'))).toBe(false);
    expect(isSparseStructuralZero({ isZero: () => true })).toBe(true);
    expect(isSparseStructuralZero({})).toBe(false);
  });
});
