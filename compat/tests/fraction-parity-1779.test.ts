/**
 * #1779 — fraction.js surface: `toString`, `valueOf`, `toJSON`, `fraction()`, and replacer.
 */
import { describe, expect, it } from 'vitest';
import { create, all, replacer, type MathjsFraction } from '../src/index.js';
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
