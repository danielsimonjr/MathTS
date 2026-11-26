/**
 * CHALLENGER (G05) — adversarial compat probes against PR #1762
 * (branch `cursor/g05-bignumber-matrix-parity-c329`, builder head
 * `b7d3726e32c975196bf0ae075076580a295863da`).
 *
 * Oracle: the live mathjs 15.3.0 devDependency, exactly as the repo's parity
 * harness uses it (`typeOf` + `format(value, { precision: 14 })`, or the thrown
 * error name and first message clause).
 *
 * These tests are FALSIFYING. Every `it` below FAILS on the builder head and
 * passes once the matching finding in `docs/challenger/g05-findings.md` is
 * addressed. Only `compat/` is under test: the fix belongs in the G05 adapter,
 * never in a critical library.
 *
 * Findings covered here:
 *   F1 — BigNumber `schur` stops at the wrong iterate. The QR iterates are
 *        bit-identical to mathjs, but the L2 stopping norm is computed with the
 *        compat `norm`, whose BigNumber `eigs` orders eigenvalues numerically
 *        (true 2-norm), while mathjs's BigNumber `eigs` sorts *lexicographically*
 *        (`'16' < '9'`), so mathjs's `_matrixNormTwo` reads the smaller
 *        eigenvalue and stops one iterate early (T[0][0] = 5.37228131…, error
 *        1.2e-8). The commit calls this a "decimal-backend digit difference";
 *        it is a stopping-rule difference of 1.2e-8, not a last-digit one.
 *   F2 — `schur` of a native `DenseMatrix` (`@danielsimonjr/mathts-matrix`)
 *        takes the *native* Francis-QR path (`needsNativePath`), so the
 *        diagonal order and subdiagonal differ from mathjs.
 *   F3 — BigNumber `sylvester` / `lyap` for 3x3+ inputs inherit F1 and differ
 *        from the oracle in the precision-14 comparison the harness uses.
 *   F4 — `schur` of a Complex matrix keeps a `-1.0000000000000002i` residue on
 *        the diagonal where mathjs returns an exact `-1i`.
 */
import { describe, expect, it } from 'vitest';
import { pair, show, type HarnessInstance } from './oracle.js';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

type Outcome = { value: string } | { error: string; message: string };

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

/** `schur` returns `{U, T}`; render each half with the parity rule. */
function schurOutcome(
  L: HarnessInstance,
  run: (l: HarnessInstance) => { U: unknown; T: unknown }
): Outcome {
  try {
    const { U, T } = run(L);
    return { value: `{U:${show(L, U)},T:${show(L, T)}}` };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { error: err.name, message: firstClause(err.message) };
  }
}

/** The instance surface these probes touch, typed for the harness. */
interface G05Instance {
  schur(m: unknown): { U: unknown; T: unknown };
  sylvester(a: unknown, b: unknown, c: unknown): unknown;
  lyap(a: unknown, q: unknown): unknown;
  bignumber(v: number): unknown;
  complex(re: number, im: number): unknown;
  format(v: unknown, o: { precision: number }): string;
}

const g05 = (l: HarnessInstance): G05Instance => l as unknown as G05Instance;

const bnMatrix = (l: HarnessInstance, M: number[][]): unknown[][] =>
  M.map((row) => row.map((x) => g05(l).bignumber(x)));

const BN = { number: 'BigNumber' } as const;

// ---------------------------------------------------------------------------
// F1 — BigNumber `schur` stops at a different iterate than the oracle.
// ---------------------------------------------------------------------------
describe('F1: BigNumber schur matches the oracle at precision 14', () => {
  it('schur([[1,2],[3,4]]) matches the mathjs 15.3.0 oracle', () => {
    const { mathjs, compat } = pair(BN);
    const run = (l: HarnessInstance): { U: unknown; T: unknown } =>
      g05(l).schur(
        bnMatrix(l, [
          [1, 2],
          [3, 4],
        ])
      );
    expect(schurOutcome(compat, run)).toEqual(schurOutcome(mathjs, run));
  });

  it('evaluate("schur([[1,2],[3,4]])") matches the mathjs 15.3.0 oracle', () => {
    const { mathjs, compat } = pair(BN);
    const render = (l: HarnessInstance): Outcome => {
      try {
        const r = l.evaluate('schur([[1,2],[3,4]])') as { U: unknown; T: unknown };
        return { value: `{U:${show(l, r.U)},T:${show(l, r.T)}}` };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        return { error: err.name, message: firstClause(err.message) };
      }
    };
    expect(render(compat)).toEqual(render(mathjs));
  });

  it('a symmetric BigNumber schur matches the oracle (the residue is not a last-digit one)', () => {
    const { mathjs, compat } = pair(BN);
    const run = (l: HarnessInstance): { U: unknown; T: unknown } =>
      g05(l).schur(
        bnMatrix(l, [
          [4, 1, 2],
          [1, 5, 3],
          [2, 3, 6],
        ])
      );
    expect(schurOutcome(compat, run)).toEqual(schurOutcome(mathjs, run));
  });
});

// ---------------------------------------------------------------------------
// F2 — `schur` of a native DenseMatrix takes the native Francis-QR path.
// ---------------------------------------------------------------------------
describe('F2: schur of a native DenseMatrix matches the oracle', () => {
  it('compat schur(native DenseMatrix) equals mathjs schur(array)', () => {
    const { mathjs, compat } = pair({});
    const A = [
      [1, 2],
      [3, 4],
    ];
    const oracle = schurOutcome(mathjs, (l) => g05(l).schur(A));
    const native = new DenseMatrix(A);
    const actual = schurOutcome(compat, (l) => g05(l).schur(native));
    expect(actual).toEqual(oracle);
  });
});

// ---------------------------------------------------------------------------
// F3 — BigNumber sylvester / lyap for 3x3+ inherit the F1 iterate.
// ---------------------------------------------------------------------------
describe('F3: BigNumber sylvester/lyap 3x3+ match the oracle at precision 14', () => {
  it('lyap of a 3x3 BigNumber system matches the oracle', () => {
    const { mathjs, compat } = pair(BN);
    const A = [
      [-1, 2, 0],
      [0, -3, 1],
      [0, 0, -5],
    ];
    const Q = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const run = (l: HarnessInstance): unknown => g05(l).lyap(bnMatrix(l, A), bnMatrix(l, Q));
    expect(outcome(compat, run)).toEqual(outcome(mathjs, run));
  });

  it('sylvester of a 4x4 BigNumber system matches the oracle', () => {
    const { mathjs, compat } = pair(BN);
    const A = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 13],
      [14, 15, 16, 17],
    ];
    const B = [
      [-2, 0, 1, 0],
      [0, -3, 0, 1],
      [1, 0, -4, 0],
      [0, 1, 0, -5],
    ];
    const C = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    const run = (l: HarnessInstance): unknown =>
      g05(l).sylvester(bnMatrix(l, A), bnMatrix(l, B), bnMatrix(l, C));
    expect(outcome(compat, run)).toEqual(outcome(mathjs, run));
  });
});

// ---------------------------------------------------------------------------
// F4 — Complex `schur` keeps a residue on the diagonal.
// ---------------------------------------------------------------------------
describe('F4: Complex schur matches the oracle at precision 14', () => {
  it('schur of a Complex 2x2 matrix has no -1.0000000000000002i diagonal residue', () => {
    const { mathjs, compat } = pair({});
    const run = (l: HarnessInstance): { U: unknown; T: unknown } => {
      const c = g05(l).complex;
      return g05(l).schur([
        [c(1, 1), c(2, 0)],
        [c(0, 0), c(3, -1)],
      ]);
    };
    expect(schurOutcome(compat, run)).toEqual(schurOutcome(mathjs, run));
  });
});
