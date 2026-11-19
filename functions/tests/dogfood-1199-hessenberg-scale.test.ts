import { describe, it, expect } from 'vitest';
import { hessenbergForm } from '../src/typed/matrix-ops.js';

const ld = (x: number, e: number): number => {
  const h = Math.trunc(e / 2);
  return x * 2 ** h * 2 ** (e - h);
};
const mm = (a: number[][], b: number[][]): number[][] =>
  a.map((_, i) => b[0].map((__, j) => a[i].reduce((s, _v, k) => s + a[i][k] * b[k][j], 0)));
const tr = (a: number[][]): number[][] => a[0].map((_, j) => a.map((r) => r[j]));
const fro = (a: number[][]): number => Math.sqrt(a.flat().reduce((s, x) => s + x * x, 0));

let seed = 12345;
const rnd = (): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648 - 0.5;
};
const n = 6;
const make = (f: (i: number, j: number) => number): number[][] =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => f(i, j)));
const random = make(() => rnd());
const sym = make((i, j) => (i <= j ? 0 : 0)).map((r) => r.slice());
for (let i = 0; i < n; i++) for (let j = i; j < n; j++) sym[i][j] = sym[j][i] = rnd();
const u = [0, 1].map(() => Array.from({ length: n }, () => rnd()));
const rank2 = make((i, j) => u[0][i] * u[0][j] + u[1][i] * u[1][j]);
const hess = make((i, j) => (j >= i - 1 ? rnd() : 0));
const zero = make(() => 0);

const cases: [string, number[][]][] = [
  ['random', random],
  ['symmetric', sym],
  ['rank-deficient', rank2],
  ['already Hessenberg', hess],
];
const exps = [-1000, -500, -60, -20, 0, 20, 60, 500, 1000];

describe('hessenbergForm is scale-free (#1199)', () => {
  for (const [name, A] of cases) {
    it.each(exps)(`${name}: reconstructs, Q orthogonal, H Hessenberg at 2^%i`, (e) => {
      const As = A.map((r) => r.map((x) => ld(x, e)));
      const { H, Q } = hessenbergForm(As);
      const Hu = H.map((r) => r.map((x) => ld(x, -e)));
      const rec = mm(mm(Q, Hu), tr(Q)).map((r, i) => r.map((x, j) => x - A[i][j]));
      expect(fro(rec) / fro(A)).toBeLessThan(1e-14);
      const qtq = mm(tr(Q), Q).map((r, i) => r.map((x, j) => x - (i === j ? 1 : 0)));
      expect(fro(qtq)).toBeLessThan(1e-14);
      for (let i = 2; i < n; i++) for (let j = 0; j < i - 1; j++) expect(H[i][j]).toBe(0);
    });
  }

  it.each(exps)('zero matrix stays zero with Q = I at 2^%i', (e) => {
    const { H, Q } = hessenbergForm(zero.map((r) => r.map((x) => ld(x, e))));
    expect(H.flat().every((x) => x === 0)).toBe(true);
    expect(Q.map((r, i) => r.every((x, j) => x === (i === j ? 1 : 0)))).not.toContain(false);
  });

  it('gives the same Q at every power-of-2 scale and scales H exactly', () => {
    const ref = hessenbergForm(random);
    for (const e of [-1000, -60, 60, 1000]) {
      const r = hessenbergForm(random.map((row) => row.map((x) => ld(x, e))));
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          expect(Math.abs(r.Q[i][j] - ref.Q[i][j])).toBeLessThan(1e-14);
          expect(Math.abs(ld(r.H[i][j], -e) - ref.H[i][j])).toBeLessThan(1e-14);
        }
    }
  });

  it('keeps the unit-scale result of the documented example', () => {
    const { H } = hessenbergForm([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expect(H[2][0]).toBe(0);
  });
  // Entries of very different size: no column of the O(1) block may be skipped.
  const base = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [2, 1, 4, 3],
    [1, 3, 2, 5],
  ];
  const absErr = (A: number[][], scaleOf: (i: number, j: number) => number): number => {
    const { H, Q } = hessenbergForm(A);
    const R = mm(mm(Q, H), tr(Q));
    let e = 0;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) e = Math.max(e, Math.abs(R[i][j] - A[i][j]) / scaleOf(i, j));
    return e;
  };

  it.each([1e150, 1e200, 1e300, 1e308])('graded A[0][0] = %s keeps the O(1) block exact', (B) => {
    const A = base.map((r) => r.slice());
    A[0][0] = B;
    expect(absErr(A, (i, j) => (i === 0 && j === 0 ? B : 1))).toBeLessThan(1e-14);
  });

  it.each([1e150, 1e300])('graded A[3][3] = %s is finite and normwise accurate', (B) => {
    const A = base.map((r) => r.slice());
    A[3][3] = B;
    expect(absErr(A, () => B)).toBeLessThan(1e-14);
  });

  it.each([1e-20, 1e-100, 1e-300])(
    'a tail of size %s next to a unit entry is reduced, not dropped',
    (t) => {
      const A = base.map((r, i) => r.map((x, j) => (i === 0 && j === 0 ? 1 : x * t)));
      expect(absErr(A, (i, j) => (i === 0 && j === 0 ? 1 : t))).toBeLessThan(1e-14);
    }
  );

  it('reduces [[1e10,1,1,1],[1e-10,1,1,1],...] to a valid form', () => {
    const A = [
      [1e10, 1, 1, 1],
      [1e-10, 1, 1, 1],
      [1e-10, 1, 1, 1],
      [1e-10, 1, 1, 1],
    ];
    expect(absErr(A, () => 1e10)).toBeLessThan(1e-14);
  });
});
