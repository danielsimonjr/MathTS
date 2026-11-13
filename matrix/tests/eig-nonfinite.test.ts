import { describe, it, expect } from 'vitest';
// eig and eigvals reject NaN and Infinity input with a RangeError, as lstsq does.
import { eig, eigvals, eigWasm, eigvalsWasm } from '../src/index.js';

const BAD: Array<[string, number[][]]> = [
  [
    'NaN 2x2',
    [
      [1, NaN],
      [0, 1],
    ],
  ],
  [
    'Infinity 2x2',
    [
      [1, 2],
      [Infinity, 1],
    ],
  ],
  [
    '-Infinity 3x3',
    [
      [1, 0, 0],
      [0, -Infinity, 0],
      [0, 0, 1],
    ],
  ],
  ['NaN 1x1', [[NaN]]],
];

describe('eig rejects non-finite input', () => {
  for (const [label, M] of BAD) {
    it(`eig throws RangeError on ${label}`, () => {
      expect(() => eig(M)).toThrow(RangeError);
      expect(() => eig(M)).toThrow('eig: matrix has a non-finite entry');
    });
    it(`eigvals throws RangeError on ${label}`, () => {
      expect(() => eigvals(M)).toThrow(RangeError);
    });
    it(`eigWasm and eigvalsWasm reject ${label}`, async () => {
      await expect(eigWasm(M)).rejects.toThrow(RangeError);
      await expect(eigvalsWasm(M)).rejects.toThrow(RangeError);
    });
  }

  it('still solves a finite matrix', () => {
    expect(
      eigvals([
        [2, 0],
        [0, 3],
      ])
        .map((v) => v.re)
        .sort()
    ).toEqual([2, 3]);
  });
});
