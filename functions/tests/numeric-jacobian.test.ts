import { describe, it, expect } from 'vitest';
import { numericJacobian, jacobian } from '../src/index.js';

describe('numericJacobian (F: R^n -> R^m, central differences)', () => {
  it('J of [x^2+y, x*y] at (1,2) = [[2,1],[2,1]]', () => {
    const J = numericJacobian((v) => [v[0] ** 2 + v[1], v[0] * v[1]], [1, 2]);
    expect(J[0][0]).toBeCloseTo(2, 6);
    expect(J[0][1]).toBeCloseTo(1, 6);
    expect(J[1][0]).toBeCloseTo(2, 6);
    expect(J[1][1]).toBeCloseTo(1, 6);
  });
  it('forward scheme with fixed h matches (f(x+h)−f(x))/h', () => {
    const h = 1e-7;
    const x0 = 1;
    const f = (v: number[]) => [v[0] ** 2];
    const f0 = f([x0])[0];
    const fPlus = f([x0 + h])[0];
    const expected = (fPlus - f0) / h;
    const J = numericJacobian(f, [x0], { h, scheme: 'forward' });
    expect(J[0][0]).toBe(expected);
    const Jcentral = numericJacobian(f, [x0], { h });
    expect(Jcentral[0][0]).toBeCloseTo(2, 9);
    expect(J[0][0]).not.toBe(Jcentral[0][0]);
  });

  it('non-square: F: R^3 -> R^2', () => {
    const J = numericJacobian((v) => [v[0] + v[1] + v[2], v[0] * v[2]], [1, 2, 3]);
    expect(J.length).toBe(2);
    expect(J[0]).toHaveLength(3);
    expect(J[1][0]).toBeCloseTo(3, 6);
    expect(J[1][2]).toBeCloseTo(1, 6);
  });
  it('polymorphic jacobian(f, x0) dispatches to numeric', () => {
    const J = jacobian((v: number[]) => [v[0] ** 2, v[1] ** 2], [3, 4]) as number[][];
    expect(J[0][0]).toBeCloseTo(6, 6);
    expect(J[1][1]).toBeCloseTo(8, 6);
  });
  it('symbolic jacobian still works (does not throw, returns a result)', () => {
    const r = jacobian(['x^2', 'x*y'], ['x', 'y'], { x: 2, y: 3 });
    expect(r).toBeTruthy();
  });

  it('linear map Ax — central default at (1,2) equals A', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const f = (v: number[]) => [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
    const J = numericJacobian(f, [1, 2]);
    expect(J[0][0]).toBeCloseTo(1, 8);
    expect(J[0][1]).toBeCloseTo(2, 8);
    expect(J[1][0]).toBeCloseTo(3, 8);
    expect(J[1][1]).toBeCloseTo(4, 8);
  });

  it('linear map — forward with fixed h equals A', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const f = (v: number[]) => [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
    const J = numericJacobian(f, [1, 2], { h: 1e-7, scheme: 'forward' });
    expect(J[0][0]).toBeCloseTo(1, 6);
    expect(J[0][1]).toBeCloseTo(2, 6);
    expect(J[1][0]).toBeCloseTo(3, 6);
    expect(J[1][1]).toBeCloseTo(4, 6);
  });

  it('linear map — forward step rule uses floor on x_j=0 and rel*|x| otherwise', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const x0 = [0, 3];
    const seen: number[][] = [];
    const f = (v: number[]) => {
      seen.push(v.slice());
      return [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
    };
    const J = numericJacobian(f, x0, { scheme: 'forward', step: { rel: 1e-7, floor: 1e-8 } });
    // Base eval (default, no f0) then one eval per column.
    // Same formula as the retired ODE/DAE loops: max(floor, rel*|x_j|).
    const h0 = Math.max(1e-8, 1e-7 * Math.abs(x0[0]));
    const h1 = Math.max(1e-8, 1e-7 * Math.abs(x0[1]));
    expect(h0).toBe(1e-8);
    expect(h1).toBe(1e-7 * 3);
    expect(seen).toHaveLength(3);
    expect(seen[0]).toEqual(x0);
    expect(seen[1][0]).toBe(x0[0] + h0);
    expect(seen[1][1]).toBe(x0[1]);
    expect(seen[2][0]).toBe(x0[0]);
    expect(seen[2][1]).toBe(x0[1] + h1);
    expect(J[0][0]).toBeCloseTo(1, 6);
    expect(J[0][1]).toBeCloseTo(2, 6);
    expect(J[1][0]).toBeCloseTo(3, 6);
    expect(J[1][1]).toBeCloseTo(4, 6);
  });

  it('absolute h wins over step', () => {
    const seen: number[][] = [];
    const f = (v: number[]) => {
      seen.push(v.slice());
      return [v[0] + 2 * v[1]];
    };
    numericJacobian(f, [0, 3], {
      scheme: 'forward',
      h: 1e-3,
      step: { rel: 1e-7, floor: 1e-8 },
    });
    expect(seen).toHaveLength(3);
    expect(seen[0]).toEqual([0, 3]);
    expect(seen[1][0]).toBe(0 + 1e-3);
    expect(seen[2][1]).toBe(3 + 1e-3);
  });

  it('f0 skips the base evaluation of f at x0', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    let calls = 0;
    const f = (v: number[]) => {
      calls++;
      return [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
    };
    const x0 = [1, 2];
    const f0 = f(x0);
    const callsAfterF0 = calls;
    const J = numericJacobian(f, x0, { scheme: 'forward', h: 1e-7, f0 });
    // One eval per column (n=2), not n+1.
    expect(calls - callsAfterF0).toBe(2);
    expect(J[0][0]).toBeCloseTo(1, 6);
    expect(J[0][1]).toBeCloseTo(2, 6);
    expect(J[1][0]).toBeCloseTo(3, 6);
    expect(J[1][1]).toBeCloseTo(4, 6);
  });
});
