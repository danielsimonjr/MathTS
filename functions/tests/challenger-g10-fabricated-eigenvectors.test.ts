/**
 * G10 CHALLENGER — fabricated eigenvectors (defective blocks).
 *
 * The builder's block-triangular assembly (`solveIndependentBlocks` in
 * `functions/src/matrix/eigs.ts`) returns a "direction" for a defective block that is not an
 * eigenvector at all: for `[[1,1],[0,1]]` it emits `[0, 0, 1]` (i.e. e3), whose residual
 * `||A v - 1 v||` is 1.0 — a 100% error. `mathjs 15.3.0` returns 2 vectors here (the defect
 * is reported by omitting a direction) and `main` returned 2. The builder returns 3, and
 * `dogfood-1242` was edited to accept it (`residual < 1.5`).
 *
 * This is a CORRECTNESS bug (a): an eigenvector must satisfy A v = lambda v to rounding.
 * Neither mathjs nor main does this, so it is not a parity requirement either.
 */
import { describe, it, expect } from 'vitest';
import { eigs } from '@danielsimonjr/mathts-functions';
import { bignumber } from '@danielsimonjr/mathts-core';

type Val = number | { re: number; im: number };
const toArr = (x: unknown): unknown[] =>
  x && typeof (x as { toArray?: () => unknown[] }).toArray === 'function'
    ? (x as { toArray(): unknown[] }).toArray()
    : (x as unknown[]);
const re = (x: Val): number => (typeof x === 'number' ? x : x.re);

describe('native eigs: every returned eigenvector is an eigenvector (defective blocks)', () => {
  it('[[1e20,0,0],[0,1,1],[0,0,1]] (BigNumber) — no fabricated direction with residual 1', () => {
    const A = [
      [1e20, 0, 0],
      [0, 1, 1],
      [0, 0, 1],
    ];
    const r = eigs(A.map((row) => row.map((x) => bignumber(x))) as never) as unknown as {
      eigenvectors: { value: Val; vector: unknown }[];
    };
    // mathjs 15.3.0 and `main` both return 2 eigenpairs here (one per independent direction).
    // The builder returns 3 — the third is a fabricated [0,0,1] with ||Av - v|| = 1.
    expect(r.eigenvectors.length).toBe(2);
    // and no returned direction may be the fabricated e3 (its first two coordinates are 0 and
    // the third is non-zero, which cannot satisfy A v = 1 v because row 1 is [0,1,1]).
    for (const p of r.eigenvectors) {
      const v = toArr(p.vector).map((x) =>
        typeof x === 'number' ? x : Number(String(x as { toString(): string }))
      );
      const isFabricatedE3 = Math.abs(v[0]) === 0 && Math.abs(v[1]) === 0 && Math.abs(v[2]) > 0;
      expect(isFabricatedE3, `fabricated eigenvectors: ${JSON.stringify(v)}`).toBe(false);
    }
  });

  it('the defective block [[1,1],[0,1]] alone yields no direction with residual 1', () => {
    const A = [
      [1, 1],
      [0, 1],
    ];
    const r = eigs(A as never) as unknown as { eigenvectors: { value: Val; vector: unknown }[] };
    // mathjs 15.3.0 returns exactly one vector, [1, 0]; `main` matched.
    expect(r.eigenvectors.length).toBe(1);
    const v = toArr(r.eigenvectors[0].vector).map((x) => re(x as Val));
    const nv = Math.hypot(...v) || 1;
    // A v = 1 * v
    const r0 = Math.abs(A[0][0] * v[0] + A[0][1] * v[1] - v[0]) / nv;
    const r1 = Math.abs(A[1][1] * v[1] - v[1]) / nv;
    expect(Math.max(r0, r1)).toBeLessThan(1e-12);
  });
});
