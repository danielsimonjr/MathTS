import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { expectSame } from './differential.js';

/**
 * G05 — `schur` diagonal ordering / subdiagonal residue and `solveODE` initial
 * step selection (#1584).
 *
 * The compat `schur` runs the mathjs 15.3.0 unshifted QR iteration, so the
 * diagonal of T comes out in the oracle's order (largest eigenvalue first for
 * the 2x2 test matrix) and the subdiagonal keeps the residue the oracle leaves
 * (`5.147e-118`) instead of being flushed to an exact `0`. The compat
 * `solveODE` ports the mathjs adaptive Runge-Kutta factory, whose initial step
 * is `(tEnd - tStart) / 1`; the step sequence and the final value follow.
 *
 * The native `matrixSchur` (Francis double shift) and the native `solveODE`
 * step control stay unchanged in `matrix` / `functions` — this is a compat
 * adapter, not a native behavior change.
 */

type CompatInstance = ReturnType<typeof createCompat>;

const compat = createCompat(compatAll, {});

describe('G05 schur ordering and subdiagonal (#1584)', () => {
  it('schur([[1,2],[3,4]]).T matches the oracle exactly, residue included', () => {
    expectSame(
      'G05 schur T of [[1,2],[3,4]]',
      {},
      (L) =>
        (
          (L as unknown as CompatInstance).schur([
            [1, 2],
            [3, 4],
          ]) as { T: unknown }
        ).T
    );
  });

  it('the subdiagonal residue is not flushed to an exact zero', () => {
    const T = (
      compat.schur([
        [1, 2],
        [3, 4],
      ]) as { T: number[][] }
    ).T;
    expect(T[1][0]).not.toBe(0);
    expect(T[1][0]).toBeCloseTo(5.1470165474828e-118, 30);
    expect(T[0][0]).toBeCloseTo(5.37228132326901, 12);
    expect(T[1][1]).toBeCloseTo(-0.37228132326901, 12);
  });

  it('the schur docs example matrix matches the oracle', () => {
    expectSame(
      'G05 schur T of the docs example',
      {},
      (L) =>
        (
          (L as unknown as CompatInstance).schur([
            [1, 0],
            [-4, 3],
          ]) as { T: unknown }
        ).T
    );
  });

  it('U · T · Uᵀ reconstructs A (invariant kept from the native tests)', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const { U, T } = compat.schur(A) as { U: number[][]; T: number[][] };
    const product = compat.multiply(compat.multiply(U, T) as number[], compat.transpose(U));
    const rows = (product as number[][]).valueOf?.() ?? product;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        expect((rows as number[][])[i][j]).toBeCloseTo(A[i][j], 8);
      }
    }
  });

  it('a BigNumber schur keeps the Schur invariants (documented digit difference)', () => {
    // mathjs 15.3.0 computes the BigNumber schur with decimal.js at precision
    // 64; compat runs the same QR iteration on the MathTS decimal, whose
    // last-place rounding differs. The iteration is chaotic at the ulp level,
    // so T can stop at a different iterate: the diagonal order and the
    // subdiagonal residue are NOT asserted digit-for-digit here (documented in
    // docs/api/compat.md). The decomposition invariants still hold.
    const L = createCompat(compatAll, { number: 'BigNumber' });
    const bn = L.bignumber;
    const result = L.schur([
      [bn(1), bn(2)],
      [bn(3), bn(4)],
    ]) as {
      U: unknown[][];
      T: unknown[][];
    };
    const U = result.U;
    const T = result.T;
    const product = mathFunctions.multiply(
      mathFunctions.multiply(U, T) as unknown,
      mathFunctions.transpose(U) as unknown
    ) as unknown[][];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        expect(Number(product[i][j] as number)).toBeCloseTo(A_AT[i][j], 6);
      }
    }
  });
});

const A_AT = [
  [1, 2],
  [3, 4],
];

describe('G05 solveODE step selection (#1584)', () => {
  it('solveODE((t,y)=>y, [0,1], 1) matches the oracle t and final y', () => {
    expectSame('G05 solveODE result', {}, (L) =>
      (L as unknown as CompatInstance).solveODE((_t: unknown, y: unknown) => y, [0, 1], 1)
    );
  });

  it('the step grid is the mathjs one: 3 samples, first step 0.6029029729200805', () => {
    const sol = compat.solveODE((_t: unknown, y: unknown) => y, [0, 1], 1) as {
      t: number[];
      y: number[];
    };
    expect(sol.t.length).toBe(3);
    expect(sol.t[0]).toBe(0);
    expect(sol.t[1]).toBeCloseTo(0.6029029729200805, 13);
    expect(sol.t[2]).toBe(1);
    expect(sol.y[sol.y.length - 1]).toBeCloseTo(2.7182938335114, 12);
  });

  it('the RK23 docs example matches the oracle', () => {
    expectSame('G05 solveODE RK23 with maxStep', {}, (L) =>
      (L as unknown as CompatInstance).solveODE((_t: unknown, y: unknown) => y, [0, 4], 1, {
        method: 'RK23',
        maxStep: 0.1,
      })
    );
  });

  it('the error stays within the default tolerance on the issue problem', () => {
    const sol = compat.solveODE((_t: unknown, y: unknown) => y, [0, 1], 1) as {
      y: number[];
    };
    const final = sol.y[sol.y.length - 1];
    expect(Math.abs(final - Math.E)).toBeLessThan(1e-4);
  });
});
