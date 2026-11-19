/**
 * Dogfood #1251 — qr of a one dimensional input.
 *
 * A non-empty vector is not a matrix, so qr throws
 * RangeError('Matrix must be two dimensional (size: ...)'), as lup does.
 * The empty vector `[]` keeps its #1205 result.
 */

import { describe, it, expect } from 'vitest';
import { qr as qrFn, matrix, bignumber, complex } from '../src/factories/index.js';

const qr = qrFn as (x: unknown) => { Q: unknown; R: unknown };

describe('#1251 qr rejects a one dimensional input', () => {
  it.each([
    ['[1, 2]', () => [1, 2], '[2]'],
    ['matrix([1, 2])', () => matrix([1, 2]), '[2]'],
    ['3-D BigNumber', () => [[[bignumber(1)], [bignumber(2)]]], '[1, 2, 1]'],
    ['3-D Complex', () => [[[complex(1, 1)], [complex(2, 0)]]], '[1, 2, 1]'],
  ])('%s throws RangeError', (_name, make, size) => {
    expect(() => qr(make())).toThrow(RangeError);
    expect(() => qr(make())).toThrow('Matrix must be two dimensional (size: ' + size + ')');
  });

  it('the empty vector keeps the #1205 result', () => {
    expect(qr([])).toEqual({ Q: [], R: [] });
    const r = qr(matrix([])) as { Q: { size(): number[] }; R: { size(): number[] } };
    expect(r.Q.size()).toEqual([0, 0]);
    expect(r.R.size()).toEqual([0]);
  });
});
