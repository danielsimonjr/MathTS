/**
 * #1092, #1273: the compat `matrix` and `sparse` of a ragged nested array.
 *
 * compat delegates to the functions bridge, so a jagged array throws the mathjs
 * `Dimension mismatch` RangeError, and a ragged sparse input keeps every entry.
 * The oracle is `mathjs` of the mathjs devDependency.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { create, all } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const math = create(all) as unknown as Record<string, Fn>;
const mj = mathjs as unknown as Record<string, Fn>;

function thrown(fn: () => unknown): Error | undefined {
  try {
    fn();
  } catch (e) {
    return e as Error;
  }
  return undefined;
}

describe('compat matrix() rejects a ragged nested array (#1092, #1273)', () => {
  it.each([
    [[[1], []]],
    [[[1, 2], [3]]],
    [[[1], [2, 3]]],
    [[[[1], [2]], [[3]]]],
    [[[1], 2]],
    [[1, [2]]],
  ])('matrix(%j) throws the mathjs RangeError', (input) => {
    const expected = thrown(() => mj.matrix(input));
    expect(expected).toBeInstanceOf(RangeError);
    const actual = thrown(() => math.matrix(input));
    expect(actual).toBeInstanceOf(RangeError);
    expect(actual!.message).toBe(expected!.message);
  });

  it('a rectangular array is unchanged', () => {
    const m = math.matrix([
      [1, 2],
      [3, 4],
    ]) as { size(): number[]; toArray(): number[][] };
    expect(m.size()).toEqual([2, 2]);
    expect(m.toArray()).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('the expression language throws the RangeError', () => {
    const e = thrown(() => math.evaluate('matrix([[1], [2, 3]])'));
    expect(e).toBeInstanceOf(RangeError);
    expect(e!.message).toBe(thrown(() => mj.matrix([[1], [2, 3]]))!.message);
  });
});

describe('compat sparse() of a ragged nested array (#1273)', () => {
  it.each([
    [[[1], [2, 3]]],
    [[[1, 2], [3]]],
    [[[1, 2], [3, 4, 5], [6]]],
    [[[], [1]]],
    [[[1], 2]],
    [[1, [2]]],
  ])('sparse(%j) and matrix(%j, "sparse") have the mathjs size and entries', (input) => {
    const expected = mj.sparse(input) as { size(): number[]; toArray(): unknown };
    const viaSparse = math.sparse(input) as { size(): number[]; toArray(): unknown };
    expect(viaSparse.size()).toEqual(expected.size());
    expect(viaSparse.toArray()).toEqual(expected.toArray());
    const viaMatrix = math.matrix(input, 'sparse') as { size(): number[]; toArray(): unknown };
    expect(viaMatrix.size()).toEqual(expected.size());
    expect(viaMatrix.toArray()).toEqual(expected.toArray());
  });
});
