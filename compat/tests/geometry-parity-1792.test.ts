/**
 * #1792 — `distance` and `intersect` match mathjs 15.3.0 on the compat instance.
 */
import { describe, expect, it } from 'vitest';
import { geometrySubtract } from '../src/mathjs-geometry-parity.js';
import { all, create } from '../src/index.js';

describe('geometry parity (#1792)', () => {
  const math = create(all);

  it('distance matches mathjs euclidean rounding', () => {
    expect(math.distance([1], [2])).toBe(1);
    expect(math.distance([5, 5], [5, 5])).toBe(0);
    expect(math.distance([-21, -230, -2141], [-1234, -3122, -1242])).toBe(3262.396971553278);
    expect(math.distance([1, 1], [10, 10])).toBe(12.727922061357855);
    expect(math.distance([4, 5, 8], [2, 7, 9])).toBe(3);
    expect(math.distance([-1, -1], [10, 10])).toBe(15.556349186104045);
    expect(math.distance([-100.78, 60.04], [0.3, 500.09])).toBe(451.5098768576386);
    expect(
      math.distance([
        [1, 2, 4],
        [1, 2, 6],
        [8, 1, 3],
      ])
    ).toEqual([2, 7.14142842854285, 7.681145747868608]);
    expect(
      math.distance([
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
    ).toEqual([1, 1, 1, 1.4142135623730951, 1.4142135623730951, 1.4142135623730951]);
    expect(
      math.distance({ pointX: 10, pointY: 10 }, { xCoeffLine: 8, yCoeffLine: 1, constant: 3 })
    ).toBe(11.535230316796387);
    expect(math.distance({ pointOneX: 0, pointOneY: 0 }, { pointTwoX: 10, pointTwoY: 10 })).toBe(
      14.142135623730951
    );
    expect(
      math.distance(
        { pointX: 0, pointY: 0 },
        { lineOnePtX: 3, lineOnePtY: 0 },
        { lineTwoPtX: 0, lineTwoPtY: 4 }
      )
    ).toBe(2.4);
    expect(math.distance([1, -1, -1], [2, 2, 0.1, 1, 2, 2])).toBe(1.3437096247164249);
    expect(
      math.distance([
        [0, 2],
        [-2, 0],
        [0, 2],
      ])
    ).toEqual([2.8284271247461903, 0, 2.8284271247461903]);
    expect(math.distance([10, 2, -5, 13, -6, 12, 0, 16, 8], [1, 11, 4, 4, 3, 3, -9, 7, 17])).toBe(
      27
    );
    expect(
      math.distance({ pointX: 2, pointY: 3, pointZ: 1 }, { x0: 1, y0: 1, z0: 2, a: 5, b: 0, c: 1 })
    ).toBe(2.3204774044612857);
    expect(math.distance([0, 0], math.matrix([10, 10]))).toBe(14.142135623730951);
  });

  it('distance rejects invalid argument shapes like mathjs', () => {
    expect(() => math.distance([0, 0])).toThrow(TypeError);
    expect(() => math.distance(0.5)).toThrow(TypeError);
    expect(() => math.distance([1, 3], ['abc', 'def'])).toThrow(TypeError);
    expect(() =>
      math.distance(
        { pointX: 'a', pointY: 'b', pointZ: 'c' },
        { x0: 1, y0: 1, z0: 2, a: 5, b: 0, c: 1 }
      )
    ).toThrow(TypeError);
    expect(() =>
      math.distance(
        { wrongkeyname: 1, pointY: 4 },
        { lineOnePtX: 1, lineOnePtY: 3 },
        { lineTwoPtX: 2, lineTwoPtY: 8 }
      )
    ).toThrow('Key names do not match');
    expect(() => math.distance('1')).toThrow(TypeError);
    expect(() => math.distance(['abc', 'def'], [1, 3])).toThrow(TypeError);
    expect(() => math.distance(['2', '3'], math.matrix([1, 2]), [1, 2])).toThrow(TypeError);
    expect(() => math.distance([2, 3], math.matrix(['a', 'b']), [1, 2])).toThrow(TypeError);
    expect(() => math.distance([2, 3], math.matrix([1, 2]), ['a', 'b'])).toThrow(TypeError);
    expect(() => math.distance(['a', ' b', 'c', 'd'], [1, 2, 3, 4])).toThrow(TypeError);
    expect(() => math.distance([1, 2, 3, 4], ['a', ' b', 'c', 'd'])).toThrow(TypeError);
    expect(() =>
      math.distance(
        { pointX: 'l', pointY: 4 },
        { lineOnePtX: 1, lineOnePtY: 3 },
        { lineTwoPtX: 2, lineTwoPtY: 8 }
      )
    ).toThrow(TypeError);
    expect(() =>
      math.distance(
        { pointX: 1, pointY: 4 },
        { wrongkeyname: 1, lineOnePtY: 3 },
        { lineTwoPtX: 2, lineTwoPtY: 8 }
      )
    ).toThrow('Key names do not match');
    expect(() => math.distance([0, 0], [3, 0], [3, 0])).toThrow(TypeError);
    expect(() =>
      math.distance(
        { pointX: 0, pointY: 0 },
        { lineOnePtX: 3, lineOnePtY: 0 },
        { lineTwoPtX: 3, lineTwoPtY: 0 }
      )
    ).toThrow(TypeError);
    expect(() => math.distance([1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6])).toThrow(TypeError);
    expect(() => math.distance([9, 4, 3.6])).toThrow(TypeError);
    expect(() =>
      math.distance(
        { pointX: 10, pointY: 10 },
        { xCoeffLine: 8, yCoeffLine: 1, constant: 3, extraElement: 4 }
      )
    ).toThrow(TypeError);
    expect(() =>
      math.distance([
        [1, 2, 4],
        [1, 2],
        [8, 1, 3],
      ])
    ).toThrow(TypeError);
    expect(() =>
      math.distance([
        [1, 2],
        [2, 3],
        [2, 4, 5],
      ])
    ).toThrow(TypeError);
    expect(math.distance([0.1123, -0.242], [0.1316, -0.2421, 0.122135])).toBe(0.7094821347343443);
    expect(math.distance([8, 3], [10, 0], [5, 0])).toBe(3);
    expect(
      math.distance(
        { pointOneX: 4, pointOneY: 5, pointOneZ: 8 },
        { pointTwoX: 2, pointTwoY: 7, pointTwoZ: 9 }
      )
    ).toBe(3);
  });

  it('geometrySubtract handles fraction pairs like mathjs', () => {
    const f = math.fraction;
    const a = f(7, 4);
    const b = f(1, 4);
    const diff = geometrySubtract(a, b) as ReturnType<typeof f>;
    expect(diff.toString()).toBe('1.5');
    expect(geometrySubtract([f(3, 2), f(1, 2)], [f(1, 2), f(1, 4)])).toEqual([f(1, 1), f(1, 4)]);
  });

  it('intersect accepts row and column vectors', () => {
    const rowCol = math.intersect(
      math.matrix([[0], [0]]),
      [[10, 10]],
      math.matrix([[10], [0]]),
      math.matrix([[0], [10]])
    ) as { valueOf(): unknown };
    expect(rowCol.valueOf()).toEqual([5, 5]);

    const mixed = math.intersect(
      math.matrix([0, 0]),
      math.matrix([[10, 10]]),
      math.matrix([[10], [0]]),
      math.matrix([0, 10])
    ) as { valueOf(): unknown };
    expect(mixed.valueOf()).toEqual([5, 5]);
  });

  it('intersect line and plane with non-unit coefficients', () => {
    expect(math.intersect([0, 30, 0], [0, 21, 0], [0, 9, 0, 0])).toEqual([0, 0, 0]);
    expect(
      (
        math.intersect(math.matrix([1, 0, 1]), [4, -2, 2], math.matrix([1, 1, 1, 6])) as {
          valueOf(): unknown;
        }
      ).valueOf()
    ).toEqual([7, -4, 3]);
  });

  it('intersect throws for argument count and types like mathjs', () => {
    expect(() => math.intersect([2, 0, 1], [1, 1, 6], [2, 0, 1], [1, 1, 6], [0, 8, 1])).toThrow(
      /Too many arguments/
    );
    expect(() => math.intersect([2, 8, 9], 3, 6)).toThrow(TypeError);
    expect(() => math.intersect('a', 'b', 'c', 'd')).toThrow(TypeError);
    expect(math.intersect([0, 1, 0], [0, 0, 0], [1, 1, 0], [1, 0, 0])).toBeNull();
  });

  it('intersect empty arrays use mathjs dimensional message', () => {
    expect(() => math.intersect([], [], [], [])).toThrow(
      'Arrays with two or three dimensional points expected'
    );
    expect(() => math.intersect([2, 0, 1], [1, 1, 1], [5, 1, 10])).toThrow(
      'Array with 4 numbers expected as third argument'
    );
    expect(() => math.intersect(2, 3, 6)).toThrow(
      'Unexpected type of argument in function intersect'
    );
  });

  it('intersect 2D and 3D line intersections', () => {
    expect(math.intersect([0, 0], [10, 10], [10, 0], [0, 10])).toEqual([5, 5]);
    expect(math.intersect([0, 0, 0], [10, 10, 0], [10, 0, 0], [0, 10, 0])).toEqual([5, 5, 0]);
    expect(
      (
        math.intersect(
          math.matrix([0, 0, 0]),
          math.matrix([10, 10, 0]),
          math.matrix([10, 0, 0]),
          math.matrix([0, 10, 0])
        ) as { valueOf(): unknown }
      ).valueOf()
    ).toEqual([5, 5, 0]);
    expect(math.intersect([0, 1], [0, 0], [1, 1], [1, 0])).toBeNull();
    expect(() => math.intersect([2, 0, 1], [1, 1, 6])).toThrow(/Too few arguments/);
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
