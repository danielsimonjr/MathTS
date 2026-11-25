import { describe, expect, it } from 'vitest';
import { expectSame } from './differential.js';
import { pair } from './oracle.js';

/**
 * G07 adversarial probes (#1555: `nullish` must not convert a Fraction).
 *
 * The builder's `g07-nullish.test.ts` proves the scalar Fraction/Unit rows of the fix. These
 * probes push past those acceptance rows against the live mathjs 15.3.0 oracle and find real
 * divergences — every `it` below fails on the G07 head `57dc4b5f`. Controls that must pass are
 * marked "control"; they place the failure on a specific surface rather than on the operator.
 *
 *  F1  P1  `math.nullish` is not element-wise on a collection: a `null`/`undefined` element is
 *          left in place instead of replaced, and a Dimension mismatch is not thrown. The
 *          `??` operator path (compat.evaluate) does the right thing, so `nullish` and `??`
 *          disagree inside one instance.
 *  F2  P2  `not`/`and`/`or`/`xor` read a `Unit` through the JS-truthiness `any` fallback with no
 *          `Unit` signature, so any Unit is truthy: `not(unit('0 cm'))` is false (oracle true),
 *          `xor(unit('5 cm'), unit('0 cm'))` is false (oracle true). The same missing-signature
 *          class the plan asks about, on the sibling logical functions.
 *  F3  P3  a whole-number Fraction renders `2` instead of `2/1`, which the new G07 surface now
 *          exposes (`nullish(fraction(2), 1)`, `fraction(2) ?? 1`, `format(fraction(2))`).
 *  F4  P3  `nullish` accepts a plain object and returns it, where the oracle throws `TypeError`
 *          (no `any, any` signature) and no `intentional.ts` entry records the superset.
 */

type Lib = Record<string, (...args: unknown[]) => unknown> & {
  typeOf(v: unknown): string;
  format(v: unknown, o: Record<string, unknown>): string;
  evaluate(expression: string, scope?: unknown, options?: unknown): unknown;
  fraction(a?: unknown, b?: unknown): unknown;
  unit(a: string): unknown;
  matrix(a: unknown): unknown;
};
const asLib = (L: Record<string, unknown>): Lib => L as unknown as Lib;

describe('G07 F1 — nullish must be element-wise on a collection (mathjs 15.3.0)', () => {
  // Control: the ?? operator already matches the oracle on the same input, so the divergence is
  // specific to the `math.nullish` surface, not to nullish semantics in general.
  it('control: the ?? operator fills nullish collection elements like the oracle', () => {
    const { compat, mathjs } = pair({});
    expect(String(asLib(compat).evaluate('[null, 1, null] ?? 7'))).toBe(
      String(asLib(mathjs).evaluate('[null, 1, null] ?? 7'))
    );
  });

  it('nullish([null, 1, null], 7) fills each nullish element (oracle [7, 1, 7])', () => {
    expectSame('nullish: (Array [null,1,null], number 7)', {}, (L) =>
      asLib(L).nullish([null, 1, null], 7)
    );
  });

  it('nullish([null, 1], 7) fills the leading nullish element (oracle [7, 1])', () => {
    expectSame('nullish: (Array [null,1], number 7)', {}, (L) => asLib(L).nullish([null, 1], 7));
  });

  it('nullish([[null, 1]], 9) fills nested nullish elements', () => {
    expectSame('nullish: (Array [[null,1]], number 9)', {}, (L) =>
      asLib(L).nullish([[null, 1]], 9)
    );
  });

  it('nullish(matrix([null, 1]), 7) fills matrix nullish elements', () => {
    expectSame('nullish: (DenseMatrix [null,1], number 7)', {}, (L) =>
      asLib(L).nullish(asLib(L).matrix([null, 1]), 7)
    );
  });

  it('nullish([null, 1], [7]) throws Dimension mismatch, as the oracle does', () => {
    expectSame('nullish: (Array [null,1], Array [7])', {}, (L) => asLib(L).nullish([null, 1], [7]));
  });

  // Control: a nullish second argument to a scalar first argument still short-circuits.
  it('control: nullish([1, 2], null) returns the Array unchanged (both sides agree)', () => {
    expectSame('nullish: (Array [1,2], null)', {}, (L) => asLib(L).nullish([1, 2], null));
  });
});

describe('G07 F2 — logical functions must read a Unit by value, not JS truthiness', () => {
  it('not(unit("0 cm")) is true (a zero Unit is falsy), as the oracle', () => {
    expectSame('not: (Unit 0 cm)', {}, (L) => asLib(L).not(asLib(L).unit('0 cm')));
  });

  it('not(unit("0 s")) is true (every zero Unit, not one dimension)', () => {
    expectSame('not: (Unit 0 s)', {}, (L) => asLib(L).not(asLib(L).unit('0 s')));
  });

  it('xor(unit("5 cm"), unit("0 cm")) is true (oracle), not false', () => {
    expectSame('xor: (Unit 5 cm, Unit 0 cm)', {}, (L) =>
      asLib(L).xor(asLib(L).unit('5 cm'), asLib(L).unit('0 cm'))
    );
  });

  it('or(unit("0 cm"), unit("0 cm")) is false (oracle), not true', () => {
    expectSame('or: (Unit 0 cm, Unit 0 cm)', {}, (L) =>
      asLib(L).or(asLib(L).unit('0 cm'), asLib(L).unit('0 cm'))
    );
  });

  it('and(unit("0 cm"), unit("2 cm")) is false (oracle), not true', () => {
    expectSame('and: (Unit 0 cm, Unit 2 cm)', {}, (L) =>
      asLib(L).and(asLib(L).unit('0 cm'), asLib(L).unit('2 cm'))
    );
  });

  // Control: a non-zero Unit already agrees, so the bug is specifically the zero (falsy) Unit.
  it('control: not(unit("5 cm")) is false on both sides', () => {
    expectSame('not: (Unit 5 cm)', {}, (L) => asLib(L).not(asLib(L).unit('5 cm')));
  });
});

describe('G07 F3 — a whole-number Fraction keeps its ratio rendering', () => {
  it('format(fraction(2)) is "2/1" (the rendering every nullish Fraction row inherits)', () => {
    expectSame('format: Fraction 2/1', {}, (L) => asLib(L).format(asLib(L).fraction(2), {}));
  });

  it('nullish(fraction(2), 1) formats as "2/1", as the oracle', () => {
    expectSame('nullish: (Fraction 2/1, number 1)', {}, (L) =>
      asLib(L).nullish(asLib(L).fraction(2), 1)
    );
  });

  it('nullish(fraction(0), 1) formats as "0/1"', () => {
    expectSame('nullish: (Fraction 0/1, number 1)', {}, (L) =>
      asLib(L).nullish(asLib(L).fraction(0), 1)
    );
  });

  it('evaluate("fraction(2) ?? 1") formats as "2/1"', () => {
    expectSame('evaluate: fraction(2) ?? 1', {}, (L) => asLib(L).evaluate('fraction(2) ?? 1'));
  });

  // Control: a non-integer Fraction already renders identically, so this is the integer case.
  it('control: format(fraction(1, 3)) is "1/3" on both sides', () => {
    expectSame('format: Fraction 1/3', {}, (L) => asLib(L).format(asLib(L).fraction(1, 3), {}));
  });
});

describe('G07 F4 — nullish accepts a plain object the oracle rejects', () => {
  // mathjs 15.3.0 `nullish` has no `any, any` signature, so an unlisted type throws a TypeError.
  // compat's `any, any` fallback returns the value. A *function* is named in the plan prose, so
  // only the plain object is an undocumented divergence; if the superset is intended it belongs
  // in `intentional.ts` with a `docs/api/compat.md` note.
  it('nullish({}, 2) throws TypeError like the oracle (or is recorded as intentional)', () => {
    expectSame('nullish: (Object {}, number 2)', {}, (L) => asLib(L).nullish({}, 2));
  });
});
