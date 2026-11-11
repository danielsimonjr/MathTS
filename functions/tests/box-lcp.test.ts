/**
 * solveBoxLcp (issue 379): projected Gauss-Seidel for the box LCP
 * w = A x - b, lo <= x <= hi, with complementarity, friction coupling,
 * warm start and over-relaxation. The zero-allocation check is in
 * tools/test/kernels-alloc.test.mjs.
 */
import { describe, expect, it } from 'vitest';
import * as F from '../src/index.js';

type Arr = number[];
interface Result {
  iterations: number;
  residual: number;
  converged: boolean;
}
const solve = (F as unknown as Record<string, (...args: unknown[]) => Result>).solveBoxLcp!;
const INF = Number.POSITIVE_INFINITY;

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0x379);
const u = (lo = -1, hi = 1): number => lo + (hi - lo) * rng();

/** Row-major SPD A = B Bᵀ + n I with entries of B in [-1, 1]. */
function randomSpd(n: number): Arr {
  const B = Array.from({ length: n * n }, () => u());
  const A: Arr = new Array<number>(n * n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += B[i * n + k]! * B[j * n + k]!;
      A[i * n + j] = s + (i === j ? n : 0);
    }
  return A;
}

function asRows(x: unknown): unknown[][] {
  if (Array.isArray(x)) return x as unknown[][];
  if (x && typeof x === 'object' && 'valueOf' in x)
    return (x as { valueOf(): unknown[][] }).valueOf();
  throw new Error('not a matrix');
}

function residualW(A: Arr, b: Arr, x: ArrayLike<number>): Arr {
  const n = b.length;
  const w: Arr = [];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += A[i * n + j]! * x[j]!;
    w.push(s - b[i]!);
  }
  return w;
}

function expectComplementary(w: Arr, x: Arr, lo: Arr, hi: Arr, tol = 1e-8): void {
  for (let i = 0; i < x.length; i++) {
    expect(x[i]!).toBeGreaterThanOrEqual(lo[i]! - 1e-12);
    expect(x[i]!).toBeLessThanOrEqual(hi[i]! + 1e-12);
    if (x[i] === lo[i]) expect(w[i]!).toBeGreaterThanOrEqual(-tol);
    else if (x[i] === hi[i]) expect(w[i]!).toBeLessThanOrEqual(tol);
    else expect(Math.abs(w[i]!)).toBeLessThanOrEqual(tol);
  }
}

describe('solveBoxLcp', () => {
  it('unconstrained problems equal lusolve', () => {
    for (let k = 0; k < 300; k++) {
      const n = 1 + (k % 8);
      const A = randomSpd(n);
      const b = Array.from({ length: n }, () => u(-5, 5));
      const x: Arr = new Array<number>(n).fill(0);
      const r = solve(A, b, new Array<number>(n).fill(-INF), new Array<number>(n).fill(INF), x, {
        iterations: 10_000,
        tolerance: 1e-12,
      });
      expect(r.converged).toBe(true);
      const rows = Array.from({ length: n }, (_, i) => A.slice(i * n, i * n + n));
      const ref = asRows(
        F.lusolve(
          rows,
          b.map((v) => [v])
        )
      ).map((row) => row[0] as number);
      const scale = Math.max(1, ...ref.map(Math.abs));
      for (let i = 0; i < n; i++)
        expect(Math.abs(x[i]! - ref[i]!)).toBeLessThanOrEqual(1e-9 * scale);
    }
  });

  interface Known {
    name: string;
    A: Arr;
    b: Arr;
    lo: Arr;
    hi: Arr;
    x: Arr;
    active: ('lo' | 'hi' | 'in')[];
    findex?: Arr;
  }
  const known: Known[] = [
    {
      name: 'a',
      A: [2, 1, 1, 2],
      b: [-1, 3],
      lo: [0, -INF],
      hi: [INF, INF],
      x: [0, 1.5],
      active: ['lo', 'in'],
    },
    {
      name: 'b',
      A: [2, 1, 1, 2],
      b: [5, 1],
      lo: [-INF, -INF],
      hi: [1, INF],
      x: [1, 0],
      active: ['hi', 'in'],
    },
    {
      name: 'c',
      A: [2, 1, 1, 2],
      b: [-1, 5],
      lo: [0, -INF],
      hi: [INF, 1],
      x: [0, 1],
      active: ['lo', 'hi'],
    },
    {
      name: 'd',
      A: [4, 1, 0, 1, 4, 1, 0, 1, 4],
      b: [-0.5, 4, 9.5],
      lo: [0, -INF, -INF],
      hi: [INF, INF, 2],
      x: [0, 0.5, 2],
      active: ['lo', 'in', 'hi'],
    },
  ];
  for (const c of known) {
    it(`known LCP (${c.name}) gives the hand-checked solution and active set`, () => {
      const x: Arr = new Array<number>(c.b.length).fill(0);
      const r = solve(c.A, c.b, c.lo, c.hi, x, { iterations: 1000, tolerance: 1e-14 });
      for (let i = 0; i < x.length; i++)
        expect(Math.abs(x[i]! - c.x[i]!)).toBeLessThanOrEqual(1e-12);
      c.active.forEach((a, i) => {
        if (a === 'lo') expect(x[i]).toBe(c.lo[i]);
        if (a === 'hi') expect(x[i]).toBe(c.hi[i]);
      });
      expect(r.residual).toBeLessThanOrEqual(1e-12);
      expect(r.converged).toBe(true);
    });
  }

  it('known LCP (e): friction coupling with A = I', () => {
    const x: Arr = [0, 0, 0];
    const r = solve(
      [1, 0, 0, 0, 1, 0, 0, 0, 1],
      [2, 3, -0.5],
      [0, -0.5, -0.5],
      [INF, 0.5, 0.5],
      x,
      {
        findex: [-1, 0, 0],
        iterations: 100,
        tolerance: 1e-14,
      }
    );
    expect(x).toEqual([2, 1, -0.5]);
    expect(r.converged).toBe(true);
    expect(r.residual).toBeLessThanOrEqual(1e-12);
  });

  it('known LCP (f): a row without a positive diagonal is skipped but clamped, and shows in the residual', () => {
    const x: Arr = [0, 7];
    const r = solve([1, 0, 0, 0], [2, 5], [-INF, -INF], [INF, INF], x, {
      iterations: 100,
      tolerance: 1e-14,
    });
    expect(x).toEqual([2, 7]);
    expect(r.iterations).toBe(2);
    expect(r.converged).toBe(true);
    expect(r.residual).toBe(5);
    const y: Arr = [0, 7];
    const r2 = solve([1, 0, 0, 0], [2, 5], [-INF, -INF], [INF, 3], y, {
      iterations: 100,
      tolerance: 1e-14,
    });
    expect(y).toEqual([2, 3]);
    expect(r2.residual).toBe(0);
  });

  it('known LCP (g): a negative warm start of the normal in PhysJS order', () => {
    const x: Arr = [0, -3];
    const r = solve([1, 0, 0, 1], [3, -1], [-0.5, 0], [0.5, INF], x, {
      findex: [1, -1],
      iterations: 100,
      tolerance: 1e-14,
    });
    expect(Math.abs(x[0]!)).toBe(0);
    expect(x[1]).toBe(0);
    expect(r.iterations).toBe(3);
    expect(r.converged).toBe(true);
    expect(r.residual).toBe(0);
  });

  it('random boxed problems satisfy complementarity', () => {
    for (let k = 0; k < 500; k++) {
      const n = 1 + (k % 6);
      const A = randomSpd(n);
      const b = Array.from({ length: n }, () => u(-5, 5));
      const lo = Array.from({ length: n }, () => u(-2, 0));
      const hi = lo.map((l) => l + u(0.1, 3));
      const x: Arr = new Array<number>(n).fill(0);
      const r = solve(A, b, lo, hi, x, { iterations: 20_000, tolerance: 1e-13 });
      expect(r.converged).toBe(true);
      expectComplementary(residualW(A, b, x), x, lo, hi);
    }
  });

  it('friction rows stay in the cone, in either row order', () => {
    for (let k = 0; k < 500; k++) {
      const mu = u(0.1, 1);
      const A = randomSpd(3);
      const b = [u(-1, 4), u(-3, 3), u(-3, 3)];
      for (const order of ['normal-first', 'physjs'] as const) {
        // normal-first: rows [n, t1, t2]; physjs: rows [t1, t2, n].
        const perm = order === 'normal-first' ? [0, 1, 2] : [1, 2, 0];
        const nIdx = perm.indexOf(0);
        const Ap: Arr = new Array<number>(9).fill(0);
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) Ap[i * 3 + j] = A[perm[i]! * 3 + perm[j]!]!;
        const bp = perm.map((p) => b[p]!);
        const lo = perm.map((p) => (p === 0 ? 0 : -mu));
        const hi = perm.map((p) => (p === 0 ? INF : mu));
        const findex = perm.map((p) => (p === 0 ? -1 : nIdx));
        const x: Arr = [0, 0, 0];
        const r = solve(Ap, bp, lo, hi, x, { findex, iterations: 20_000, tolerance: 1e-13 });
        expect(r.converged).toBe(true);
        const xn = x[nIdx]!;
        expect(xn).toBeGreaterThanOrEqual(0);
        const w = residualW(Ap, bp, x);
        const loS = perm.map((p) => (p === 0 ? 0 : -mu * xn));
        const hiS = perm.map((p) => (p === 0 ? INF : mu * xn));
        for (let i = 0; i < 3; i++)
          if (i !== nIdx) expect(Math.abs(x[i]!)).toBeLessThanOrEqual(mu * xn + 1e-12);
        const near = (a: number, c: number): boolean => Math.abs(a - c) <= 1e-10;
        for (let i = 0; i < 3; i++) {
          // A zero-width box (x_n = 0 collapses a tangent to [0, 0]) fixes x_i; w may take any sign.
          if (near(loS[i]!, hiS[i]!)) continue;
          if (near(x[i]!, loS[i]!)) expect(w[i]!).toBeGreaterThanOrEqual(-1e-8);
          else if (near(x[i]!, hiS[i]!)) expect(w[i]!).toBeLessThanOrEqual(1e-8);
          else expect(Math.abs(w[i]!)).toBeLessThanOrEqual(1e-8);
        }
      }
    }
  });

  it('a warm start at the solution takes one sweep', () => {
    const A = [4, 1, 0.5, 1, 3, 0.2, 0.5, 0.2, 2];
    const b = [1, -2, 3];
    const lo = [-INF, 0, -INF];
    const hi = [INF, INF, 1];
    const x: Arr = [0, 0, 0];
    const cold = solve(A, b, lo, hi, x, { iterations: 1000, tolerance: 1e-14 });
    expect(cold.iterations).toBeGreaterThanOrEqual(2);
    expect(cold.converged).toBe(true);
    const warm = solve(A, b, lo, hi, x, { iterations: 1000, tolerance: 1e-14 });
    expect(warm.iterations).toBe(1);
    expect(warm.converged).toBe(true);
  });

  it('over-relaxation converges to the same solution; sor outside (0, 2) throws', () => {
    const A = randomSpd(5);
    const b = Array.from({ length: 5 }, () => u(-3, 3));
    const lo = new Array<number>(5).fill(-1);
    const hi = new Array<number>(5).fill(1);
    const x1: Arr = new Array<number>(5).fill(0);
    const x2: Arr = new Array<number>(5).fill(0);
    solve(A, b, lo, hi, x1, { iterations: 20_000, tolerance: 1e-14 });
    const r = solve(A, b, lo, hi, x2, { iterations: 20_000, tolerance: 1e-14, sor: 1.3 });
    expect(r.converged).toBe(true);
    for (let i = 0; i < 5; i++) expect(Math.abs(x1[i]! - x2[i]!)).toBeLessThanOrEqual(1e-9);
    for (const sor of [0, 2, Number.NaN, -1]) {
      expect(() => solve(A, b, lo, hi, new Array<number>(5).fill(0), { sor })).toThrow(RangeError);
    }
  });

  it('Float64Array and number[] give the same bits', () => {
    for (let k = 0; k < 50; k++) {
      const n = 4;
      const A = randomSpd(n);
      const b = Array.from({ length: n }, () => u(-3, 3));
      const lo = [0, -1, -INF, -2];
      const hi = [INF, 1, INF, 0.5];
      const x1: Arr = new Array<number>(n).fill(0);
      solve(A, b, lo, hi, x1, { iterations: 500 });
      const x2 = new Float64Array(n);
      solve(
        Float64Array.from(A),
        Float64Array.from(b),
        Float64Array.from(lo),
        Float64Array.from(hi),
        x2,
        { iterations: 500 }
      );
      for (let i = 0; i < n; i++) expect(Object.is(x1[i], x2[i])).toBe(true);
    }
  });

  it('validates its inputs with RangeError', () => {
    const A = [2, 1, 1, 2];
    const ok = (): [Arr, Arr, Arr, Arr, Arr] => [A, [1, 1], [-INF, -INF], [INF, INF], [0, 0]];
    const bad: [string, () => unknown][] = [
      ['n not integer', () => solve(...ok(), { n: 1.5 })],
      ['n negative', () => solve(...ok(), { n: -1 })],
      ['A too short', () => solve([2, 1, 1], [1, 1], [-INF, -INF], [INF, INF], [0, 0])],
      ['b too short', () => solve(A, [1], [-INF, -INF], [INF, INF], [0, 0], { n: 2 })],
      ['lo too short', () => solve(A, [1, 1], [-INF], [INF, INF], [0, 0])],
      ['hi too short', () => solve(A, [1, 1], [-INF, -INF], [INF], [0, 0])],
      ['x too short', () => solve(A, [1, 1], [-INF, -INF], [INF, INF], [0])],
      ['iterations not integer', () => solve(...ok(), { iterations: 2.5 })],
      ['iterations negative', () => solve(...ok(), { iterations: -1 })],
      ['tolerance negative', () => solve(...ok(), { tolerance: -1 })],
      ['tolerance NaN', () => solve(...ok(), { tolerance: Number.NaN })],
      ['lo > hi', () => solve(A, [1, 1], [1, -INF], [0, INF], [0, 0])],
      ['findex too short', () => solve(...ok(), { findex: [-1] })],
      ['findex out of range', () => solve(...ok(), { findex: [-1, 2] })],
      ['findex below -1', () => solve(...ok(), { findex: [-2, -1] })],
      ['findex self', () => solve(...ok(), { findex: [-1, 1] })],
      ['findex not integer', () => solve(...ok(), { findex: [-1, 0.5] })],
      [
        'coupled row with infinite lo',
        () => solve(A, [1, 1], [0, -INF], [INF, 1], [0, 0], { findex: [-1, 0] }),
      ],
    ];
    for (const [name, f] of bad) expect(f, name).toThrow(RangeError);
  });

  it('handles n = 0, iterations = 0 and NaN input without throwing', () => {
    const r0 = solve([], [], [], [], []);
    expect(r0).toEqual({ iterations: 0, residual: 0, converged: true });
    const x: Arr = [5, 0];
    const r1 = solve([2, 1, 1, 2], [1, 1], [-INF, -INF], [INF, INF], x, { iterations: 0 });
    expect(r1.converged).toBe(false);
    expect(r1.iterations).toBe(0);
    expect(x).toEqual([5, 0]);
    expect(r1.residual).toBeGreaterThan(0);
    const y: Arr = [0, 0];
    const r2 = solve([2, 1, 1, 2], [Number.NaN, 1], [-INF, -INF], [INF, INF], y, { iterations: 7 });
    expect(r2.converged).toBe(false);
    expect(r2.iterations).toBe(7);
    expect(Number.isNaN(r2.residual)).toBe(true);
  });

  it('one sweep is Gauss-Seidel, sor scales the step, and the residual is of the final x', () => {
    const A = [2, 1, 1, 2];
    const b = [1, 1];
    const lo = [-INF, -INF];
    const hi = [INF, INF];
    const x: Arr = [0, 0];
    const r = solve(A, b, lo, hi, x, { iterations: 1, tolerance: 0 });
    expect(x).toEqual([0.5, 0.25]);
    expect(r.iterations).toBe(1);
    expect(r.converged).toBe(false);
    expect(r.residual).toBeCloseTo(0.25, 14);
    const y: Arr = [0, 0];
    solve(A, b, lo, hi, y, { iterations: 1, tolerance: 0, sor: 1.5 });
    expect(y).toEqual([0.75, 0.1875]);
  });

  it('a negative coupled value swaps the scaled bounds of an asymmetric box', () => {
    const x: Arr = [0, 0];
    const r = solve([1, 0, 0, 1], [-2, 5], [-INF, -0.2], [INF, 0.5], x, {
      findex: [-1, 0],
      tolerance: 0,
    });
    expect(x).toEqual([-2, 0.4]);
    expect(r.residual).toBe(0);
    expect(r.converged).toBe(true);
  });

  it('tolerance 0 is valid and stops at an exact fixed point', () => {
    const r = solve([1, 0, 0, 1], [2, 3], [-INF, -INF], [INF, INF], [0, 0], { tolerance: 0 });
    expect(r.converged).toBe(true);
    expect(r.iterations).toBe(2);
  });

  it('negative and NaN diagonals make no step', () => {
    for (const d of [-1, Number.NaN]) {
      const x: Arr = [0, 5];
      const r = solve([1, 0, 0, d], [1, 1], [-INF, -INF], [INF, INF], x, {});
      expect(x).toEqual([1, 5]);
      expect(r.converged).toBe(true);
    }
  });

  it('options.n solves the leading n x n block only', () => {
    const x: Arr = [0, 0, 9];
    const r = solve([2, 1, 1, 2, 9, 9, 9, 9], [1, 1, 7], [-INF, -INF, -INF], [INF, INF, INF], x, {
      n: 2,
      tolerance: 1e-14,
    });
    expect(r.converged).toBe(true);
    expect(Math.abs(x[0]! - 1 / 3)).toBeLessThan(1e-12);
    expect(x[2]).toBe(9);
  });

  it('writes into a passed result object and returns it', () => {
    const result: Result = { iterations: -1, residual: -1, converged: false };
    const r = solve([2, 1, 1, 2], [1, 1], [-INF, -INF], [INF, INF], [0, 0], {
      result,
      iterations: 500,
    });
    expect(r).toBe(result);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.residual).toBeGreaterThanOrEqual(0);
    expect(result.converged).toBe(true);
  });
});
