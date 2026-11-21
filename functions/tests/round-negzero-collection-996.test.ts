/**
 * #996: a collection keeps a zero element as it is, as in mathjs 15.2.0.
 *
 * mathjs maps `round` over an Array or a Matrix with `deepMap(x, self, true)`, which copies a zero
 * element and does not call the scalar function on it. So `round(-0)` is 0, and `round([-0])` is
 * `[-0]`. Before #996 the typed `round` used `Math.round`, and `round([-0])` was `[-0]` too. The
 * expected values are the live mathjs results.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const round = math.round as unknown as Fn;
const matrix = math.matrix as unknown as (d: unknown) => { toArray(): unknown };
const mj = mathjs as unknown as Record<string, Fn>;

function signs(list: unknown): string[] {
  return (list as number[]).map((x) => (Object.is(x, -0) ? '-0' : String(x)));
}

describe('round keeps a zero element of a collection (#996)', () => {
  const input = [-0, 0, -0.4, -2.5, 1.5, 2.675, NaN, -1e-300];

  it('an Array', () => {
    expect(signs(round(input))).toEqual(signs(mj.round(input)));
    expect(signs(round([-0]))).toEqual(['-0']);
  });

  it('a Matrix', () => {
    const got = (round(matrix(input)) as { toArray(): unknown }).toArray();
    const want = (mj.round(mj.matrix(input)) as unknown as { toArray(): unknown }).toArray();
    expect(signs(got)).toEqual(signs(want));
  });

  it('a Float64Array takes the scalar rule for each element (mathjs has no such form)', () => {
    const got = Array.from(round(new Float64Array(input)) as Float64Array);
    expect(signs(got)).toEqual(signs(input.map((x) => mj.round(x))));
  });

  it('the scalar -0 still gives 0, as in mathjs', () => {
    expect(Object.is(round(-0), 0)).toBe(true);
    expect(Object.is(mj.round(-0), 0)).toBe(true);
  });
});
