/**
 * G10 CHALLENGER — native `eigs` contract pins (MathTS policy: critical libraries are
 * never changed to match mathjs).
 *
 * `@danielsimonjr/mathts-functions` is a critical library. Under Daniel's policy its
 * public `eigs` keeps the NATIVE contract it had on `main`; mathjs's `precision`
 * semantics, its (non-normalized) eigenvector scaling and its value order belong in
 * `mathts-compat` as a thin adapter. Builder head 0c09b67b replaced the public native
 * export with the mathjs 15.3.0 factory port and edited the native tests to match.
 *
 * These tests pin the pre-#1561 native behaviour that the builder changed. They are
 * EXPECTED TO FAIL on the builder branch and PASS on `main`. Each failure is a native
 * regression, not a parity gap.
 *
 * Numeric ground truth is NumPy / mpmath, not mathjs.
 */
import { describe, it, expect } from 'vitest';
import { eigs } from '@danielsimonjr/mathts-functions';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

type Vec = Array<number | { re: number; im: number }>;
type Pairs = {
  values: Vec | { toArray(): Vec };
  eigenvectors?: Array<{
    value: number | { re: number; im: number };
    vector: Vec | { toArray(): Vec };
  }>;
};
const arr = (x: Vec | { toArray(): Vec }): Vec =>
  x && typeof (x as { toArray?: () => Vec }).toArray === 'function'
    ? (x as { toArray(): Vec }).toArray()
    : (x as Vec);
/** Signature helper for the determinism pins: the returned vectors are untitled `unknown[]`. */
const sigOf = (x: unknown[]): string => JSON.stringify(x);
const re = (x: number | { re: number; im: number }): number => (typeof x === 'number' ? x : x.re);

describe('native eigs: public result SHAPE for a native DenseMatrix (#1179, pre-#1561)', () => {
  it('a DenseMatrix input returns Matrix values and Matrix vectors, as main does', () => {
    const r = eigs(
      new DenseMatrix([
        [5, 2.3],
        [2.3, 1],
      ]) as never
    ) as unknown as Pairs;
    // `main`: `r.values.constructor.name === 'MathJSDenseMatrix'`.
    // builder: plain Array (the typed factory resolves Matrix -> Array and never matricizes).
    expect(typeof (r.values as { toArray?: unknown }).toArray).toBe('function');
    expect(r.eigenvectors!.length).toBe(2);
    expect(typeof (r.eigenvectors![0].vector as { toArray?: unknown }).toArray).toBe('function');
  });
});

describe('native eigs: eigenvectors are unit-normalized (pre-#1561 native contract)', () => {
  it('[[4,1],[2,3]] has two unit eigenvectors (main: both norms are 1)', () => {
    const r = eigs([
      [4, 1],
      [2, 3],
    ]) as unknown as Pairs;
    const norms = r.eigenvectors!.map((p) => Math.hypot(...arr(p.vector).map((x) => re(x))));
    // main: [1.0000000000000002, 1.0000000000000002]; builder: [1, 2.5298221281]
    for (const n of norms) expect(n).toBeCloseTo(1, 9);
  });

  it('a symmetric 3x3 has unit eigenvectors', () => {
    const r = eigs([
      [5, 2.3, 1.2],
      [2.3, 1, 0.8],
      [1.2, 0.8, 7],
    ]) as unknown as Pairs;
    for (const p of r.eigenvectors!) {
      expect(Math.hypot(...arr(p.vector).map((x) => re(x)))).toBeCloseTo(1, 9);
    }
  });
});

describe('native eigs: `precision` is an accuracy knob, not a "drop the eigenvalue" knob', () => {
  it('the default call returns the true spectrum (NumPy: -0.3722813232690143, 5.372281323269014)', () => {
    const r = eigs([
      [1, 2],
      [3, 4],
    ]) as unknown as Pairs;
    const v = arr(r.values)
      .map(re)
      .sort((a, b) => a - b);
    expect(v[0]).toBeCloseTo(-0.3722813232690143, 12);
    expect(v[1]).toBeCloseTo(5.372281323269014, 12);
  });

  it('a loose numeric precision must NOT collapse [[1,2],[3,4]] to the false spectrum [0, 5]', () => {
    // NumPy: the true eigenvalues are -0.3723, 5.3723 for EVERY precision setting.
    // mathjs 15.3.0 (the oracle) returns the WRONG [0, 5] for precision >= 1 — that is a
    // mathjs quirk. `main` returned the correct pair (it ignored the number).
    // The builder now returns the false [0, 5] here, with an 89% eigenpair residual.
    const A = [
      [1, 2],
      [3, 4],
    ];
    const r = eigs(A, 2 as never) as unknown as Pairs;
    const v = arr(r.values)
      .map(re)
      .sort((a, b) => a - b);
    expect(v[0]).toBeCloseTo(-0.3722813232690143, 6);
    expect(v[1]).toBeCloseTo(5.372281323269014, 6);
    // And the eigenpairs must still satisfy A v = lambda v.
    for (const p of r.eigenvectors!) {
      const lam = re(p.value);
      const x = arr(p.vector).map(re);
      const nv = Math.hypot(...x);
      for (let i = 0; i < 2; i++) {
        const row = A[i][0] * x[0] + A[i][1] * x[1];
        expect(Math.abs(row - lam * x[i]) / nv).toBeLessThan(1e-9);
      }
    }
  });

  it('a precision that makes the shift drop an eigenvalue must not be honoured by the NATIVE solver', () => {
    // [[1,2,3],[4,5,6],[7,8,9]] is singular: exact eigenvalues 0, -1.1168, 16.1168.
    // The oracle's `precision: 1e-6` leaves a 2.02e-10 in place of the true 0 — mathjs noise.
    // `main` returned ~ -8.0e-16 for the zero eigenvalue, i.e. the right answer to rounding.
    const r = eigs(
      [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      { precision: 1e-6, eigenvectors: false } as never
    ) as unknown as Pairs;
    const v = arr(r.values).map(re);
    const byMagnitude = [...v].sort((a, b) => Math.abs(a) - Math.abs(b));
    expect(Math.abs(byMagnitude[0])).toBeLessThan(1e-13); // the zero eigenvalue
    expect(Math.min(...v)).toBeCloseTo(-1.1168439700096702, 6);
    expect(Math.max(...v)).toBeCloseTo(16.11684396980739, 6);
  });
});

describe('native eigs: value order is the native real-part order (pre-#1561)', () => {
  it('[[0,-1],[1,0]] lists the -i member first, then +i', () => {
    // `main` (native orthes/hqr2, real part ascending then imaginary):
    //   both [[0,-1],[1,0]] and [[0,1],[-1,0]] give  [{re:0,im:-1}, {re:0,im:1}]
    // The builder emits the mathjs factory order instead: the +i member first for
    // [[0,-1],[1,0]] (measured `[ '(0,1)', '(0,-1)', 3 ]` on the #1323 case).
    for (const A of [
      [
        [0, -1],
        [1, 0],
      ],
      [
        [0, 1],
        [-1, 0],
      ],
    ]) {
      const r = eigs(A as never) as unknown as Pairs;
      const vals = arr(r.values) as Array<{ re: number; im: number }>;
      expect(vals[0].im).toBeCloseTo(-1, 9);
      expect(vals[1].im).toBeCloseTo(1, 9);
    }
  });
});

describe('native eigs: deterministic across runs (no Math.random in the public path)', () => {
  it('a similarity-transformed defective Jordan block gives bit-identical vectors on repeat', () => {
    const A = [
      [2.3013132018361397, -1.2122386417804276],
      [1.3969329065322387, -0.30131320183613985],
    ];
    const sig = (): string =>
      JSON.stringify(
        (eigs(A as never).eigenvectors as { vector: unknown }[]).map((p) =>
          sigOf(p.vector as unknown[])
        )
      );
    const s0 = sig();
    for (let i = 0; i < 15; i++) expect(sig()).toBe(s0);
  });

  it('a 5x5 similarity-transformed Jordan block gives bit-identical vectors on repeat', () => {
    // This input takes the ROBUST solver (P J P^-1, defective) — where the builder's
    // `complexEigs-robust.ts` still starts inverse iteration from `2 * Math.random() - 1`
    // (line ~1224), so every call returns a different eigenvector set. `main` uses one
    // deterministic solver and is stable here. 20 distinct results out of 20 runs on the
    // builder; 1 on main.
    const A = [
      [
        10.470052230312909, -23.11703938311167, -8.756573190916546, 2.995549531480902,
        -14.944691736086222,
      ],
      [
        2.628130770878335, -5.650695027732036, -2.049211640815812, 0.37365311373979304,
        -4.164601550259879,
      ],
      [
        -1.878119507072047, 6.119903765024423, 3.048031804976177, -0.19058574660159214,
        4.036498001845862,
      ],
      [
        -3.8234269077846146, 9.356218575265482, 3.6414084901214543, 0.45411510268920136,
        5.712281042149916,
      ],
      [
        2.3001176028563357, -6.221576382708147, -2.9207701454334227, 1.2629090519282555,
        -3.321504110246249,
      ],
    ];
    const sig = (): string =>
      JSON.stringify(
        (eigs(A as never).eigenvectors as { vector: unknown }[]).map((p) =>
          (p.vector as unknown[]).map(String)
        )
      );
    const s0 = sig();
    for (let i = 0; i < 15; i++) expect(sig()).toBe(s0);
  });
});

describe('native eigs: large-scale symmetric accuracy (#1243 scale invariance)', () => {
  it('a symmetric 3x3 with a 1e12 diagonal separates the small coupling eigenvalues (mpmath: -8.60232527, 0, 8.60232527)', () => {
    // Ground truth from mpmath at 60 digits, NOT numpy (numpy returns -8.60229492 here,
    // off in the 5th figure because it loses the small eigenvalues to the 1e12 pivot):
    //   eigvalsh([[1e12,7,0],[7,1e12,5],[0,5,1e12]]) - 1e12 = [-8.602325267..., 0, 8.602325267...]
    const A = [
      [1e12, 7, 0],
      [7, 1e12, 5],
      [0, 5, 1e12],
    ];
    const r = eigs(A, { eigenvectors: false } as never) as unknown as Pairs;
    const shifted = arr(r.values)
      .map((x) => re(x) - 1e12)
      .sort((a, b) => a - b);
    // The 1e12 pivot holds ~1e-4 of rounding, so the outer pair is required to ~3 digits.
    expect(shifted[0]).toBeCloseTo(-Math.sqrt(74), 3);
    expect(shifted[2]).toBeCloseTo(Math.sqrt(74), 3);
  });

  it('a symmetric matrix with a 1e15 diagonal keeps its small eigenvalue (mpmath: exactly 5)', () => {
    // mpmath at 60 digits: eigenvalues 999999999999997, 1000000000000003, 4.999999999999995.
    // `main` returns 4.99236206827 here (rel err 1.5e-3); the builder returns ~5.
    // CLASSIFICATION (a) GENUINE NATIVE FIX: the builder's realSymmetric tolerance change is
    // more accurate than main at this scale, verified against mpmath — so this assertion
    // documents the improvement and is expected to FAIL on `main`. It is NOT a regression
    // pin; it is here so the parity claim is checked against high-precision truth rather
    // than against numpy (which is itself off at 1e15).
    const A = [
      [1e15, 3, 1],
      [3, 1e15, 2],
      [1, 2, 5],
    ];
    const r = eigs(A, { eigenvectors: false } as never) as unknown as Pairs;
    const v = arr(r.values)
      .map(re)
      .sort((a, b) => a - b);
    expect(v[0]).toBeCloseTo(5, 6);
  });
});
