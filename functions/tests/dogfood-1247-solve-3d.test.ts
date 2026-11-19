/**
 * Dogfood #1247 — lusolve with a 3-D Array A of numbers.
 *
 * A 3-D A is not a system of equations. Every entry type and every solver that
 * shares the nested path throws the two-dimensional RangeError (as lup does).
 */

import { describe, it, expect } from 'vitest';
import {
  lusolve as lusolveFn,
  lsolve as lsolveFn,
  usolve as usolveFn,
  lsolveAll as lsolveAllFn,
  usolveAll as usolveAllFn,
  lup as lupFn,
  matrix,
  bignumber,
  complex,
} from '../src/factories/index.js';

type Fn = (...args: unknown[]) => unknown;
const lusolve = lusolveFn as Fn;
const solvers: Record<string, Fn> = {
  lusolve,
  lsolve: lsolveFn as Fn,
  usolve: usolveFn as Fn,
  lsolveAll: lsolveAllFn as Fn,
  usolveAll: usolveAllFn as Fn,
};
const lup = lupFn as Fn;
const TWO_D = /Matrix must be two dimensional \(size: \[2, 2, 1\]\)/;

describe('#1247 a 3-D A is rejected', () => {
  const a3 = [
    [[2], [0]],
    [[0], [1]],
  ];

  it('lusolve Array A of numbers throws', () => {
    expect(() => lusolve(a3, [1, 2])).toThrow(TWO_D);
    expect(() => lusolve(a3, [[1], [2]])).toThrow(RangeError);
  });

  it('lusolve with BigNumber and Complex entries throws the same error', () => {
    expect(() =>
      lusolve(
        [
          [[bignumber(2)], [0]],
          [[0], [1]],
        ],
        [1, 2]
      )
    ).toThrow(TWO_D);
    expect(() =>
      lusolve(
        [
          [[complex(2, 1)], [0]],
          [[0], [1]],
        ],
        [1, 2]
      )
    ).toThrow(TWO_D);
  });

  it('lusolve DenseMatrix of a 3-D Array throws', () => {
    expect(() => lusolve(matrix(a3), [1, 2])).toThrow(TWO_D);
  });

  it('lusolve with a 3-D b of numbers still solves as before or throws', () => {
    expect(() =>
      lusolve(
        [
          [2, 0],
          [0, 1],
        ],
        [[[1]], [[2]]]
      )
    ).toThrow('Dimension mismatch. Matrix columns must match vector length.');
  });

  it('lusolve of a 4-D A throws the two-dimensional error', () => {
    expect(() =>
      lusolve(
        [
          [[[2]], [[0]]],
          [[[0]], [[1]]],
        ],
        [1, 2]
      )
    ).toThrow('Matrix must be two dimensional (size: [2, 2, 1, 1])');
  });

  it('lusolve of a 3-D A with empty entries throws the two-dimensional error', () => {
    expect(() => lusolve([[[]]], [1])).toThrow('Matrix must be two dimensional (size: [1, 1, 0])');
    expect(() => lusolve([[[]], [[]]], [1, 2])).toThrow(
      'Matrix must be two dimensional (size: [2, 1, 0])'
    );
  });

  it('lusolve of an A with mixed depth throws the jagged-array error', () => {
    expect(() =>
      lusolve(
        [
          [2, 0],
          [0, [1]],
        ],
        [1, 2]
      )
    ).toThrow('Matrix decomposition: jagged nested array at row 1');
  });

  it('lup throws', () => {
    expect(() => lup(a3)).toThrow(TWO_D);
  });

  for (const [name, fn] of Object.entries(solvers)) {
    it(`${name} throws for a 3-D A (Array and DenseMatrix)`, () => {
      expect(() => fn(a3, [1, 2])).toThrow(RangeError);
      expect(() => fn(matrix(a3), [1, 2])).toThrow(RangeError);
    });
    it(`${name} throws for a 3-D b`, () => {
      expect(() =>
        fn(
          [
            [2, 0],
            [0, 1],
          ],
          [[[1]], [[2]]]
        )
      ).toThrow(RangeError);
    });
  }
});
