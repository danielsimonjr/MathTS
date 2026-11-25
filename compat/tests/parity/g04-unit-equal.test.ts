import { describe, it, expect } from 'vitest';
import { create, all, type MathJsInstance as OracleInstance } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Differential tests for Unit equality with BigNumber values (#1552), run against the
 * mathjs 15.3.0 oracle (the compat devDependency). `50cm == 0.5m` must be `true` under
 * `number: 'BigNumber'`, and the relational family (equal, unequal, equalScalar,
 * deepEqual, larger, smaller, largerEq, smallerEq) must agree with the oracle on equal,
 * unequal, prefix-only, and dimension-mismatch Unit pairs in both number modes.
 *
 * Every case compares `typeOf` plus `format(value, { precision: 14 })`, or the thrown
 * error name and message prefix, with the oracle.
 */

type Instance = ReturnType<typeof createCompat> & OracleInstance;

const BIG = { number: 'BigNumber' } as const;

/** One unit pair spec, built through the instance under test. */
interface UnitPair {
  label: string;
  make: (L: Instance) => [unknown, unknown];
}

const PAIRS: UnitPair[] = [
  {
    label: 'equal: 50cm vs 0.5m',
    make: (L) => [L.unit(L.bignumber(50), 'cm'), L.unit(L.bignumber(0.5), 'm')],
  },
  {
    label: 'equal: 1m vs 100cm',
    make: (L) => [L.unit(L.bignumber(1), 'm'), L.unit(L.bignumber(100), 'cm')],
  },
  {
    label: 'unequal: 50cm vs 0.6m',
    make: (L) => [L.unit(L.bignumber(50), 'cm'), L.unit(L.bignumber(0.6), 'm')],
  },
  {
    label: 'prefix pair: 1cm vs 10mm',
    make: (L) => [L.unit(L.bignumber(1), 'cm'), L.unit(L.bignumber(10), 'mm')],
  },
  {
    label: 'dimension mismatch: 50cm vs 5kg',
    make: (L) => [L.unit(L.bignumber(50), 'cm'), L.unit(L.bignumber(5), 'kg')],
  },
];

const NUMBER_PAIRS: UnitPair[] = [
  { label: 'equal: 50cm vs 0.5m', make: (L) => [L.unit(50, 'cm'), L.unit(0.5, 'm')] },
  { label: 'equal: 1m vs 100cm', make: (L) => [L.unit(1, 'm'), L.unit(100, 'cm')] },
  { label: 'unequal: 50cm vs 0.6m', make: (L) => [L.unit(50, 'cm'), L.unit(0.6, 'm')] },
  { label: 'prefix pair: 1cm vs 10mm', make: (L) => [L.unit(1, 'cm'), L.unit(10, 'mm')] },
  {
    label: 'dimension mismatch: 50cm vs 5kg',
    make: (L) => [L.unit(50, 'cm'), L.unit(5, 'kg')],
  },
];

/** The relational functions the issue names, applied to a Unit pair. */
const RELATIONALS: [string, (L: Instance, x: unknown, y: unknown) => unknown][] = [
  ['equal', (L, x, y) => L.equal(x, y)],
  ['unequal', (L, x, y) => L.unequal(x, y)],
  ['equalScalar', (L, x, y) => L.equalScalar(x, y)],
  ['deepEqual', (L, x, y) => L.deepEqual(x, y)],
  ['larger', (L, x, y) => L.larger(x, y)],
  ['smaller', (L, x, y) => L.smaller(x, y)],
  ['largerEq', (L, x, y) => L.largerEq(x, y)],
  ['smallerEq', (L, x, y) => L.smallerEq(x, y)],
];

function show(
  L: { typeOf(v: unknown): string; format(v: unknown, o: object): string },
  v: unknown
) {
  return L.typeOf(v) + ' ' + L.format(v, { precision: 14 });
}

function outcome(L: Instance, run: () => unknown): string {
  try {
    return show(L, run());
  } catch (e) {
    const err = e as Error;
    return 'throws ' + err.name + ': ' + err.message.split(':')[0];
  }
}

/** #1552 repro rows, evaluated as expression strings under both configs. */
const EXPRESSION_CASES: [string, string][] = [
  ['50cm == 0.5m', 'boolean true'],
  ['50cm != 0.5m', 'boolean false'],
  ['1m == 100cm', 'boolean true'],
  ['50cm - 0.5m', 'Unit 0 m'],
];

describe('Unit equality with BigNumber values (#1552)', () => {
  describe('issue repro rows', () => {
    for (const [expression, expected] of EXPRESSION_CASES) {
      it(`evaluate('${expression}') under number: 'BigNumber' is ${expected}`, () => {
        const compat = createCompat(compatAll, BIG) as Instance;
        const oracle = create(all, BIG) as unknown as Instance;
        expect(show(compat, compat.evaluate(expression))).toBe(expected);
        expect(show(oracle, oracle.evaluate(expression))).toBe(expected);
      });
    }

    it("equal(unit(bignumber(50), 'cm'), unit(bignumber(0.5), 'm')) is true", () => {
      const compat = createCompat(compatAll, BIG) as Instance;
      expect(
        compat.equal(
          compat.unit(compat.bignumber(50), 'cm'),
          compat.unit(compat.bignumber(0.5), 'm')
        )
      ).toBe(true);
    });

    it('number-mode twins match the oracle', () => {
      const compat = createCompat(compatAll, {}) as Instance;
      const oracle = create(all, {}) as unknown as Instance;
      for (const [expression] of EXPRESSION_CASES) {
        expect(show(compat, compat.evaluate(expression))).toBe(
          show(oracle, oracle.evaluate(expression))
        );
      }
    });
  });

  describe('relational family on Unit pairs (BigNumber values)', () => {
    for (const pair of PAIRS) {
      for (const [name, run] of RELATIONALS) {
        it(`${name}(${pair.label})`, () => {
          const oracle = create(all, BIG) as unknown as Instance;
          const compat = createCompat(compatAll, BIG) as Instance;
          const [ox, oy] = pair.make(oracle);
          const [cx, cy] = pair.make(compat);
          expect(outcome(compat, () => run(compat, cx, cy))).toBe(
            outcome(oracle, () => run(oracle, ox, oy))
          );
        });
      }
    }
  });

  describe('relational family on Unit pairs (number values)', () => {
    for (const pair of NUMBER_PAIRS) {
      for (const [name, run] of RELATIONALS) {
        it(`${name}(${pair.label})`, () => {
          const oracle = create(all, {}) as unknown as Instance;
          const compat = createCompat(compatAll, {}) as Instance;
          const [ox, oy] = pair.make(oracle);
          const [cx, cy] = pair.make(compat);
          expect(outcome(compat, () => run(compat, cx, cy))).toBe(
            outcome(oracle, () => run(oracle, ox, oy))
          );
        });
      }
    }
  });
});
