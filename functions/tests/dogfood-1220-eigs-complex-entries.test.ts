import { describe, it, expect } from 'vitest';
import { eigs, complex, matrix } from '../src/index.js';

type Ri = { re: number; im: number };
const toRi = (x: unknown): Ri => {
  if (typeof x === 'number') return { re: x, im: 0 };
  const o = x as { re: number; im: number };
  return { re: o.re, im: o.im };
};
type Res = { values: unknown[]; eigenvectors?: { value: unknown; vector: unknown }[] };
const run = (r: unknown): Res => r as Res;
const C = (re: number, im: number) => complex(re, im);

/** Every expected value matches a distinct computed value. */
function expectSpectrum(got: unknown[], want: Ri[], tol = 1e-9) {
  expect(got).toHaveLength(want.length);
  const left = got.map(toRi);
  for (const w of want) {
    const k = left.findIndex((g) => Math.hypot(g.re - w.re, g.im - w.im) < tol);
    expect(k, `missing eigenvalue ${w.re}+${w.im}i in ${JSON.stringify(left)}`).toBeGreaterThan(-1);
    left.splice(k, 1);
  }
}

const mul = (a: Ri, b: Ri): Ri => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

/** A v = lambda v for every returned pair. */
function expectPairs(
  A: unknown[][],
  res: { eigenvectors?: { value: unknown; vector: unknown }[] }
) {
  expect(res.eigenvectors!.length).toBeGreaterThan(0);
  for (const { value, vector } of res.eigenvectors!) {
    const lam = toRi(value);
    const v = (vector as unknown[]).map(toRi);
    const n = A.length;
    for (let i = 0; i < n; i++) {
      let s: Ri = { re: 0, im: 0 };
      for (let j = 0; j < n; j++) {
        const p = mul(toRi(A[i][j]), v[j]);
        s = { re: s.re + p.re, im: s.im + p.im };
      }
      const r = mul(lam, v[i]);
      expect(Math.hypot(s.re - r.re, s.im - r.im)).toBeLessThan(1e-8);
    }
  }
}

describe('eigs keeps the imaginary part of Complex entries (#1220)', () => {
  it('1x1 complex(2,1)', () => {
    const A = [[C(2, 1)]];
    const r = run(eigs(A));
    expectSpectrum(r.values, [{ re: 2, im: 1 }]);
    expectPairs(A, r);
  });

  it('diag(i, 1)', () => {
    const A = [
      [C(0, 1), 0],
      [0, 1],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 0, im: 1 },
      { re: 1, im: 0 },
    ]);
    expectPairs(A, r);
  });

  it('diag(2+i, 5+i)', () => {
    const A = [
      [C(2, 1), 0],
      [0, C(5, 1)],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 2, im: 1 },
      { re: 5, im: 1 },
    ]);
    expectPairs(A, r);
  });

  it('upper triangular [[2+i,1],[0,3]]', () => {
    const A = [
      [C(2, 1), 1],
      [0, 3],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 2, im: 1 },
      { re: 3, im: 0 },
    ]);
    expectPairs(A, r);
  });

  it('off-diagonal Complex entry', () => {
    const A = [
      [1, C(0, 2)],
      [0, 4],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 1, im: 0 },
      { re: 4, im: 0 },
    ]);
    expectPairs(A, r);
  });

  it('Hermitian [[2,1-i],[1+i,3]] has eigenvalues within 1e-8 of 1 and 4', () => {
    const A = [
      [C(2, 0), C(1, -1)],
      [C(1, 1), C(3, 0)],
    ];
    const r = run(eigs(A));
    expectSpectrum(
      r.values,
      [
        { re: 1, im: 0 },
        { re: 4, im: 0 },
      ],
      1e-8
    );
    expectPairs(A, r);
  });

  it('general Complex 2x2 [[1+i, 2],[0, 3-2i]]', () => {
    const A = [
      [C(1, 1), C(2, 0)],
      [C(0, 0), C(3, -2)],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 1, im: 1 },
      { re: 3, im: -2 },
    ]);
    expectPairs(A, r);
  });

  it('general Complex 3x3 triangular', () => {
    const A = [
      [C(1, 2), C(0, 1), 3],
      [0, C(-1, 1), C(2, 2)],
      [0, 0, C(4, -3)],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 1, im: 2 },
      { re: -1, im: 1 },
      { re: 4, im: -3 },
    ]);
    expectPairs(A, r);
  });

  it('Matrix input and eigenvectors:false keep the imaginary part', () => {
    const r = run(eigs(matrix([[C(2, 1)]]), { eigenvectors: false }));
    expectSpectrum((r.values as unknown as { toArray(): unknown[] }).toArray(), [{ re: 2, im: 1 }]);
  });

  it('real-valued Complex matrix is unchanged', () => {
    const A = [
      [C(2, 0), C(1, 0)],
      [C(1, 0), C(2, 0)],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 1, im: 0 },
      { re: 3, im: 0 },
    ]);
    expectPairs(A, r);
  });

  it('number matrices are unchanged', () => {
    expectSpectrum(
      run(
        eigs([
          [2, 1],
          [1, 2],
        ])
      ).values,
      [
        { re: 1, im: 0 },
        { re: 3, im: 0 },
      ]
    );
    expectSpectrum(
      run(
        eigs([
          [0, -1],
          [1, 0],
        ])
      ).values,
      [
        { re: 0, im: 1 },
        { re: 0, im: -1 },
      ]
    );
  });

  it('complex(Complex), complex({re,im}) and complex(string) build a plain Complex', () => {
    const c = complex(2, 1) as Ri;
    const d = (complex as (x: unknown) => unknown)(c) as Ri;
    expect(d).toMatchObject({ re: 2, im: 1 });
    expect(d).not.toBe(c);
    expect((complex as (x: unknown) => unknown)({ re: 3, im: 4 })).toMatchObject({ re: 3, im: 4 });
    expect((complex as (x: unknown) => unknown)('2+i')).toMatchObject({ re: 2, im: 1 });
  });

  it('complex(Matrix) maps each entry and returns a Matrix, as in mathjs', () => {
    const r = (complex as (x: unknown) => unknown)(matrix([1, 2])) as {
      isMatrix: boolean;
      toArray: () => unknown[];
    };
    expect(r.isMatrix).toBe(true);
    expect(r.toArray().map(toRi)).toEqual([
      { re: 1, im: 0 },
      { re: 2, im: 0 },
    ]);
  });

  it('a Complex part of the two-argument form throws a TypeError, as in mathjs', () => {
    const f = complex as (...a: unknown[]) => unknown;
    expect(() => f(C(1, 2), 5)).toThrow(TypeError);
    expect(() => f(1, C(1, 2))).toThrow(/Unexpected type of argument in function complex/);
  });

  it('a third argument throws a TypeError, as in mathjs', () => {
    expect(() => (complex as (...a: unknown[]) => unknown)(1, 2, 3)).toThrow(
      /Too many arguments in function complex/
    );
  });

  it('the collection-callback shape converts the value', () => {
    expect([1, 2].map(complex as (x: unknown) => unknown).map(toRi)).toEqual([
      { re: 1, im: 0 },
      { re: 2, im: 0 },
    ]);
  });
});
