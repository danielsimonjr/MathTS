/**
 * Dogfood #1217 — qr of an input with more than two dimensions.
 *
 * qr factors a two dimensional matrix. An input with three or more
 * dimensions throws RangeError('Matrix must be two dimensional (size: ...)'),
 * as lup does. This holds when a dimension is empty, so `[[[]]]` (size
 * [1, 1, 0]) does not pass as a 1 x 0 matrix. Two dimensional empty inputs
 * keep their #1205 result.
 */

import { describe, it, expect } from 'vitest';
import { qr as qrFn, matrix, zeros } from '../src/factories/index.js';

const qr = qrFn as (x: unknown) => { Q: unknown; R: unknown };

describe('#1217 qr rejects an input with more than two dimensions', () => {
  it.each([
    ['[[[]]]', () => [[[]]], '[1, 1, 0]'],
    ['[[[]],[[]]]', () => [[[]], [[]]], '[2, 1, 0]'],
    ['matrix([[[]]])', () => matrix([[[]]]), '[1, 1, 0]'],
    [
      '3-D Array of numbers',
      () => [
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ],
      ],
      '[2, 2, 2]',
    ],
    [
      '3-D DenseMatrix of numbers',
      () =>
        matrix([
          [
            [1, 2],
            [3, 4],
          ],
          [
            [5, 6],
            [7, 8],
          ],
        ]),
      '[2, 2, 2]',
    ],
  ])('%s throws RangeError', (_name, make, size) => {
    expect(() => qr(make())).toThrow(RangeError);
    expect(() => qr(make())).toThrow('Matrix must be two dimensional (size: ' + size + ')');
  });

  it('two dimensional empty inputs keep the #1205 result', () => {
    expect(qr([])).toEqual({ Q: [], R: [] });
    expect(qr([[]])).toEqual({ Q: [[1]], R: [[]] });
    const r = qr(zeros(3, 0)) as { Q: { size(): number[] }; R: { size(): number[] } };
    expect(r.Q.size()).toEqual([3, 3]);
    expect(r.R.size()).toEqual([3, 0]);
    const s = qr(zeros(0, 3)) as { Q: { size(): number[] }; R: { size(): number[] } };
    expect(s.Q.size()).toEqual([0, 0]);
    expect(s.R.size()).toEqual([0, 3]);
  });
});
