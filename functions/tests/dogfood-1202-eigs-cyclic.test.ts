import { describe, it, expect } from 'vitest';
import type BigNumber from 'bignumber.js';
import { eigs, bignumber, complex } from '../src/index.js';

const bn = (x: number | string) => bignumber(x) as BigNumber;

type Ri = { re: number; im: number };
const toRi = (x: unknown): Ri => {
  if (typeof x === 'number') return { re: x, im: 0 };
  const o = x as { re?: number; im?: number; toNumber?: () => number };
  if (typeof o.re === 'number') return { re: o.re, im: o.im ?? 0 };
  return { re: (x as { toNumber: () => number }).toNumber(), im: 0 };
};

const CYCLE = [
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 0],
];
const W = Math.sqrt(3) / 2;
// cube roots of unity
const ROOTS: Ri[] = [
  { re: -0.5, im: -W },
  { re: -0.5, im: W },
  { re: 1, im: 0 },
];

/** Every expected value must match a distinct computed value within relTol * scale. */
function expectSpectrum(got: unknown[], want: Ri[], scale: number, relTol: number) {
  expect(got).toHaveLength(want.length);
  const left = got.map(toRi);
  for (const w of want) {
    let best = -1;
    let bestD = Infinity;
    left.forEach((g, i) => {
      const d = Math.hypot(g.re - w.re * scale, g.im - w.im * scale);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    expect(bestD).toBeLessThanOrEqual(relTol * scale);
    left.splice(best, 1);
  }
}

const exps = [0, -20, -40, -60, 40];
// 1e-9 relative: well above the roundoff of a 3x3 QR sweep (about 1e-15),
// far below the distance between neighbouring cube roots (1.7).
const REL = 1e-9;

describe('eigs on a cyclic 3x3 permutation matrix (#1202)', () => {
  it.each(exps)('number matrix at 2^%i is unchanged', (e) => {
    const s = 2 ** e;
    const { values } = eigs(CYCLE.map((r) => r.map((x) => x * s))) as unknown as {
      values: unknown[];
    };
    expectSpectrum(values, ROOTS, s, REL);
  });

  it.each(exps)('BigNumber matrix at 2^%i has the cube roots of unity times the scale', (e) => {
    const f = bn(2).pow(e);
    const A = CYCLE.map((r) => r.map((x) => bn(x).times(f)));
    const { values } = eigs(A) as unknown as { values: unknown[] };
    expectSpectrum(values, ROOTS, 2 ** e, REL);
  });

  it.each(exps)('Complex matrix at 2^%i has the cube roots of unity times the scale', (e) => {
    const s = 2 ** e;
    const A = CYCLE.map((r) => r.map((x) => complex(x * s, 0)));
    const { values } = eigs(A) as unknown as { values: unknown[] };
    expectSpectrum(values, ROOTS, s, REL);
  });

  it.each(exps)('BigNumber eigenvectors at 2^%i satisfy A v = lambda v', (e) => {
    const f = bn(2).pow(e);
    const A = CYCLE.map((r) => r.map((x) => bn(x).times(f)));
    const { eigenvectors } = eigs(A) as unknown as {
      eigenvectors: { value: unknown; vector: unknown[] }[];
    };
    expect(eigenvectors).toHaveLength(3);
    const s = 2 ** e;
    for (const { value, vector } of eigenvectors) {
      const l = toRi(value);
      const v = vector.map(toRi);
      let worst = 0;
      let vmax = 0;
      for (let i = 0; i < 3; i++) {
        // row i of the cycle matrix picks entry (i + 1) mod 3
        const av = v[(i + 1) % 3];
        worst = Math.max(
          worst,
          Math.hypot(
            s * av.re - (l.re * v[i].re - l.im * v[i].im),
            s * av.im - (l.re * v[i].im + l.im * v[i].re)
          )
        );
        vmax = Math.max(vmax, Math.hypot(v[i].re, v[i].im));
      }
      expect(vmax).toBeGreaterThan(0);
      expect(worst / (s * vmax)).toBeLessThan(1e-8);
    }
  });

  it('a non-cyclic, non-triangular BigNumber matrix at 2^-50 keeps its eigenvalues', () => {
    const f = bn(2).pow(-50);
    // eigenvalues (5 -+ sqrt(33)) / 2
    const M = [
      [1, 2],
      [3, 4],
    ];
    const { values } = eigs(M.map((r) => r.map((x) => bn(x).times(f)))) as unknown as {
      values: unknown[];
    };
    const got = values.map((v) => toRi(v).re).sort((a, b) => a - b);
    const s = 2 ** -50;
    const want = [(5 - Math.sqrt(33)) / 2, (5 + Math.sqrt(33)) / 2];
    want.forEach((w, i) => expect(Math.abs(got[i] - w * s)).toBeLessThanOrEqual(REL * s));
  });
});
