import { describe, it, expect } from 'vitest';
import { create, all, type MathJsInstance as OracleInstance } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Adversarial probes for G15 (#1579, #1586) under Daniel's 2026-11-25 policy:
 *
 *   1. `mathts-compat` copies mathjs 15.3.0 EXACTLY, quirks included.
 *   2. Native MathTS outside the critical libraries adopts mathjs behavior only when it is a
 *      genuinely better idea; mathjs cosmetic quirks stay in compat.
 *   3. The critical libraries (typed-function, core, matrix, functions, workerpool, GPU,
 *      parallel) are never changed to match mathjs.
 *
 * So every `it` here compares the `create(all)` compat instance against the pinned mathjs
 * 15.3.0 oracle. Each one FAILS today, because PR #1721 closed these gaps by editing `core` and
 * `functions` instead of `compat/`; with those native edits reverted the compat instance falls
 * back to native behavior. Each failure is a place the fix must move into `compat/`.
 *
 * The last `describe` block pins the native core/expression output at its `main` values, so a
 * future attempt to "fix" these inside the critical libraries breaks it.
 *
 * Findings (compat gaps; see the PR body for the critical-library diffs to revert):
 *   F1  `format(fraction)` does not print the integral ratio: `format(fraction(2))` is `"2"`,
 *       oracle `"2/1"`; arrays (`[1, 2]` vs `[1/1, 2/1]`), units (`5 cm` vs `5/1 cm`) and
 *       `numeric(4, 'Fraction')` (`4` vs `4/1`) follow.
 *   F2  `string(fraction)` returns the float, `"0.3333333333333333"`, not `"0.(3)"`.
 *   F3  Under `number: 'Fraction'`, `parse('1/3 + 1/4').toString()` is `"1 / 3 + 1 / 4"`, not
 *       `"1/1 / 3/1 + 1/1 / 4/1"`; `parse('2').toString()` is `"2"`, not `"2/1"`.
 *   F4  `print(fraction(2))` throws `expected: string`; the oracle throws `expected: string or
 *       boolean`.
 *   F5  `string(fraction)` of a long period / long terminating expansion is not the mathjs
 *       `fraction.js` form (1000-digit cap and no 15-digit truncation) — a native `toString`
 *       quirk that compat must adapt around, not "fix" in core.
 */

type Instance = ReturnType<typeof createCompat> & OracleInstance;

const oracle = (config: Record<string, unknown> = {}) => create(all, config) as unknown as Instance;
const compat = (config: Record<string, unknown> = {}) =>
  createCompat(compatAll, config) as unknown as Instance;

/** Run `fn` on both instances and return the two string outcomes (ok text or a thrown error). */
function both(fn: (l: Instance) => unknown, config: Record<string, unknown> = {}) {
  const run = (l: Instance): string => {
    try {
      const v = fn(l);
      return typeof v === 'string' ? v : String(v);
    } catch (e) {
      return 'ERR ' + (e as Error).name + ': ' + (e as Error).message;
    }
  };
  return { o: run(oracle(config)), c: run(compat(config)) };
}

/** Assert compat matches the oracle; the message prints both sides. */
function expectParity(fn: (l: Instance) => unknown, config: Record<string, unknown> = {}) {
  const { o, c } = both(fn, config);
  expect(c, `oracle=${JSON.stringify(o)} compat=${JSON.stringify(c)}`).toBe(o);
}

describe('G15 compat: format(Fraction) prints the ratio (mathjs 15.3.0 #1579)', () => {
  it('F1 format(fraction(2)) is "2/1"', () => {
    expectParity((l) => l.format(l.fraction(2)));
  });

  it('F1 format(fraction(0)) is "0/1" and format(fraction(-3)) is "-3/1"', () => {
    expectParity((l) => l.format(l.fraction(0)));
    expectParity((l) => l.format(l.fraction(-3)));
  });

  it('F1 format(fraction(4, 2)) is "2/1"', () => {
    expectParity((l) => l.format(l.fraction(4, 2)));
  });

  it('F1 format([fraction(1), fraction(2)]) is "[1/1, 2/1]"', () => {
    expectParity((l) => l.format([l.fraction(1), l.fraction(2)]));
  });

  it('F1 format of a unit built from a Fraction is "5/1 cm"', () => {
    expectParity((l) => l.format(l.unit(l.fraction(5), 'cm')));
  });

  it('F1 numeric(4, "Fraction") formats as "4/1"', () => {
    expectParity((l) => l.format(l.numeric(4, 'Fraction')));
  });

  it('G07 F3 routed here: format(fraction(2)) is "2/1" (nullish/format whole Fraction)', () => {
    expectParity((l) => l.format(l.fraction(2)));
  });

  it('F1 format of a dense matrix of Fractions matches the oracle', () => {
    expectParity((l) => l.format(l.matrix([l.fraction(1), l.fraction(2)])));
  });

  it('F1 format of a 2-D dense matrix of Fractions matches the oracle', () => {
    expectParity((l) =>
      l.format(
        l.matrix([
          [l.fraction(1), l.fraction(0)],
          [l.fraction(2), l.fraction(3)],
        ])
      )
    );
  });

  it('F1 format of a sparse matrix of Fractions matches the oracle', () => {
    expectParity((l) =>
      l.format(
        l.sparse([
          [l.fraction(1), 0],
          [0, l.fraction(2)],
        ] as never)
      )
    );
  });
});

describe('G15 compat: string(Fraction) prints the decimal form (#1579, #1721)', () => {
  it('F2 string(fraction(1, 3)) is "0.(3)"', () => {
    expectParity((l) => l.string(l.fraction(1, 3)));
  });

  it('F2 string(fraction(2, 3)) is "0.(6)"', () => {
    expectParity((l) => l.string(l.fraction(2, 3)));
  });

  it('F2 string() maps a nested array of Fractions (does not stringify the container)', () => {
    expectParity((l) => l.string([[l.fraction(1, 3), l.fraction(1, 2)]]));
  });

  it('F2 string() maps a dense matrix of Fractions', () => {
    expectParity((l) => l.string(l.matrix([l.fraction(1, 3), l.fraction(2)])));
  });
});

describe('G15 compat: ConstantNode.toString under number: "Fraction" (#1586)', () => {
  const cfg = { number: 'Fraction' };

  it('F3 parse("1/3 + 1/4").toString() matches the mathjs ratio form', () => {
    const { o, c } = both((l) => l.parse('1/3 + 1/4').toString(), cfg);
    expect(o).toBe('1/1 / 3/1 + 1/1 / 4/1');
    expect(c, `oracle=${JSON.stringify(o)} compat=${JSON.stringify(c)}`).toBe(o);
  });

  it('F3 parse("2").toString() is "2/1"', () => {
    expectParity((l) => l.parse('2').toString(), cfg);
  });

  it('F3 evaluate("1/3 + 1/4") stays the Fraction 7/12 (value must not change)', () => {
    const value = compat(cfg).evaluate('1/3 + 1/4') as { numerator: bigint; denominator: bigint };
    expect(value.numerator).toBe(7n);
    expect(value.denominator).toBe(12n);
  });
});

describe('G15 compat: print(Fraction) matches the mathjs error', () => {
  it('F4 print(fraction(2)) throws the oracle message', () => {
    expectParity((l) => l.print(l.fraction(2)));
  });

  it('F4 print interpolates a Fraction placeholder as n/1', () => {
    expectParity((l) => l.print('x=$x', { x: l.fraction(2) }));
  });
});

describe('G15 compat: string(Fraction) long period / terminating expansion', () => {
  it('F5 a period longer than the native 1000-digit cap still matches mathjs', () => {
    const { o, c } = both((l) => l.string(l.fraction(1, 1019)));
    expect(c, `oracle length ${o.length}, compat ${JSON.stringify(c)}`).toBe(o);
  });

  it('F5 a terminating expansion longer than 15 decimals matches mathjs', () => {
    expectParity((l) => l.string(l.fraction(1, 2 ** 20)));
  });
});

/**
 * Policy guard (Daniel 2026-11-25, message 3): the native `core` and `expression` output for
 * Fraction formatting must stay exactly what `origin/main` prints. PR #1721 changed both, so
 * this block fails on that head; it passes once those native edits are reverted to `main`.
 *
 * The recorded values are the `origin/main` (`c6d0432b`) output, read from the built `core` and
 * `expression` dist at that commit. Native still renders integral Fractions without the ratio
 * (`"2"`, `"0"`), and a native `ConstantNode` of a Fraction prints `"2"` — the mathjs ratio
 * (`"2/1"`) is a compat-only behavior.
 */
describe('G15 policy: native core/expression Fraction formatting is unchanged from main', () => {
  it('core format() keeps the main output for integral Fractions ("2", "0", "1/3")', async () => {
    const core = await import('@danielsimonjr/mathts-core');
    const internal = await import('@danielsimonjr/mathts-core/internal');
    const Fraction = (core as unknown as { Fraction: new (n: bigint, d: bigint) => unknown })
      .Fraction;
    const formatGeneric = (internal as unknown as { formatGeneric: (v: unknown) => string })
      .formatGeneric;
    expect(formatGeneric(new Fraction(4n, 2n))).toBe('2');
    expect(formatGeneric(new Fraction(0n, 5n))).toBe('0');
    expect(formatGeneric(new Fraction(1n, 3n))).toBe('1/3');
  });

  it('creating a compat instance does not change native format of a Fraction', async () => {
    const functions = await import('@danielsimonjr/mathts-functions');
    const core = await import('@danielsimonjr/mathts-core');
    const Fraction = (core as unknown as { Fraction: new (n: bigint, d: bigint) => unknown })
      .Fraction;
    const before = functions.format(new Fraction(2n, 1n));
    compat();
    const after = functions.format(new Fraction(2n, 1n));
    expect(before).toBe('2');
    expect(after).toBe(before);
  });

  it('expression ConstantNode.toString() keeps the main output ("2", "1/3")', async () => {
    const expr = (await import('@danielsimonjr/mathts-expression')) as unknown as {
      createConstantNode: (
        deps: Record<string, unknown>
      ) => new (v: unknown) => { toString(): string };
      createNode: (deps: Record<string, unknown>) => unknown;
    };
    const core = (await import('@danielsimonjr/mathts-core')) as unknown as {
      Fraction: new (n: bigint, d: bigint) => unknown;
    };
    const ConstantNode = expr.createConstantNode({
      Node: expr.createNode({}),
      isBounded: () => true,
    });
    expect(new ConstantNode(new core.Fraction(2n, 1n)).toString()).toBe('2');
    expect(new ConstantNode(new core.Fraction(1n, 3n)).toString()).toBe('1/3');
  });
});
