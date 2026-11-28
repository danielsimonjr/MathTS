/**
 * #1792 — `distance` and `intersect` match mathjs 15.3.0 on the compat instance.
 */
import { describe, expect, it } from 'vitest';
import { all, create } from '../src/index.js';

describe('geometry parity (#1792)', () => {
  const math = create(all);

  it('distance matches mathjs euclidean rounding', () => {
    expect(math.distance([-21, -230, -2141], [-1234, -3122, -1242])).toBe(3262.396971553278);
    expect(math.distance([1, 1], [10, 10])).toBe(12.727922061357855);
    expect(
      math.distance([
        [1, 2, 4],
        [1, 2, 6],
        [8, 1, 3],
      ])
    ).toEqual([2, 7.14142842854285, 7.681145747868608]);
  });

  it('intersect accepts row and column vectors', () => {
    const rowCol = math.intersect(
      math.matrix([[0], [0]]),
      [[10, 10]],
      math.matrix([[10], [0]]),
      math.matrix([[0], [10]])
    );
    expect(rowCol.valueOf()).toEqual([5, 5]);

    const mixed = math.intersect(
      math.matrix([0, 0]),
      math.matrix([[10, 10]]),
      math.matrix([[10], [0]]),
      math.matrix([0, 10])
    );
    expect(mixed.valueOf()).toEqual([5, 5]);
  });

  it('intersect line and plane with non-unit coefficients', () => {
    expect(math.intersect([0, 30, 0], [0, 21, 0], [0, 9, 0, 0])).toEqual([0, 0, 0]);
    expect(
      math.intersect(math.matrix([1, 0, 1]), [4, -2, 2], math.matrix([1, 1, 1, 6])).valueOf()
    ).toEqual([7, -4, 3]);
  });

  it('intersect empty arrays use mathjs dimensional message', () => {
    expect(() => math.intersect([], [], [], [])).toThrow(
      'Arrays with two or three dimensional points expected'
    );
  });

  it('intersect supports fraction coordinates', () => {
    const f = math.fraction;
    const result = math.intersect(
      [f(1, 1), f(0, 1), f(1, 1)],
      [f(4, 1), f(-2, 1), f(2, 1)],
      [f(1, 1), f(1, 1), f(1, 1), f(6, 1)]
    );
    expect(result).toEqual([f(7, 1), f(-4, 1), f(3, 1)]);
  });
});
