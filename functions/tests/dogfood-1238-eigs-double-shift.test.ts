/**
 * Dogfood #1238 - the general eigs solver converges for a complex conjugate pair.
 *
 * The QR iteration of `complexEigs` shifted by one real number, the bottom right corner. A real
 * shift cannot separate a complex pair, so a BigNumber, Complex or Fraction matrix with a complex
 * pair did not deflate in 100 steps and eigs threw "failed to converge". Entries of type `number`
 * and BigNumber now take a real double-shift step (Francis) when the trailing 2x2 block has a
 * complex pair. Entries of type Complex take the Wilkinson shift, the eigenvalue of the trailing
 * block that is nearer to the corner.
 *
 * Reference values: the native solver of `eigs(number[][])`, equal to NumPy within 1e-14.
 */
import { describe, it, expect } from 'vitest';
import { eigs, bignumber, complex, fraction } from '../src/index.js';

type Ri = { re: number; im: number };

const toRi = (x: unknown): Ri => {
  if (typeof x === 'number') return { re: x, im: 0 };
  const o = x as { re?: unknown; im?: unknown };
  if (typeof o.re === 'number' && typeof o.im === 'number') return { re: o.re, im: o.im };
  return { re: Number(x), im: 0 };
};
const byValue = (p: Ri, q: Ri): number => p.re - q.re || p.im - q.im;

type EigResult = {
  values: unknown[];
  eigenvectors?: Array<{ value: unknown; vector: unknown[] }>;
};
const run = (A: unknown[][]): EigResult => eigs(A as never) as unknown as EigResult;

const asBig = (A: number[][]) => A.map((r) => r.map((x) => bignumber(x)));
const asComplex = (A: number[][]) => A.map((r) => r.map((x) => complex(x, 0)));
/** A converter of number rows: `bignumber` gives BigNumber, `complex` still gives unknown (#1359). */
type Conv = (A: number[][]) => unknown[][];

/** The largest relative distance from a wanted value to the nearest computed value. */
function worstRelError(got: unknown[], want: Ri[], scale: (w: Ri) => number): number {
  expect(got).toHaveLength(want.length);
  const rest = got.map(toRi).sort(byValue);
  const wanted = [...want].sort(byValue);
  let worst = 0;
  wanted.forEach((w, i) => {
    const d = Math.hypot(rest[i].re - w.re, rest[i].im - w.im);
    worst = Math.max(worst, d / scale(w));
  });
  return worst;
}

/** |A v - l v| / (max|A| |v|) for a vector of numbers, BigNumbers or Complex values. */
function residual(A: number[][], l: unknown, v: unknown[]): number {
  const lam = toRi(l);
  const vec = v.map(toRi);
  let amax = 0;
  for (const row of A) for (const x of row) amax = Math.max(amax, Math.abs(x));
  const vnorm = Math.hypot(...vec.map((z) => Math.hypot(z.re, z.im)));
  let worst = 0;
  for (let i = 0; i < A.length; i++) {
    let ar = 0;
    let ai = 0;
    for (let j = 0; j < A.length; j++) {
      ar += A[i][j] * vec[j].re;
      ai += A[i][j] * vec[j].im;
    }
    const er = ar - (lam.re * vec[i].re - lam.im * vec[i].im);
    const ei = ai - (lam.re * vec[i].im + lam.im * vec[i].re);
    worst = Math.max(worst, Math.hypot(er, ei));
  }
  return worst / (amax * vnorm);
}

// The 4x4 matrix of the issue: the spectrum has a complex pair 1.5998 +- 5.0001i.
const A1238 = [
  [1.552, -1.952, 1.325, 4.959],
  [1.795, 1.731, -3.273, 3.832],
  [2.073, 3.275, 2.394, -1.623],
  [2.939, -3.078, 0.799, -2.662],
];
const WANT: Ri[] = [
  { re: -4.73468610936722, im: 0 },
  { re: 1.599847612049822, im: -5.0001436666267844 },
  { re: 1.599847612049822, im: 5.0001436666267844 },
  { re: 4.549990885267572, im: 0 },
];

describe('eigs of the #1238 matrix with a complex pair', () => {
  it('the number[][] input is the reference', () => {
    expect(worstRelError(run(A1238).values, WANT, (w) => Math.hypot(w.re, w.im))).toBeLessThan(
      1e-13
    );
  });

  for (const [name, make] of [
    ['BigNumber', asBig],
    ['Complex', asComplex],
  ] as const) {
    it(`${name} entries: no throw, values and eigenvectors agree with the reference`, () => {
      const r = run(make(A1238));
      expect(worstRelError(r.values, WANT, (w) => Math.hypot(w.re, w.im))).toBeLessThan(1e-12);
      expect(r.eigenvectors).toHaveLength(4);
      for (const { value, vector } of r.eigenvectors!) {
        expect(residual(A1238, value, vector)).toBeLessThan(1e-10);
      }
    });
  }
});

/** The linear congruential generator of the issue batch; the seed makes every run equal. */
function makeGen(seed0: number) {
  let seed = seed0;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return (n: number): number[][] =>
    Array.from({ length: n }, () =>
      Array.from({ length: n }, () => Math.round((rnd() * 10 - 5) * 1000) / 1000)
    );
}

// Entries of 40 matrices 4x4, then 40 matrices 6x6, from seed 1238. The listed matrices are the
// 6x6 matrices whose BigNumber (or Complex) eigs threw "failed to converge" before the fix
// (measured: 7 of 40 BigNumber, 5 of 40 Complex), and three 4x4 matrices as controls.
const SEEDED = (() => {
  const gen = makeGen(1238);
  const m4 = Array.from({ length: 40 }, () => gen(4));
  const m6 = Array.from({ length: 40 }, () => gen(6));
  return { m4, m6 };
})();

describe('eigs of seeded random matrices (#1238)', () => {
  const cases: Array<[string, number[][], Conv]> = [
    ...[0, 1, 2].map((k): [string, number[][], Conv] => [
      `BigNumber 4x4 #${k}`,
      SEEDED.m4[k],
      asBig,
    ]),
    ...[1, 5, 8, 20].map((k): [string, number[][], Conv] => [
      `BigNumber 6x6 #${k}`,
      SEEDED.m6[k],
      asBig,
    ]),
    ...[5, 8, 15, 21].map((k): [string, number[][], Conv] => [
      `Complex 6x6 #${k}`,
      SEEDED.m6[k],
      asComplex,
    ]),
  ];
  it.each(cases)('%s converges to the reference values', (_name, A, make) => {
    const want = run(A).values.map(toRi);
    const maxL = Math.max(...want.map((z) => Math.hypot(z.re, z.im)));
    const got = run(make(A)).values;
    expect(worstRelError(got, want, () => maxL)).toBeLessThan(1e-9);
  });
});

describe('eigs with Fraction entries (the native solver since #1179)', () => {
  it('[[0,-1],[1,0]] gives +-i (#1179 item 1)', () => {
    const r = run([
      [fraction(0), fraction(-1)],
      [fraction(1), fraction(0)],
    ]);
    const A = [
      [0, -1],
      [1, 0],
    ];
    expect(
      worstRelError(
        r.values,
        [
          { re: 0, im: -1 },
          { re: 0, im: 1 },
        ],
        () => 1
      )
    ).toBeLessThan(1e-12);
    for (const { value, vector } of r.eigenvectors!) {
      expect(residual(A, value, vector)).toBeLessThan(1e-12);
    }
  });

  it('the #1238 matrix with one Fraction entry converges', () => {
    const A = A1238.map((row, i) => row.map((x, j) => (i === 0 && j === 0 ? fraction(x) : x)));
    const r = run(A);
    expect(worstRelError(r.values, WANT, (w) => Math.hypot(w.re, w.im))).toBeLessThan(1e-12);
    for (const { value, vector } of r.eigenvectors!) {
      expect(residual(A1238, value, vector)).toBeLessThan(1e-10);
    }
  });

  it('the #1238 matrix times 2^530 does not overflow in the double-shift step', () => {
    // 2^530 squared is 1e319, above the double range. The shift step scales by a power of 2 first.
    const s = 2 ** 530;
    const A = A1238.map((row, i) =>
      row.map((x, j) => (i === 0 && j === 0 ? fraction(x * s) : x * s))
    );
    const r = run(A);
    const want = WANT.map((w) => ({ re: w.re * s, im: w.im * s }));
    expect(worstRelError(r.values, want, (w) => Math.hypot(w.re, w.im))).toBeLessThan(1e-12);
  });
});
