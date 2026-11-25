import { describe, expect, it } from 'vitest';
import { expectSame } from './differential.js';
import { pair } from './oracle.js';

/**
 * G07 adversarial probes (#1555: `nullish` must not convert a Fraction).
 *
 * Tests `@danielsimonjr/mathts-compat` `create(all)` only (oracle: mathjs 15.3.0).
 *
 * F3 (Fraction `format` / `2/1`) is owned by G15 (#1721); those rows live there, not here.
 *
 * Native finding (not asserted here): `@danielsimonjr/mathts-functions` typed `nullish` still
 * converts a non-nullish Fraction to Complex and uses loose `any, any`; typed logical ops treat
 * Units as object-truthy. Left unchanged per critical-library policy — compat factory bindings
 * supply mathjs parity.
 *
 *  F1  `math.nullish` must be element-wise on collections (same implementation as `??`).
 *  F2  `not`/`and`/`or`/`xor` must read a `Unit` by value, not JS object truthiness.
 *  F4  `nullish({}, 2)` must throw `TypeError` like mathjs (no undocumented `any, any`).
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

  it('control: not(unit("5 cm")) is false on both sides', () => {
    expectSame('not: (Unit 5 cm)', {}, (L) => asLib(L).not(asLib(L).unit('5 cm')));
  });
});

describe('G07 F4 — nullish accepts a plain object the oracle rejects', () => {
  it('nullish({}, 2) throws TypeError like the oracle (or is recorded as intentional)', () => {
    expectSame('nullish: (Object {}, number 2)', {}, (L) => asLib(L).nullish({}, 2));
  });
});
