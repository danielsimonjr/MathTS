import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import {
  compatMathjsLyap,
  compatMathjsSchur,
  compatMathjsSolveODE,
  compatMathjsSylvester,
} from '../../src/mathjs-parity-g05.js';

/**
 * Branch coverage for G05 compat adapters (oracle rows live in g05-* and
 * challenger-g05). These are direct unit tests on exported adapters.
 */

const instance = createCompat(compatAll, {});

describe('G05 compatMathjsSchur branches', () => {
  it('rejects missing and excess arguments', () => {
    expect(() => compatMathjsSchur()).toThrow(/Too few arguments/);
    expect(() => compatMathjsSchur([[1, 2]], [[3, 4]])).toThrow(/Too many arguments/);
    expect(() => compatMathjsSchur(5)).toThrow(/Unexpected type/);
  });

  it('rejects sparse inputs', () => {
    const s = instance.sparse([
      [1, 0],
      [0, 2],
    ]);
    expect(() => compatMathjsSchur(s)).toThrow(/sparse matrices/);
  });

  it('runs the QR iteration on complex data and a mathjs DenseMatrix', () => {
    const c = instance.complex;
    const { T } = compatMathjsSchur([
      [c(1, 1), c(2, 0)],
      [c(0, 0), c(3, -1)],
    ]) as { T: unknown[] };
    expect(T.length).toBe(2);

    const M = instance.matrix([
      [1, 2],
      [3, 4],
    ]);
    const wrapped = compatMathjsSchur(M) as { U: unknown; T: unknown };
    expect(wrapped.U).toBeDefined();
    expect(wrapped.T).toBeDefined();
  });

  it('accepts a native DenseMatrix and returns raw arrays', () => {
    const native = new DenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const out = compatMathjsSchur(native) as { U: unknown[][]; T: unknown[][] };
    expect(Array.isArray(out.U)).toBe(true);
    expect(Array.isArray(out.T)).toBe(true);
    expect(out.T[0][0]).toBeCloseTo(5.37228132326901, 10);
  });
});

describe('G05 compatMathjsSylvester / lyap native delegation', () => {
  it('delegates when a native DenseMatrix appears', () => {
    const native = new DenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const out = compatMathjsSylvester(native, native, native) as unknown;
    expect(out).toBeDefined();
    const ly = compatMathjsLyap(native, native) as unknown;
    expect(ly).toBeDefined();
  });
});

describe('G05 compatMathjsSolveODE branches', () => {
  const f = (_t: unknown, y: unknown) => y;
  const y0 = [1];

  it('validates tspan and options', () => {
    expect(() => compatMathjsSolveODE(f, [0], y0, {})).toThrow(/tspan/);
    expect(() => compatMathjsSolveODE(f, [0, 1], y0, { firstStep: -1 })).toThrow(/firstStep/);
    expect(() => compatMathjsSolveODE(f, [0, 1], y0, { maxStep: 0 })).toThrow(/maxStep/);
    expect(() => compatMathjsSolveODE(f, [0, 1], y0, { minStep: -1 })).toThrow(/minStep/);
    expect(() => compatMathjsSolveODE(f, [0, 1], y0, { method: 'BOGUS' })).toThrow(
      /Unavailable method/
    );
  });

  it('runs RK23, scalar y0, matrix tspan, and reverse integration', () => {
    const rk23 = compatMathjsSolveODE(f, [0, 1], y0, { method: 'RK23' }) as {
      t: number[];
      y: number[][];
    };
    expect(rk23.t.length).toBeGreaterThan(1);

    const scalarY = compatMathjsSolveODE(f, [0, 1], 1) as { t: unknown[]; y: unknown[] };
    expect(scalarY.y.length).toBeGreaterThan(0);

    const T = instance.matrix([0, 1]);
    const Y = instance.matrix([1]);
    const mat = compatMathjsSolveODE(f, T, Y, {}) as { t: unknown; y: unknown };
    expect(mat.t).toBeDefined();
    expect(mat.y).toBeDefined();

    const back = compatMathjsSolveODE(f, [1, 0], y0, {}) as { t: number[] };
    expect(back.t[0]).toBe(1);
    expect(back.t[back.t.length - 1]).toBe(0);
  });

  it('integrates in BigNumber mode', () => {
    const L = createCompat(compatAll, { number: 'BigNumber' });
    const sol = L.solveODE(f, [L.bignumber(0), L.bignumber(1)], [L.bignumber(1)]) as {
      t: unknown[];
    };
    expect(sol.t.length).toBeGreaterThan(1);
  });
});
