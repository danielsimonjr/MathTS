import { describe, it, expect } from 'vitest';
import { create, all, type MathJsInstance as OracleInstance } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Differential tests for Fraction `format`, `string`, `print`, and Fraction-config
 * `ConstantNode.toString` (#1579, #1586), run against the mathjs 15.3.0 oracle (the
 * compat devDependency). Every case compares `typeOf` plus
 * `format(value, { precision: 14 })` on both sides.
 */

type Instance = ReturnType<typeof createCompat> & OracleInstance;

const CASES: [string, (L: Instance) => unknown][] = [
  ['#1579 format(fraction(2))', (L) => L.format(L.fraction(2))],
  ['#1579 format(fraction(0))', (L) => L.format(L.fraction(0))],
  ['#1579 format(fraction(-3))', (L) => L.format(L.fraction(-3))],
  ['#1579 format(fraction([1, 2]))', (L) => L.format(L.fraction([1, 2]))],
  [
    '#1579 format([fraction(1), fraction(2)])',
    (L) => L.format([L.fraction(1), L.fraction(2)] as unknown[]),
  ],
  ['#1579 format(fraction(unit("5 cm")))', (L) => L.format(L.fraction(L.unit('5 cm') as never))],
  ['#1579 string(fraction(1, 3))', (L) => L.string(L.fraction(1, 3))],
  ['#1579 fraction(1, 3).toString()', (L) => L.fraction(1, 3).toString()],
  ['#1579 numeric(4, "Fraction")', (L) => L.numeric(4, 'Fraction')],
  ['#1579 print(fraction(2))', (L) => L.print(L.fraction(2))],
];

describe('Fraction format / string parity (G15)', () => {
  for (const [label, run] of CASES) {
    it(label, () => {
      const oracle = create(all, {});
      const compat = createCompat(compatAll, {});
      const both = [oracle, compat] as const;
      const outcomes = both.map((L) => {
        try {
          return {
            value: L.typeOf(run(L as never)) + ' ' + L.format(run(L as never), { precision: 14 }),
          };
        } catch (e) {
          return {
            error: (e as Error).name,
            message: (e as Error).message.split(':')[0],
          };
        }
      });
      expect(outcomes[1]).toEqual(outcomes[0]);
    });
  }

  it('#1579 format(fraction(2)) is exactly "2/1"', () => {
    const compat = createCompat(compatAll, {});
    expect(compat.format(compat.fraction(2))).toBe('2/1');
  });

  it('#1579 string(fraction(1, 3)) is exactly "0.(3)"', () => {
    const compat = createCompat(compatAll, {});
    expect(compat.string(compat.fraction(1, 3))).toBe('0.(3)');
  });

  it('#1579 fraction(1, 3).toString() keeps the repeating decimal', () => {
    const compat = createCompat(compatAll, {});
    expect(compat.fraction(1, 3).toString()).toBe('0.(3)');
  });
});

describe('Fraction-config ConstantNode.toString parity (G15, #1586)', () => {
  it('#1586 parse("1/3 + 1/4").toString() matches the oracle', () => {
    const oracle = create(all, { number: 'Fraction' });
    const compat = createCompat(compatAll, { number: 'Fraction' });
    expect(compat.parse('1/3 + 1/4').toString()).toBe(oracle.parse('1/3 + 1/4').toString());
  });

  it('#1586 parse("1/3 + 1/4").toString() is the mathjs ratio form', () => {
    const compat = createCompat(compatAll, { number: 'Fraction' });
    expect(compat.parse('1/3 + 1/4').toString()).toBe('1/1 / 3/1 + 1/1 / 4/1');
  });

  it('#1586 evaluate("1/3 + 1/4") stays the Fraction 7/12', () => {
    const compat = createCompat(compatAll, { number: 'Fraction' });
    const value = compat.evaluate('1/3 + 1/4') as { numerator: bigint; denominator: bigint };
    expect(compat.typeOf(value)).toBe('Fraction');
    expect(value.numerator).toBe(7n);
    expect(value.denominator).toBe(12n);
  });
});
