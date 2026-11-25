import { describe, it, expect } from 'vitest';
import { create, all, type MathJsInstance as OracleInstance } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { expectSame } from './differential.js';

/**
 * Differential tests for issue #1551 (G03): `isPositive` / `isNegative` on Fractions.
 * The MathTS `Fraction` stores `numerator` / `denominator`, not the fraction.js fields
 * `s` / `n`, so the signatures read `undefined` and always returned `false`. The fix
 * routes them through the Fraction's own `isPositive()` / `isNegative()`.
 *
 * Every case compares `typeOf` + `format(value, { precision: 14 })` against the mathjs
 * 15.3.0 oracle (the compat devDependency) built with the same config.
 */

type Instance = ReturnType<typeof createCompat> & OracleInstance;

const CASES: [string, (L: Instance) => unknown][] = [
  ['#1551 isPositive(fraction(1,3))', (L) => L.isPositive(L.fraction(1, 3))],
  ['#1551 isNegative(fraction(-1,3))', (L) => L.isNegative(L.fraction(-1, 3))],
  ['#1551 isPositive(fraction(-1,3))', (L) => L.isPositive(L.fraction(-1, 3))],
  [
    '#1551 isNegative([fraction(-1,2), fraction(1,2)])',
    (L) => L.isNegative([L.fraction(-1, 2), L.fraction(1, 2)]),
  ],
  ['#1551 isZero(fraction(0))', (L) => L.isZero(L.fraction(0))],
  [
    '#1551 isPositive(matrix of fractions)',
    (L) =>
      L.isPositive(
        L.matrix([
          [L.fraction(1, 3), L.fraction(-1, 3)],
          [L.fraction(0), L.fraction(2, 5)],
        ])
      ),
  ],
  [
    '#1551 isNegative(DenseMatrix of fractions)',
    (L) => L.isNegative(L.matrix([[L.fraction(-1, 3), L.fraction(1, 3)]])),
  ],
  [
    '#1551 isPositive(fraction(2)) — whole fraction, denominator 1',
    (L) => L.isPositive(L.fraction(2)),
  ],
  // Same root-cause reads of the fraction.js fields `.d` / `.s` / `.n` on
  // Fraction-typed values, fixed with the Fraction's own API:
  ['#1551 isInteger(fraction(2))', (L) => L.isInteger(L.fraction(2))],
  ['#1551 isInteger(fraction(-7,2))', (L) => L.isInteger(L.fraction(-7, 2))],
  [
    '#1551 isInteger([fraction(2), fraction(-7,2)])',
    (L) => L.isInteger([L.fraction(2), L.fraction(-7, 2)]),
  ],
  ['#1551 fix(fraction(7,2))', (L) => L.fix(L.fraction(7, 2))],
  ['#1551 fix(fraction(-7,2))', (L) => L.fix(L.fraction(-7, 2))],
  [
    '#1551 fix([fraction(-7,2), fraction(7,2)])',
    (L) => L.fix([L.fraction(-7, 2), L.fraction(7, 2)]),
  ],
  [
    '#1551 fix(matrix of fractions)',
    (L) => L.fix(L.matrix([[L.fraction(-7, 2), L.fraction(7, 2)]])),
  ],
  ['#1551 format(fraction(2)) prints n/1', (L) => L.format(L.fraction(2))],
  ['#1551 format(fraction(1,3))', (L) => L.format(L.fraction(1, 3))],
  ['#1551 format(null) does not throw', (L) => L.format(null)],
  ['#1551 max([], 0)', (L) => L.max([], 0)],
  ['#1551 min([], 0)', (L) => L.min([], 0)],
  ['#1551 sum([], 0)', (L) => L.sum([], 0)],
];

describe('G03 fraction sign predicates (#1551)', () => {
  it.each(CASES)('%s matches mathjs 15.3.0', (_label, run) => {
    expectSame(_label, undefined, run as (L: Record<string, unknown>) => unknown);
  });

  it('returns the issue-expected booleans: true, true, false, [true, false], true', () => {
    const compat = createCompat(compatAll) as Instance;
    const oracle = create(all) as unknown as Instance;

    const compatResults = [
      compat.isPositive(compat.fraction(1, 3)),
      compat.isNegative(compat.fraction(-1, 3)),
      compat.isPositive(compat.fraction(-1, 3)),
      compat.isNegative([compat.fraction(-1, 2), compat.fraction(1, 2)]),
      compat.isZero(compat.fraction(0)),
    ];
    expect(compatResults).toEqual([true, true, false, [true, false], true]);

    const oracleResults = [
      oracle.isPositive(oracle.fraction(1, 3)),
      oracle.isNegative(oracle.fraction(-1, 3)),
      oracle.isPositive(oracle.fraction(-1, 3)),
      oracle.isNegative([oracle.fraction(-1, 2), oracle.fraction(1, 2)]),
      oracle.isZero(oracle.fraction(0)),
    ];
    expect(compatResults).toEqual(oracleResults);
  });
});
