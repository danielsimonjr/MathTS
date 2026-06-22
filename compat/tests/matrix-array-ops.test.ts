/**
 * mathjs-compat: multiply/add/subtract must accept 2-D number arrays, the way
 * mathjs does. Regression test for the compat dispatch gap where these three
 * ops were bound to the scalar-only functions-package versions and threw
 * "Unexpected type of argument" on number[][] input.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const math = create(all);

describe('compat matrix array dispatch', () => {
  const A = [
    [1, 2],
    [3, 4],
  ];
  const B = [
    [5, 6],
    [7, 8],
  ];

  it('multiply: matrix * matrix (matmul)', () => {
    expect(math.multiply(A, B)).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  it('add: matrix + matrix (element-wise)', () => {
    expect(math.add(A, B)).toEqual([
      [6, 8],
      [10, 12],
    ]);
  });

  it('subtract: matrix - matrix (element-wise)', () => {
    expect(math.subtract(A, B)).toEqual([
      [-4, -4],
      [-4, -4],
    ]);
  });

  it('multiply: matrix * scalar (scale)', () => {
    expect(math.multiply(A, 2)).toEqual([
      [2, 4],
      [6, 8],
    ]);
  });

  it('multiply: scalar * matrix (scale)', () => {
    expect(math.multiply(3, A)).toEqual([
      [3, 6],
      [9, 12],
    ]);
  });

  it('scalar arithmetic still works (no regression)', () => {
    expect(math.multiply(6, 7)).toBe(42);
    expect(math.add(2, 3)).toBe(5);
    expect(math.subtract(10, 4)).toBe(6);
  });
});
