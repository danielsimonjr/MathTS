import { describe, expect, it } from 'vitest';
import { expectSame } from './differential.js';
import { pair } from './oracle.js';

/**
 * #1555 — `nullish` must not convert a non-nullish first argument.
 *
 * mathjs 15.3.0 oracle: `nullish(fraction(1,3), 2)` is `Fraction 1/3`. compat converted
 * Fraction to Complex because the typed `nullish` had no `Fraction, any` signature, so
 * typed-function's conversion table applied before `any, any`.
 */

// The parity harness passes the instance as a Record<string, unknown>; cast once at
// this choke point so the calls below are checked calls on an unknown surface.
type Lib = Record<string, (...args: unknown[]) => unknown> & {
  typeOf(v: unknown): string;
  format(v: unknown, o: { precision: number }): string;
  evaluate(expression: string): unknown;
};
const asLib = (L: Record<string, unknown>): Lib => L as unknown as Lib;

describe('nullish (#1555)', () => {
  // The four repro rows from the issue.
  it('matches the mathjs oracle on the issue repro rows', () => {
    expectSame('nullish: (Fraction 1/3, number 2)', {}, (L) =>
      asLib(L).nullish(asLib(L).fraction(1, 3), 2)
    );
    expectSame('nullish: (Fraction 1/3, Fraction 1/2)', {}, (L) =>
      asLib(L).nullish(asLib(L).fraction(1, 3), asLib(L).fraction(1, 2))
    );
    expectSame('nullish: (null, Fraction 1/2)', {}, (L) =>
      asLib(L).nullish(null, asLib(L).fraction(1, 2))
    );
    expectSame('nullish: (Unit 5 cm, number 1)', {}, (L) =>
      asLib(L).nullish(asLib(L).unit('5 cm'), 1)
    );
  });

  // Acceptance criteria: a non-nullish first argument is returned unchanged for every
  // type in the list; null and undefined return the second argument unchanged.
  it('returns a non-nullish first argument unchanged across types', () => {
    expectSame('nullish: (number 0.5, number 2)', {}, (L) => asLib(L).nullish(0.5, 2));
    expectSame('nullish: (bigint 10, number 2)', {}, (L) => asLib(L).nullish(10n, 2));
    expectSame('nullish: (BigNumber 0.5, number 2)', {}, (L) =>
      asLib(L).nullish(asLib(L).bignumber(0.5), 2)
    );
    expectSame('nullish: (Complex 1+2i, number 2)', {}, (L) =>
      asLib(L).nullish(asLib(L).complex(1, 2), 2)
    );
    expectSame('nullish: (string "", number 2)', {}, (L) => asLib(L).nullish('', 2));
    expectSame('nullish: (boolean false, number 2)', {}, (L) => asLib(L).nullish(false, 2));
    expectSame('nullish: (Array [1, 2], number 2)', {}, (L) => asLib(L).nullish([1, 2], 2));
    expectSame('nullish: (Matrix [[1, 2]], number 2)', {}, (L) =>
      asLib(L).nullish(asLib(L).matrix([[1, 2]]), 2)
    );
  });

  it('returns the second argument unchanged for null and undefined first arguments', () => {
    expectSame('nullish: (null, number 5)', {}, (L) => asLib(L).nullish(null, 5));
    expectSame('nullish: (undefined, number 5)', {}, (L) => asLib(L).nullish(undefined, 5));
    expectSame('nullish: (null, Array [1, 2])', {}, (L) => asLib(L).nullish(null, [1, 2]));
    expectSame('nullish: (undefined, Matrix [[1, 2]])', {}, (L) =>
      asLib(L).nullish(undefined, asLib(L).matrix([[1, 2]]))
    );
  });

  it('returns a null second argument as null (null is not replaced by a default)', () => {
    expectSame('nullish: (null, null)', {}, (L) => asLib(L).nullish(null, null));
    expectSame('nullish: (number 1, null)', {}, (L) => asLib(L).nullish(1, null));
  });

  // The `??` operator uses the same `nullish` implementation through the expression
  // transform; the Fraction signature must reach the evaluator too.
  it('reaches the expression evaluator via the ?? operator', () => {
    const { compat, mathjs } = pair({});
    expect(String(asLib(compat).evaluate('fraction(1,3) ?? 2'))).toBe(
      String(asLib(mathjs).evaluate('fraction(1,3) ?? 2'))
    );
    expect(asLib(compat).evaluate('fraction(1,3) ?? 2')).not.toHaveProperty('im');
  });

  it('keeps compat named export and instance property the same function', () => {
    const { compat } = pair({});
    // typeOf of a Fraction result, not Complex — the regression this issue pins.
    const v = asLib(compat).nullish(asLib(compat).fraction(1, 3), 2);
    expect(asLib(compat).typeOf(v)).toBe('Fraction');
    expect(asLib(compat).format(v, { precision: 14 })).toBe('1/3');
  });
});
