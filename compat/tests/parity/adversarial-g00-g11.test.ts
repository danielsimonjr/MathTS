import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Adversarial probes for the mathjs 15.3.0 parity PR (G00 #1574 + G11 #1563-#1566), plus the
 * ported upstream refactors (#3806 isZero matAlgo, #3607 matAlgo15xAs, #3710 bigint
 * canonicalization in mod/invmod/xgcd).
 *
 * Every case here compares the `create(all)` compat instance against the pinned 15.3.0 oracle
 * using the plan's own comparison rule: `typeOf` plus `format(value, { precision: 14 })`, or the
 * thrown error name. Each `it` is a real failing test on the PR head `33a7b5a7`; none is skipped.
 */

type L = ReturnType<typeof createCompat> & ReturnType<typeof create>;

const oracle = create(all) as unknown as L;

const compat = () => createCompat(compatAll) as unknown as L;

function show(lib: L, v: unknown): string {
  try {
    return lib.typeOf(v) + ' ' + lib.format(v, { precision: 14 });
  } catch {
    return lib.typeOf(v) + ' ' + String(v);
  }
}

function outcome(lib: L, fn: (l: L) => unknown): { ok: boolean; text: string } {
  try {
    return { ok: true, text: show(lib, fn(lib)) };
  } catch (e) {
    return { ok: false, text: (e as Error).name };
  }
}

describe('G11 mixed-type bigint: mod keeps the bigint result type (mathjs 15.3.0 #3710)', () => {
  // mathjs 15.3.0 gives `mod(7n, 3)` the bigint `1n` (the mixed `number, bigint` and
  // `bigint, number` signatures are documented in its `mod` History: "v15.3 Prefer bigint
  // output if possible for mixed number/bigint input"). The ported factory `functions`
  // `createMod` carries those two signatures, but the compat instance binds the typed surface
  // `mathTyped('mod', …)` instead, whose only bigint signature is `bigint, bigint`; a
  // `(bigint, number)` call therefore converts the number to bigint (`BigInt(3)`) and the
  // result is the bigint, or converts the bigint to number and returns a `number`.
  const CASES: [string, (l: L) => unknown][] = [
    ['mod(7n, 3)', (l) => l.mod(7n, 3)],
    ['mod(7, 3n)', (l) => l.mod(7, 3n)],
    ['mod(-7n, 3)', (l) => l.mod(-7n, 3)],
    ['mod(7n, -3)', (l) => l.mod(7n, -3)],
    ['mod(0n, 3)', (l) => l.mod(0n, 3)],
  ];

  for (const [label, run] of CASES) {
    it(`${label} matches mathjs (bigint result)`, () => {
      expect(outcome(compat(), run)).toEqual(outcome(oracle, run));
    });
  }

  it('mod(2n ** 60n, 3) does not throw: the bigint path must not convert to number', () => {
    // The PR's own #1566 guard makes `bigintToNumber` throw above 2^53. The mixed path still
    // routes through it, so a large bigint dividend throws where mathjs 15.3.0 returns `1n`.
    expect(() => compat().mod(2n ** 60n, 3)).not.toThrow();
    expect(compat().mod(2n ** 60n, 3)).toBe(1n);
  });

  it('mod(9007199254740993n, 2) is 1n, not a thrown conversion error', () => {
    expect(compat().mod(9007199254740993n, 2)).toBe(1n);
  });
});

describe('G11 bigint port: xgcd/invmod keep bigint element types (mathjs 15.3.0 #3607)', () => {
  it('xgcd(3n, 11) returns bigint elements, as the oracle does', () => {
    const got = (compat().xgcd(3n, 11) as { valueOf(): unknown[] }).valueOf();
    const want = (oracle.xgcd(3n, 11) as { valueOf(): unknown[] }).valueOf();
    expect(got.map((x) => typeof x)).toEqual(want.map((x) => typeof x));
    expect(got.map(String)).toEqual(want.map(String));
  });

  it('invmod(3n, 11) is the bigint 4n, not a BigNumber', () => {
    expect(compat().invmod(3n, 11)).toBe(4n);
  });

  it('invmod(-3n, 11) is the bigint 7n', () => {
    expect(compat().invmod(-3n, 11)).toBe(7n);
  });

  it('invmod(3n, -11) is the bigint -7n (the #3710 canonical range on the bigint path)', () => {
    expect(compat().invmod(3n, -11)).toBe(-7n);
  });
});

describe('G11 stirlingS2 bigint support (mathjs 15.3.0 added it)', () => {
  // mathjs 15.3.0 `stirlingS2` reads `?bigint` and returns a bigint when either argument is a
  // bigint ("History: v15.3 added bigint support"). The PR added `'?bigint'` and `'typeOf'` to
  // the dependency list of `functions/src/combinatorics/stirlingS2.ts` but not a bigint branch
  // to the body, so a bigint argument is converted and a BigNumber comes back.
  it('stirlingS2(4n, 2n) is the bigint 7n', () => {
    expect(compat().stirlingS2(4n, 2n)).toBe(7n);
  });

  it('stirlingS2(18n, 3n) is the bigint 64439010n', () => {
    expect(compat().stirlingS2(18n, 3n)).toBe(64439010n);
  });

  it('stirlingS2(4n, 2) is a bigint (either argument bigint makes the result bigint)', () => {
    expect(typeof compat().stirlingS2(4n, 2)).toBe('bigint');
  });
});

describe('G11 sparse element-wise ops: result sparsity matches mathjs 15.3.0 (#1565)', () => {
  // #1565's rule is "evaluate the implicit zeros; return a DenseMatrix only when the image of 0
  // is not 0". `subtract(sparse, 0)` has image-of-zero 0 - 0 = 0, so mathjs keeps it SPARSE.
  // The refactored matAlgo12xSfs in this PR takes the dense branch here.
  it('subtract(sparse, 0) stays a SparseMatrix', () => {
    const s = compat().sparse([
      [0, 1],
      [2, 0],
    ]);
    const r = compat().subtract(s, 0) as { isSparseMatrix?: boolean; type: string };
    const o = oracle.subtract(
      oracle.sparse([
        [0, 1],
        [2, 0],
      ]),
      0
    ) as { isSparseMatrix?: boolean; type: string };
    expect(o.isSparseMatrix).toBe(true);
    expect(r.type).toBe(oracle.typeOf(o));
    // The values must also match, so a shim that only changed the type would still fail.
    expect(show(compat(), r)).toBe(show(oracle, o));
  });

  it('subtract(sparse, false) stays a SparseMatrix', () => {
    const s = compat().sparse([
      [0, 1],
      [2, 0],
    ]);
    const r = compat().subtract(s, false) as { type: string };
    const o = oracle.subtract(
      oracle.sparse([
        [0, 1],
        [2, 0],
      ]),
      false
    ) as { type: string };
    expect(r.type).toBe(oracle.typeOf(o));
  });
});

describe('#1566 bigint conversion guard coverage: every typed function shares one conversion', () => {
  // The plan's "Done" list for G11 says `bigintToNumber` is the only conversion implementation
  // (grep `Number(n as bigint)` / `Number(bigint`). Two typed paths still convert a bigint
  // through a different route and so return where mathjs throws, or throw where mathjs returns.
  it('sqrt(2n ** 60n) throws the mathjs conversion error instead of returning a number', () => {
    // `sqrt(2n**60n)` in mathjs 15.3.0 reaches `bigintToNumber` and throws; the typed `sqrt`
    // has no bigint signature and converts through `Number`, so it returns 1073741824.
    const oracleOutcome = outcome(oracle, (l) => (l.sqrt as (x: bigint) => unknown)(2n ** 60n));
    const compatOutcome = outcome(compat(), (l) => (l.sqrt as (x: bigint) => unknown)(2n ** 60n));
    expect(compatOutcome).toEqual(oracleOutcome);
  });

  it('larger(2n ** 60n, 0) throws the mathjs conversion error instead of returning a boolean', () => {
    const oracleOutcome = outcome(oracle, (l) =>
      (l.larger as (a: bigint, b: number) => unknown)(2n ** 60n, 0)
    );
    const compatOutcome = outcome(compat(), (l) =>
      (l.larger as (a: bigint, b: number) => unknown)(2n ** 60n, 0)
    );
    expect(compatOutcome).toEqual(oracleOutcome);
  });
});

describe('G11 multinomial overflow: the result is NaN, as mathjs 15.3.0 (a pinned test asserts Infinity)', () => {
  // The updated `functions/tests/multinomial-large.test.ts` still pins `Infinity` for
  // `[515, 515]` and `[1e7, 1e7]`. mathjs 15.3.0's product of binomial coefficients overflows to
  // NaN (`combinations(2n, n)` is NaN once the true value exceeds the double range, and a
  // later multiply is `Infinity * 0`). The plan's own rule compares the precision-14 format, and
  // `NaN` and `Infinity` differ there.
  for (const args of [
    [515, 515],
    [1000, 1000],
    [1e7, 1e7],
  ]) {
    it(`multinomial([${args.join(', ')}]) matches the oracle`, () => {
      expect(outcome(compat(), (l) => l.multinomial(args))).toEqual(
        outcome(oracle, (l) => l.multinomial(args))
      );
    });
  }
});

describe('sparse element-wise ops drop sub-absTol results, as mathjs 15.3.0 does', () => {
  // mathjs's SparseMatrix `isZero` is `typed.find(isZero, [datatype])`, and `isZero` is
  // `equalScalar(x, 0)` — the `absTol`-tolerant test. A result below `absTol` (default 1e-15)
  // is therefore not stored. The PR's new `MathJSSparseMatrix.isZero` / `isZero_Full` in
  // `functions/src/factories/matrix-bridge.ts` call `isZeroScalar`, an EXACT `=== 0` test
  // (`isExactZero`), so a sub-`absTol` entry is stored where mathjs drops it. This regressed
  // from the base branch, where the sparse helpers used `equalScalar(v, 0)`.
  const sparseOne = (l: L) => l.sparse([[1, 0]]);

  it('dotMultiply(sparse, 1e-300) stores no entry (the product is below absTol)', () => {
    const got = compat().dotMultiply(sparseOne(compat()), 1e-300) as {
      _values?: unknown[];
    };
    const want = oracle.dotMultiply(sparseOne(oracle), 1e-300) as { _values?: unknown[] };
    expect(want._values?.length).toBe(0);
    expect(got._values?.length).toBe(0);
  });

  it('dotDivide(sparse, 1e300) stores no entry', () => {
    const rows = [[2, 1]];
    const got = compat().dotDivide(compat().sparse(rows), 1e300) as { _values?: unknown[] };
    const want = oracle.dotDivide(oracle.sparse(rows), 1e300) as { _values?: unknown[] };
    expect(want._values?.length).toBe(0);
    expect(got._values?.length).toBe(0);
  });

  it('dotMultiply(sparse BigNumber 1e-300, 1) stores no entry', () => {
    const mk = (l: L) => l.sparse([[l.bignumber('1e-300'), 0]] as unknown as number[][]);
    const got = compat().dotMultiply(mk(compat()), 1) as { _values?: unknown[] };
    const want = oracle.dotMultiply(mk(oracle), 1) as { _values?: unknown[] };
    expect(want._values?.length).toBe(0);
    expect(got._values?.length).toBe(0);
  });
});
