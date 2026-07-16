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
});
