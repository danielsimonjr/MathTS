/**
 * #1007 item 3 and #1302 through the compat instance: `add`, `subtract` and `multiply` take a
 * 1-D operand and operands of different sizes, with the values of mathjs 15.2.0. The matrix
 * package takes 2-D operands only, so the shim sends every other pair to the typed function.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const math = create(all);
const A = [
  [1, 2],
  [3, 4],
];

describe('compat arithmetic with operands of different sizes (#1007, #1302)', () => {
  it('add(matrix([1,2]), 2x2) broadcasts the row (mathjs [[2,4],[4,6]])', () => {
    expect(math.add(math.matrix([1, 2]), A)).toEqual([
      [2, 4],
      [4, 6],
    ]);
    expect(math.add(math.matrix([1, 2]), math.matrix(A))).toEqual([
      [2, 4],
      [4, 6],
    ]);
    expect(math.add(math.matrix(A), math.matrix([1, 2]))).toEqual([
      [2, 4],
      [4, 6],
    ]);
  });

  it('add of a 1-D Array and a 2-D operand aligns the last axis (mathjs values)', () => {
    expect(math.add([9, 8], math.zeros([2, 1]))).toEqual([
      [9, 8],
      [9, 8],
    ]);
    expect(math.add(A, [10, 20])).toEqual([
      [11, 22],
      [13, 24],
    ]);
    expect(math.add(A, [[10], [20]])).toEqual([
      [11, 12],
      [23, 24],
    ]);
  });

  it('subtract takes the same operands', () => {
    expect(math.subtract(A, [10, 20])).toEqual([
      [-9, -18],
      [-7, -16],
    ]);
  });

  it('multiply takes a 1-D operand (mathjs [3,7] and [4,6])', () => {
    expect(math.multiply(A, [1, 1])).toEqual([3, 7]);
    expect(math.multiply([1, 1], A)).toEqual([4, 6]);
  });

  it('a pair of 2-D operands of one size still uses the matrix package', () => {
    expect(math.add(A, A)).toEqual([
      [2, 4],
      [6, 8],
    ]);
    expect(math.multiply(A, A)).toEqual([
      [7, 10],
      [15, 22],
    ]);
    expect(math.multiply([[1, 2, 3]], [[1], [2], [3]])).toEqual([[14]]);
  });
});

describe('compat 1-D matrix results have the mathjs shape (#1007)', () => {
  const plain = (x: unknown): unknown =>
    typeof (x as { toArray?: unknown })?.toArray === 'function'
      ? (x as { toArray(): unknown }).toArray()
      : x;
  it('subtract(matrix([3, 4]), 1) is [2, 3], not [[2, 3]]', () => {
    expect(plain(math.subtract(math.matrix([3, 4]), 1))).toEqual([2, 3]);
  });
  it('a 1-D matrix times a column is [-9], not [[-9]]', () => {
    expect(plain(math.multiply(math.matrix([1, 3, 4]), math.matrix([[-1], [0], [-2]])))).toEqual([
      -9,
    ]);
  });
  it('the product of two 1-D matrices is the scalar product -16', () => {
    expect(math.multiply(math.matrix([-3, 4, 4]), math.matrix([0, -4, 0]))).toBe(-16);
  });
  it('evaluate takes a 1-D operand with a 2-D operand', () => {
    expect(plain(math.evaluate('[1,2] + [[1,2],[3,4]]'))).toEqual([
      [2, 4],
      [4, 6],
    ]);
    expect(plain(math.evaluate('[[1,2],[3,4]] * [1,1]'))).toEqual([3, 7]);
  });
});
