/**
 * CHALLENGER (G02) — adversarial compat probes against PR #1759.
 *
 * Oracle: mathjs 15.3.0 (`compat` devDependency). Every case compares the compat
 * instance with the oracle by `typeOf` plus `format(value, { precision: 14 })`,
 * or by thrown error name and message prefix, exactly like the repo's
 * `expectSame` harness. These tests are FALSIFYING: they are expected to FAIL on
 * the builder head and to pass once the findings in
 * `docs/challenger/g02-findings.md` are addressed.
 *
 * Only `compat/` is under test here. A native difference is never "fixed" by
 * changing a critical library to match mathjs; the adapter belongs in compat.
 */
import { describe, expect, it } from 'vitest';
import { pair, show } from './oracle.js';

type Lib = Record<string, unknown>;

type Outcome = { value: string } | { error: string; message: string };

const firstClause = (message: string): string => {
  const i = message.indexOf(':');
  return i === -1 ? message : message.slice(0, i + 1);
};

function outcome(L: Lib, run: (l: Lib) => unknown): Outcome {
  try {
    const v = run(L);
    return { value: show(L as never, v) };
  } catch (e) {
    const err = e as Error;
    return { error: err.name, message: firstClause(err.message) };
  }
}

/** Compare one call on the oracle and on the compat instance built with `config`. */
function expectSameAsOracle(
  label: string,
  config: Record<string, unknown>,
  run: (l: Lib) => unknown
): void {
  const { mathjs, compat } = pair(config);
  const oracle = outcome(mathjs as unknown as Lib, run);
  const actual = outcome(compat as unknown as Lib, run);
  expect(actual, label).toEqual(oracle);
}

// ---------------------------------------------------------------------------
// C1 — `mad` regressions the PR introduces where #1583 was already correct.
// ---------------------------------------------------------------------------

describe('C1: mad keeps the mathjs error contracts #1583 already had', () => {
  it('mad() with no argument throws the mathjs arity TypeError', () => {
    // base: TypeError: Too few arguments in function mad (expected: any, index: 0)
    // head: Error: Cannot calculate median absolute deviation (mad) of an empty array
    expectSameAsOracle('mad()', {}, (L) => (L.mad as () => unknown)());
  });

  it('mad of Complex values throws the mathjs "no ordering relation" TypeError', () => {
    expectSameAsOracle('mad(complex, complex)', {}, (L) =>
      (L.mad as (...a: unknown[]) => unknown)(
        (L.complex as (r: number, i: number) => unknown)(1, 2),
        (L.complex as (r: number, i: number) => unknown)(3, 4)
      )
    );
  });

  it('mad of a Complex list throws the mathjs "no ordering relation" TypeError', () => {
    expectSameAsOracle('mad([complex, complex])', {}, (L) =>
      (L.mad as (...a: unknown[]) => unknown)([
        (L.complex as (r: number, i: number) => unknown)(1, 2),
        (L.complex as (r: number, i: number) => unknown)(3, 4),
      ])
    );
  });
});

// ---------------------------------------------------------------------------
// C2 — arity guards that fire the wrong typed-function message.
// ---------------------------------------------------------------------------

describe('C2: arity guards report "too few" where mathjs does', () => {
  it('size() throws the mathjs too-few TypeError, not too-many', () => {
    expectSameAsOracle('size()', {}, (L) => (L.size as () => unknown)());
  });

  it('inv() throws the mathjs too-few TypeError, not too-many', () => {
    expectSameAsOracle('inv()', {}, (L) => (L.inv as () => unknown)());
  });

  it('det() throws the mathjs too-few TypeError, not too-many', () => {
    expectSameAsOracle('det()', {}, (L) => (L.det as () => unknown)());
  });

  it('transpose() throws the mathjs too-few TypeError, not too-many', () => {
    expectSameAsOracle('transpose()', {}, (L) => (L.transpose as () => unknown)());
  });

  it('subtract(10, 2, 3) throws the mathjs too-many TypeError (only add/multiply fold)', () => {
    // mathjs: Too many arguments in function subtract (expected: 2, actual: 3)
    // head: 5  — the compat fold keeps extending subtract, a mathjs divergence.
    expectSameAsOracle('subtract(10, 2, 3)', {}, (L) =>
      (L.subtract as (...a: unknown[]) => unknown)(10, 2, 3)
    );
  });
});

// ---------------------------------------------------------------------------
// C3 — #1550 statistics edges the rebind exposes and does not record.
// ---------------------------------------------------------------------------

describe('C3: variance/std keep the mathjs empty and collection contracts', () => {
  it('variance([]) throws the mathjs SyntaxError', () => {
    expectSameAsOracle('variance([])', {}, (L) => (L.variance as (a: unknown) => unknown)([]));
  });

  it('std([]) throws the mathjs SyntaxError', () => {
    expectSameAsOracle('std([])', {}, (L) => (L.std as (a: unknown) => unknown)([]));
  });

  it('variance(matrix, 0) returns a Matrix, not a bare Array', () => {
    expectSameAsOracle('variance(matrix, 0)', {}, (L) =>
      (L.variance as (...a: unknown[]) => unknown)(
        (L.matrix as (a: unknown) => unknown)([
          [1, 2],
          [3, 4],
        ]),
        0
      )
    );
  });

  it('variance(matrix, 1) returns a Matrix, not a bare Array', () => {
    // `std` re-boxes its sliced result; `variance` does not, so the same call on the
    // sibling function returns a plain Array where mathjs returns a DenseMatrix.
    expectSameAsOracle('variance(matrix, 1)', {}, (L) =>
      (L.variance as (...a: unknown[]) => unknown)(
        (L.matrix as (a: unknown) => unknown)([
          [1, 2],
          [3, 4],
        ]),
        1
      )
    );
  });
});

// ---------------------------------------------------------------------------
// C4 — the #1587 Fraction-conversion guard misses `sqrt`, `cbrt`, `expm1`,
// `gamma` and the instance-level `erf`.
// ---------------------------------------------------------------------------

describe('C4: every mathjs Fraction-rejecting scalar path rejects a Fraction', () => {
  it('sqrt(fraction(1,3)) throws the mathjs conversion TypeError', () => {
    expectSameAsOracle('sqrt(fraction)', {}, (L) =>
      (L.sqrt as (x: unknown) => unknown)((L.fraction as (n: number, d: number) => unknown)(1, 3))
    );
  });

  it('cbrt(fraction(1,3)) throws the mathjs conversion TypeError', () => {
    expectSameAsOracle('cbrt(fraction)', {}, (L) =>
      (L.cbrt as (x: unknown) => unknown)((L.fraction as (n: number, d: number) => unknown)(1, 3))
    );
  });

  it('expm1(fraction(1,3)) throws the mathjs conversion TypeError', () => {
    expectSameAsOracle('expm1(fraction)', {}, (L) =>
      (L.expm1 as (x: unknown) => unknown)((L.fraction as (n: number, d: number) => unknown)(1, 3))
    );
  });

  it('gamma(fraction(1,3)) throws the mathjs conversion TypeError', () => {
    expectSameAsOracle('gamma(fraction)', {}, (L) =>
      (L.gamma as (x: unknown) => unknown)((L.fraction as (n: number, d: number) => unknown)(1, 3))
    );
  });

  it('erf(fraction(1,3)) throws the mathjs conversion TypeError', () => {
    expectSameAsOracle('erf(fraction)', {}, (L) =>
      (L.erf as (x: unknown) => unknown)((L.fraction as (n: number, d: number) => unknown)(1, 3))
    );
  });
});

describe('C5: erf rejects a BigNumber at the instance level too (#1587)', () => {
  it('erf(bignumber(2)) throws the mathjs "Unexpected type" TypeError', () => {
    // The PR guards only the expression scope: `evaluate("erf(0.2)")` under the
    // BigNumber config matches, yet the direct instance call still computes.
    expectSameAsOracle('erf(bignumber)', {}, (L) =>
      (L.erf as (x: unknown) => unknown)((L.bignumber as (x: unknown) => unknown)(2))
    );
  });

  it('erf(bignumber(0.5)) throws under the BigNumber config as well', () => {
    expectSameAsOracle('erf(0.5) BigNumber', { number: 'BigNumber' }, (L) =>
      (L.erf as (x: unknown) => unknown)((L.bignumber as (x: unknown) => unknown)(0.5))
    );
  });

  it('gamma(bignumber(0.5)) throws mathjs "Integer BigNumber expected"', () => {
    expectSameAsOracle('gamma(bignumber 0.5)', {}, (L) =>
      (L.gamma as (x: unknown) => unknown)((L.bignumber as (x: unknown) => unknown)(0.5))
    );
  });
});

// ---------------------------------------------------------------------------
// C6 — `arg` of a BigNumber ignores the instance precision.
// ---------------------------------------------------------------------------

describe('C6: arg(bignumber) respects the instance precision', () => {
  it('arg(bignumber(-2)) has the oracle digits at precision 8', () => {
    // oracle: 3.1415927 (8 significant digits); compat: the full 100-digit constant.
    expectSameAsOracle('arg(-2) precision 8', { precision: 8 }, (L) =>
      (L.arg as (x: unknown) => unknown)((L.bignumber as (x: unknown) => unknown)('-2'))
    );
  });

  it('arg(bignumber(-2)) has the oracle digits at the default precision', () => {
    expectSameAsOracle('arg(-2) default', {}, (L) =>
      (L.arg as (x: unknown) => unknown)((L.bignumber as (x: unknown) => unknown)('-2'))
    );
  });
});

// ---------------------------------------------------------------------------
// C7 — min/max of Complex report the mathjs ordering error, and min/max of a
// bigint keep the bigint.
// ---------------------------------------------------------------------------

describe('C7: min/max ordering and bigint contracts', () => {
  it('min(complex, complex) throws the mathjs ordering TypeError', () => {
    expectSameAsOracle('min(complex, complex)', {}, (L) =>
      (L.min as (...a: unknown[]) => unknown)(
        (L.complex as (r: number, i: number) => unknown)(1, 2),
        (L.complex as (r: number, i: number) => unknown)(3, 0)
      )
    );
  });

  it('max(complex, complex) throws the mathjs ordering TypeError', () => {
    expectSameAsOracle('max(complex, complex)', {}, (L) =>
      (L.max as (...a: unknown[]) => unknown)(
        (L.complex as (r: number, i: number) => unknown)(1, 2),
        (L.complex as (r: number, i: number) => unknown)(3, 0)
      )
    );
  });

  it('min(bigint) is the bigint, not a Fraction', () => {
    expectSameAsOracle('min(2n)', {}, (L) => (L.min as (x: unknown) => unknown)(2n));
  });

  it('max(bigint) is the bigint, not a Fraction', () => {
    expectSameAsOracle('max(2n)', {}, (L) => (L.max as (x: unknown) => unknown)(2n));
  });
});

// ---------------------------------------------------------------------------
// C8 — `count(true, true)` message and `identity(2, 3, 4)` message.
// ---------------------------------------------------------------------------

describe('C8: guard messages match the oracle', () => {
  it('count(true, true) reports the mathjs too-many TypeError', () => {
    expectSameAsOracle('count(true, true)', {}, (L) =>
      (L.count as (...a: unknown[]) => unknown)(true, true)
    );
  });

  it('identity(2, 3, 4) reports the mathjs message (string or boolean, index 2)', () => {
    expectSameAsOracle('identity(2,3,4)', {}, (L) =>
      (L.identity as (...a: unknown[]) => unknown)(2, 3, 4)
    );
  });
});

// ---------------------------------------------------------------------------
// C9 — the error names the PR adds are not the mathjs ones.
// ---------------------------------------------------------------------------

describe('C9: sum/mad of a non-numeric string throw the mathjs SyntaxError', () => {
  it('sum("abc") throws SyntaxError like the oracle', () => {
    expectSameAsOracle('sum("abc")', {}, (L) => (L.sum as (x: unknown) => unknown)('abc'));
  });

  it('mad("abc") throws SyntaxError like the oracle', () => {
    expectSameAsOracle('mad("abc")', {}, (L) => (L.mad as (x: unknown) => unknown)('abc'));
  });
});
