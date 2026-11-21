/**
 * #1260 through `@danielsimonjr/mathts-functions`: `qrPivoted` of a 3-D nested array.
 *
 * `qrPivoted` of `@danielsimonjr/mathts-functions` is the function of the matrix package.
 * The matrix test (`matrix/tests/dogfood-1260-decomposition-3d.test.ts`) runs every function
 * of the class; this file pins the surface that the issue names.
 */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';

const qrPivoted = math.qrPivoted as unknown as (a: unknown) => { R: unknown };

describe('#1260 qrPivoted of the functions package', () => {
  it('[[[1], [2]]] throws a RangeError that names the size', () => {
    expect(() => qrPivoted([[[1], [2]]])).toThrow(
      new RangeError('Matrix must be two dimensional (size: [1, 2, 1])')
    );
  });

  it('a row that mixes numbers and Arrays throws the jagged TypeError of the row', () => {
    expect(() =>
      qrPivoted([
        [1, 2],
        [[3], [4]],
      ])
    ).toThrow(new TypeError('Matrix decomposition: jagged nested array at row 1'));
  });

  it('a two dimensional array still factors', () => {
    expect(
      qrPivoted([
        [1, 2],
        [3, 4],
      ]).R
    ).toBeDefined();
  });
});
