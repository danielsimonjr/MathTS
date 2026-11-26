/**
 * #1775: `string()` with no arguments returns `''`, not `'undefined'`, and more
 * than one argument throws the mathjs 15.3.0 typed-function "Too many arguments"
 * TypeError instead of silently converting the first argument.
 *
 * Reference: mathjs 15.3.0 `test/unit-tests/type/string.test.js`
 * (`string should be '' if called with no argument`, `string should throw an
 * error if called with wrong number of arguments`).
 */
import { describe, expect, it } from 'vitest';
import { create as createOracle, all as oracleAll } from 'mathjs';
import { create, all } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const compat = create(all) as unknown as Record<string, Fn>;
const oracle = createOracle(oracleAll) as unknown as Record<string, Fn>;
const stringFn = compat.string;
const oracleString = oracle.string;

describe('#1775 compat string() with no arguments', () => {
  it("returns '' like mathjs", () => {
    expect(stringFn()).toBe('');
    expect(oracleString()).toBe('');
  });

  it('still converts undefined through the any signature like mathjs', () => {
    expect(stringFn(undefined)).toBe('undefined');
    expect(oracleString(undefined)).toBe('undefined');
  });
});

describe('#1775 compat string() rejects too many arguments', () => {
  it('throws the mathjs TypeError for 2 and 3 arguments', () => {
    for (const args of [
      [1, 2],
      [1, 2, 3],
    ]) {
      expect(() => stringFn(...args)).toThrow(TypeError);
      expect(() => stringFn(...args)).toThrow(
        new RegExp(
          `Too many arguments in function string \\(expected: 1, actual: ${String(args.length)}\\)`
        )
      );
      let oracleMessage = '';
      try {
        oracleString(...args);
      } catch (error) {
        oracleMessage = (error as Error).message;
      }
      expect(oracleMessage).toContain('Too many arguments');
      let compatMessage = '';
      try {
        stringFn(...args);
      } catch (error) {
        compatMessage = (error as Error).message;
      }
      expect(compatMessage).toBe(oracleMessage);
    }
  });
});

describe('#1775 existing string conversions keep matching mathjs', () => {
  const CASES: unknown[] = [
    true,
    false,
    null,
    'hello',
    '',
    ' ',
    [
      [2, true],
      ['hi', null],
    ],
    [true, false],
    1 / 8,
    2.1e-3,
    123456789,
    2000000,
    0,
    -3,
    0.5,
    NaN,
    Infinity,
    2n,
    -3n,
  ];

  it.each(CASES.map((value) => [value] as [unknown]))('string(%p) matches mathjs', (value) => {
    const oracleResult = JSON.stringify(oracleString(value));
    expect(JSON.stringify(stringFn(value))).toBe(oracleResult);
  });

  it('converts matrix elements', () => {
    const matrixInput = compat.matrix([
      [2, true],
      ['hi', null],
    ]);
    const expected = oracleString(
      oracle.matrix([
        [2, true],
        ['hi', null],
      ])
    );
    expect(JSON.stringify(stringFn(matrixInput))).toBe(JSON.stringify(expected));
  });

  it('converts a bignumber, a complex and a unit like mathjs', () => {
    expect(stringFn(compat.bignumber('2.3e+500'))).toBe(oracleString(oracle.bignumber('2.3e+500')));
    expect(stringFn(compat.complex(2, 3))).toBe('2 + 3i');
    expect(stringFn(compat.unit('5cm'))).toBe('5 cm');
  });
});
