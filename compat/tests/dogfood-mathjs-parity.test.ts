/**
 * Dogfood issues #889, #891, #892 — compat output against the mathjs oracle.
 *
 * The compat package is imported by name (built dist), as a consumer does.
 * The oracle is the mathjs devDependency of this package.
 */

import { describe, it, expect } from 'vitest';
import { create, all } from '@danielsimonjr/mathts-compat';
import { create as mjCreate, all as mjAll } from 'mathjs';

/** Both libraries seen through one loose shape: this file compares output, not types. */
type Lib = Record<string, (...args: unknown[]) => { toString(): string }>;

describe('dogfood mathjs parity (#889, #891, #892)', () => {
  it('#891 matrix toString matches mathjs for 1xn, nx1 and 2x2', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    expect(mt.matrix([[1, 2]]).toString()).toBe(mj.matrix([[1, 2]]).toString());
    expect(mt.matrix([[1], [2]]).toString()).toBe(mj.matrix([[1], [2]]).toString());
    expect(
      mt
        .matrix([
          [1, 2],
          [3, 4],
        ])
        .toString()
    ).toBe(
      mj
        .matrix([
          [1, 2],
          [3, 4],
        ])
        .toString()
    );
    expect(mt.matrix([[1, 2]]).toString()).toBe('[[1, 2]]');
  });

  it('#892 fraction mode evaluate("1/3").toString() matches mathjs 0.(3)', () => {
    const mt = create(all, { number: 'Fraction' });
    const mj = mjCreate(mjAll, { number: 'Fraction' });
    const mtFrac = mt.evaluate('1/3') as { toString(): string };
    const mjFrac = mj.evaluate('1/3') as { toString(): string };
    expect(mtFrac.toString()).toBe(mjFrac.toString());
    expect(mtFrac.toString()).toBe('0.(3)');
  });

  it('#889 scalar sin has the same parity as mathjs', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    for (const x of [0, 0.5, -1.25, Math.PI]) {
      expect(mt.sin(x)).toBe(mj.sin(x));
    }
    // The speed property is pinned by tests/unary-fast-path.test.ts (a counter, not a clock).
  });

  describe('#891 matrix toString: every entry type matches mathjs', () => {
    const mt = create(all) as unknown as Lib;
    const mj = mjCreate(mjAll) as unknown as Lib;
    const cases: Record<string, (m: Lib) => { toString(): string }> = {
      threeD: (m) =>
        m.matrix([
          [
            [1, 2],
            [3, 4],
          ],
          [
            [5, 6],
            [7, 8],
          ],
        ]),
      empty2d: (m) => m.matrix([[]]),
      empty: (m) => m.matrix([]),
      vector: (m) => m.matrix([1, 2, 3]),
      sparse: (m) =>
        m.sparse([
          [1, 0],
          [0, 2],
        ]),
      complex: (m) => m.matrix([[m.complex(1, 2), 3]]),
      fraction: (m) => m.matrix([[m.fraction(1, 3), 2]]),
      unit: (m) => m.matrix([[m.unit('5 cm'), 2]]),
      bignumber: (m) => m.matrix([[m.bignumber('0.1'), 2]]),
      strings: (m) => m.matrix([['a', 'b']]),
      booleans: (m) => m.matrix([[true, false]]),
    };
    for (const [name, make] of Object.entries(cases)) {
      it(name, () => {
        expect(make(mt).toString()).toBe(make(mj).toString());
      });
    }
  });

  it('#889 edge inputs of the unary fast path match mathjs', () => {
    const mt = create(all) as unknown as Lib;
    const mj = mjCreate(mjAll) as unknown as Lib;
    const show = (f: () => unknown) => {
      try {
        return String(f());
      } catch {
        return 'ERR';
      }
    };
    for (const fn of ['asin', 'acos', 'log', 'sqrt', 'sin', 'atan'] as const) {
      for (const x of [Infinity, -Infinity]) {
        expect(
          show(() => mt[fn](x)),
          `${fn}(${x})`
        ).toBe(show(() => mj[fn](x)));
      }
    }
  });

  // Documented parity exception: a NaN number stays a real NaN through asin, acos and log
  // (the staysReal* rule of the typed functions: NaN input is not a domain error). mathjs
  // returns Complex NaN. The printed text is the same; only the result type differs.
  it('#889 documented exception: asin, acos and log of NaN stay a real NaN', () => {
    const mt = create(all) as unknown as Lib;
    const mj = mjCreate(mjAll) as unknown as Lib;
    for (const fn of ['asin', 'acos', 'log'] as const) {
      expect(mt[fn](NaN), fn).toBeNaN();
      expect(typeof mt[fn](NaN), fn).toBe('number');
      expect(String(mt[fn](NaN))).toBe(String(mj[fn](NaN)));
    }
  });
});
