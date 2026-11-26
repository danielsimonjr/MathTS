/**
 * CHALLENGER (G06) — adversarial compat probes against PR #1767 (#1554).
 *
 * Oracle: mathjs 15.3.0 (`compat` devDependency). Every case compares the compat
 * instance with the oracle by `typeOf` plus `format(value, { precision: 14 })`,
 * or by thrown error name/message, exactly like the repo's `expectSame` harness.
 *
 * These tests are FALSIFYING: they are expected to FAIL on the builder head of
 * #1767 and to pass once the findings below are addressed. Each `describe`
 * states whether the defect is introduced by this PR or pre-existing on
 * `origin/main`, so the owner can tell a regression from a known native gap.
 *
 * Only `compat/` is under test. A native difference is never "fixed" by editing
 * a critical library to match mathjs; the adapter belongs in compat — and, as
 * noted below, both residual `bernoulli`/`pinv` gaps ARE wrappable in compat.
 */
import { describe, expect, it } from 'vitest';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';
import { pair, show, type HarnessInstance } from './oracle.js';

const BIG = { number: 'BigNumber' } as const;
const FRAC = { number: 'Fraction' } as const;

type Outcome = { value: string } | { error: string; message: string };

/**
 * The single cast choke point for this file (the repo's typed-dispatch
 * convention for tests): the harness instance is an untyped record.
 */
function invoke(L: HarnessInstance, name: string, ...args: unknown[]): unknown {
  const table = L as unknown as Record<string, (...a: unknown[]) => unknown>;
  return table[name]!.apply(L, args);
}

const firstClause = (message: string): string => {
  const i = message.indexOf(':');
  return i === -1 ? message : message.slice(0, i + 1);
};

function outcome(L: HarnessInstance, run: (l: HarnessInstance) => unknown): Outcome {
  try {
    return { value: show(L, run(L)) };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { error: err.name, message: firstClause(err.message) };
  }
}

/** Compare one call on the oracle and on the compat instance built with `config`. */
function expectSameAsOracle(
  label: string,
  config: Record<string, unknown>,
  run: (l: HarnessInstance) => unknown
): void {
  const { mathjs, compat } = pair(config);
  const oracle = outcome(mathjs, run);
  const actual = outcome(compat, run);
  expect(actual, label).toEqual(oracle);
}

// ===========================================================================
// D1 (P0, REGRESSION introduced by #1767) — `bernoulli` of a non-number index
// 0, 1, or any odd index throws `TypeError: Cannot read properties of
// undefined (reading '2')` instead of returning the exact Fraction / BigNumber.
//
// Root cause: `bernoulliCore` in `compat/src/mathjs-parity-g06.ts` is a port of
// mathjs `_bernoulli` that OMITS the three early returns the mathjs original
// has before the recurrence:
//
//     if (index === 0) return promote(1);
//     if (index === 1) return divide(promote(-1), promote(2));
//     if (index % 2 === 1) return promote(0);
//
// So `index = 0` and odd `index` read `cache[half]` when the cache slot was
// never written. On `origin/main` these returned a *number* (wrong type, no
// crash); this PR turns a type divergence into a hard crash, and it is reachable
// through the very `evaluate` path the plan advertises (`bernoulli(3)` under
// `number: 'BigNumber'`). This is the headline G06 gap, not an edge case.
// ===========================================================================
describe('D1 [P0 regression] bernoulli(bigint/Fraction/BigNumber) crashes at index 0, 1, and every odd index', () => {
  it('bernoulli(0n) is Fraction 1/1 (mathjs)', () => {
    expectSameAsOracle('bernoulli(0n)', {}, (L) => invoke(L, 'bernoulli', 0n));
  });

  it('bernoulli(1n) is Fraction -1/2 (mathjs)', () => {
    expectSameAsOracle('bernoulli(1n)', {}, (L) => invoke(L, 'bernoulli', 1n));
  });

  it('bernoulli(3n) is Fraction 0/1 (mathjs)', () => {
    expectSameAsOracle('bernoulli(3n)', {}, (L) => invoke(L, 'bernoulli', 3n));
  });

  it('bernoulli(fraction(0)) is Fraction 1/1 (mathjs)', () => {
    expectSameAsOracle('bernoulli(fraction(0))', {}, (L) =>
      invoke(L, 'bernoulli', invoke(L, 'fraction', 0))
    );
  });

  it('bernoulli(fraction(5)) is Fraction 0/1 (mathjs)', () => {
    expectSameAsOracle('bernoulli(fraction(5))', {}, (L) =>
      invoke(L, 'bernoulli', invoke(L, 'fraction', 5))
    );
  });

  it('bernoulli(bignumber(1)) is BigNumber -0.5 (mathjs)', () => {
    expectSameAsOracle('bernoulli(bignumber(1))', {}, (L) =>
      invoke(L, 'bernoulli', invoke(L, 'bignumber', 1))
    );
  });

  it('bernoulli(bignumber(3)) is BigNumber 0 (mathjs)', () => {
    expectSameAsOracle('bernoulli(bignumber(3))', {}, (L) =>
      invoke(L, 'bernoulli', invoke(L, 'bignumber', 3))
    );
  });

  // The same crash through the advertised `evaluate` entry point.
  it('evaluate("bernoulli(1)") under number:BigNumber is BigNumber -0.5 (mathjs)', () => {
    expectSameAsOracle('evaluate bernoulli(1) [BigNumber]', BIG, (L) => L.evaluate('bernoulli(1)'));
  });

  it('evaluate("bernoulli(3)") under number:BigNumber is BigNumber 0 (mathjs)', () => {
    expectSameAsOracle('evaluate bernoulli(3) [BigNumber]', BIG, (L) => L.evaluate('bernoulli(3)'));
  });

  it('evaluate("bernoulli(0)") under number:Fraction is Fraction 1/1 (mathjs)', () => {
    expectSameAsOracle('evaluate bernoulli(0) [Fraction]', FRAC, (L) => L.evaluate('bernoulli(0)'));
  });

  it('evaluate("bernoulli(5)") under number:Fraction is Fraction 0/1 (mathjs)', () => {
    expectSameAsOracle('evaluate bernoulli(5) [Fraction]', FRAC, (L) => L.evaluate('bernoulli(5)'));
  });
});

// ===========================================================================
// D2 (P2, PRE-EXISTING but in #1554's declared scope) — `compare` of a
// BigNumber against a Fraction (either order) must throw the mathjs
// "Cannot implicitly convert a Fraction to BigNumber or vice versa" TypeError.
// Compat silently coerces and returns a BigNumber. This is not a regression
// (origin/main does the same), but #1767 wraps `compare` specifically to match
// mathjs and still lets this through, so the "compare matches mathjs" claim is
// incomplete. `createCompatCompare` only guards Complex.
// ===========================================================================
describe('D2 [P2 gap] compare(BigNumber, Fraction) must throw the mathjs mixed-type TypeError', () => {
  it('compare(bignumber(2), fraction(1,3)) throws (mathjs)', () => {
    expectSameAsOracle('compare(bignumber(2), fraction(1,3))', {}, (L) =>
      invoke(L, 'compare', invoke(L, 'bignumber', 2), invoke(L, 'fraction', 1, 3))
    );
  });

  it('compare(fraction(1,3), bignumber(2)) throws (mathjs)', () => {
    expectSameAsOracle('compare(fraction(1,3), bignumber(2))', {}, (L) =>
      invoke(L, 'compare', invoke(L, 'fraction', 1, 3), invoke(L, 'bignumber', 2))
    );
  });
});

// ===========================================================================
// D3 (P2, PRE-EXISTING) — `pinv` of a dense 1×2 matrix `[[0, 1]]` must throw
// mathjs's `Cannot calculate inverse, determinant is zero`; compat returns a
// matrix. #1767 documents only the SPARSE form of this gap
// (documented sparse-only gap before the fix), but the DENSE form diverges
// identically and is not documented.
// ===========================================================================
describe('D3 [P2 undocumented gap] dense pinv([[0,1]]) must throw as mathjs does', () => {
  it('pinv([[0,1]]) throws "Cannot calculate inverse, determinant is zero" (mathjs)', () => {
    expectSameAsOracle('pinv([[0,1]])', {}, (L) => invoke(L, 'pinv', [[0, 1]]));
  });
});

// ===========================================================================
// D4 (P2, claimed residual — but WRAPPABLE) — `bernoulli` on the NUMBER path
// diverges from mathjs from index ~192 onward. mathjs's float recurrence
// overflows to ±Infinity (then NaN), while native `functions.bernoulli`
// returns a large finite value. Prior compat docs claimed "Small and moderate
// indexes match", which is false: mathjs returns Infinity at n = 198 while
// compat returns 3.6e212.
//
// The PR calls this an out-of-scope residual ("delegates the number path to
// native functions bernoulli"). It is NOT out of scope: `bernoulliCore` already
// in this file reproduces mathjs's exact float recurrence for any type, so the
// number path can be routed through the same cache and match mathjs (including
// the Infinity/NaN overflow). No critical library needs to change — the fix is
// entirely inside compat.
// ===========================================================================
describe('D4 [P2 avoidable residual] bernoulli number path diverges from mathjs past n=192', () => {
  it('bernoulli(200) matches mathjs (both -Infinity)', () => {
    expectSameAsOracle('bernoulli(200)', {}, (L) => invoke(L, 'bernoulli', 200));
  });

  it('bernoulli(1000) matches mathjs (both NaN)', () => {
    expectSameAsOracle('bernoulli(1000)', {}, (L) => invoke(L, 'bernoulli', 1000));
  });
});

// ===========================================================================
// Regression guards: the rows #1767 fixed must keep matching (these PASS on the
// builder head and must stay green after D1–D4 are fixed).
// ===========================================================================
describe('G06 regression guards (pass on builder head; keep green after fixes)', () => {
  it('pinv(bignumber(2.5)) is BigNumber 0.4', () => {
    expectSameAsOracle('pinv(bignumber(2.5))', {}, (L) =>
      invoke(L, 'pinv', invoke(L, 'bignumber', '2.5'))
    );
  });

  it('pinv(fraction(1,3)) is Fraction 3/1', () => {
    expectSameAsOracle('pinv(fraction(1,3))', {}, (L) =>
      invoke(L, 'pinv', invoke(L, 'fraction', 1, 3))
    );
  });

  it('pinv(complex(1,2)) is Complex 0.2 - 0.4i', () => {
    expectSameAsOracle('pinv(complex(1,2))', {}, (L) =>
      invoke(L, 'pinv', invoke(L, 'complex', 1, 2))
    );
  });

  it('bernoulli(fraction(12)) is Fraction -691/2730 (even index still works)', () => {
    expectSameAsOracle('bernoulli(fraction(12))', {}, (L) =>
      invoke(L, 'bernoulli', invoke(L, 'fraction', 12))
    );
  });

  it('bernoulli(bignumber(12)) is BigNumber (even index still works)', () => {
    expectSameAsOracle('bernoulli(bignumber(12))', {}, (L) =>
      invoke(L, 'bernoulli', invoke(L, 'bignumber', 12))
    );
  });

  it('unaryPlus(true) is BigNumber 1 under number:BigNumber', () => {
    expectSameAsOracle('unaryPlus(true) [BigNumber]', BIG, (L) => invoke(L, 'unaryPlus', true));
  });

  it('evaluate("compare(2, 3)") is BigNumber -1 under number:BigNumber', () => {
    expectSameAsOracle('evaluate compare(2,3) [BigNumber]', BIG, (L) =>
      L.evaluate('compare(2, 3)')
    );
  });

  it('compare(complex, 1) throws the mathjs ordering error', () => {
    expectSameAsOracle('compare(complex,1)', {}, (L) =>
      invoke(L, 'compare', invoke(L, 'complex', 1, 2), 1)
    );
  });

  // Foreign mathjs scalars must flow into the compat surface (the PR's stated
  // intent) and still match the oracle's own result.
  it('compat.pinv(foreign mathjs BigNumber) keeps the BigNumber', () => {
    const oracle = pair({}).mathjs;
    const compat = createCompat(compatAll, {}) as unknown as HarnessInstance;
    const foreign = invoke(oracle, 'bignumber', '2.5');
    const result = invoke(compat, 'pinv', foreign);
    expect(show(compat as never, result)).toBe('BigNumber 0.4');
  });
});
