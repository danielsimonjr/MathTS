import { describe, it, expect } from 'vitest';
import type { BigNumber } from '@danielsimonjr/mathts-core';
import { eigs, bignumber, complex } from '../src/index.js';

const bn = (x: number | string): BigNumber => bignumber(x);

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

/** Every expected value must match a distinct computed value within relTol * max(|want|, 1). */
function expectValues(got: unknown[], want: Ri[], relTol: number) {
  expect(got).toHaveLength(want.length);
  const left = got.map(toRi);
  for (const w of want) {
    const ds = left.map((g) => Math.hypot(g.re - w.re, g.im - w.im));
    const best = ds.indexOf(Math.min(...ds));
    expect(ds[best]).toBeLessThanOrEqual(relTol * Math.max(Math.hypot(w.re, w.im), 1));
    left.splice(best, 1);
  }
}

/** A v = lambda v for each pair, relative to max(|lambda|, 1) * max|v|. */
function expectEigenpairs(A: number[][], pairs: { value: unknown; vector: unknown[] }[]) {
  expect(pairs).toHaveLength(A.length);
  for (const { value, vector } of pairs) {
    const l = toRi(value);
    const v = vector.map(toRi);
    const vmax = Math.max(...v.map((x) => Math.hypot(x.re, x.im)));
    expect(vmax).toBeGreaterThan(0);
    for (let i = 0; i < A.length; i++) {
      let re = -(l.re * v[i].re - l.im * v[i].im);
      let im = -(l.re * v[i].im + l.im * v[i].re);
      for (let j = 0; j < A.length; j++) {
        re += A[i][j] * v[j].re;
        im += A[i][j] * v[j].im;
      }
      expect(Math.hypot(re, im)).toBeLessThanOrEqual(
        1e-8 * Math.max(Math.hypot(l.re, l.im), 1) * vmax
      );
    }
  }
}

describe('eigs of a small block beside a huge entry (#1202 review)', () => {
  // A 2x2 rotation-like block decoupled from a 1e20 entry. Tolerances relative
  // to the whole matrix (1e-12 * 1e20 = 1e8) must not erase the coupling 1 of
  // the block.
  const SKEW = [
    [1e20, 0, 0],
    [0, 1e-5, 1],
    [0, -1, 1e-5],
  ];
  const SKEW_VALUES: Ri[] = [
    { re: 1e-5, im: 1 },
    { re: 1e-5, im: -1 },
    { re: 1e20, im: 0 },
  ];
  const ROT = [
    [1e20, 0, 0],
    [0, 0, 1],
    [0, -1, 0],
  ];
  const ROT_VALUES: Ri[] = [
    { re: 0, im: 1 },
    { re: 0, im: -1 },
    { re: 1e20, im: 0 },
  ];

  it.each([
    ['BigNumber', 'skew', SKEW, SKEW_VALUES],
    ['Complex', 'skew', SKEW, SKEW_VALUES],
    ['BigNumber', 'rotation', ROT, ROT_VALUES],
    ['Complex', 'rotation', ROT, ROT_VALUES],
  ] as const)('%s %s block keeps its complex pair', (kind, _name, M, want) => {
    const A = M.map((r) => r.map((x) => (kind === 'BigNumber' ? bn(x) : complex(x, 0))));
    const { values } = eigs(A, { eigenvectors: false }) as unknown as { values: unknown[] };
    expectValues(values, want as Ri[], 1e-9);
  });

  it.each([
    ['BigNumber', SKEW],
    ['Complex', SKEW],
    ['BigNumber', ROT],
    ['Complex', ROT],
  ] as const)('%s block eigenvectors satisfy A v = lambda v', (kind, M) => {
    const A = M.map((r) => r.map((x) => (kind === 'BigNumber' ? bn(x) : complex(x, 0))));
    const { eigenvectors } = eigs(A) as unknown as {
      eigenvectors: { value: unknown; vector: unknown[] }[];
    };
    expectEigenpairs(M as unknown as number[][], eigenvectors);
  });
});

describe('eigs symmetric routing is relative to each pair (#1202 review)', () => {
  type Pair = { value: unknown; vector: unknown[] };
  const SQRT5 = bn(5).sqrt();

  it('BigNumber pair within precision of its own size takes the symmetric solver', () => {
    // 1e-13 <= 1e-12 * 2, so the pair (2, 2 + 1e-13) is symmetric and the
    // result is that of [[1,2],[2,3]]: 2 -+ sqrt(5), to full BigNumber precision.
    // The general solver would give 2 + sqrt(5) + 4.4e-14.
    const A = [
      [bn(1), bn(2)],
      [bn(2).plus(bn('1e-13')), bn(3)],
    ];
    const { values } = eigs(A) as unknown as { values: BigNumber[] };
    const top = values[1];
    expect(top.minus(bn(2).plus(SQRT5)).abs().lt(bn('1e-30'))).toBe(true);
  });

  it('a small entry beside a zero is not symmetric: the matrix stays defective', () => {
    // 1e-13 is below the precision 1e-12, but the pair (1e-13, 0) is compared
    // with its own size. A symmetric reading would return two eigenvectors.
    const A = [
      [bn(1), bn('1e-13')],
      [bn(0), bn(1)],
    ];
    const { eigenvectors } = eigs(A) as unknown as { eigenvectors: Pair[] };
    expect(eigenvectors).toHaveLength(1);
  });

  it('Complex entry with an imaginary part within precision of its size is read as real', () => {
    const A = [
      [complex(1, 0), complex(2, 0)],
      [complex(2, 1e-13), complex(3, 0)],
    ];
    const { values } = eigs(A) as unknown as { values: unknown[] };
    expect(values.every((v) => typeof v === 'number')).toBe(true);
    expectValues(
      values,
      [
        { re: 2 - Math.sqrt(5), im: 0 },
        { re: 2 + Math.sqrt(5), im: 0 },
      ],
      1e-9
    );
  });

  it('an exactly symmetric BigNumber matrix with mixed magnitudes has real eigenpairs', () => {
    const M = [
      [1e20, 1e-5, 3],
      [1e-5, 2, 1e10],
      [3, 1e10, 1e-8],
    ];
    const { values, eigenvectors } = eigs(M.map((r) => r.map((x) => bn(x)))) as unknown as {
      values: unknown[];
      eigenvectors: Pair[];
    };
    expectValues(
      values,
      [
        { re: -1e10, im: 0 },
        { re: 1e10, im: 0 },
        { re: 1e20, im: 0 },
      ],
      1e-9
    );
    expect(eigenvectors).toHaveLength(3);
  });
});
