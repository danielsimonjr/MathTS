/**
 * Sparse resize (found with #1279 and #1288).
 *
 * `MathJSSparseMatrix.resize` ignored the default value, ignored the `copy` flag and did not
 * check the number of dimensions, so `ones(2, 3, 'sparse')` was all zero, `resize(s, [3, 3])`
 * changed `s`, and `zeros(3, 'sparse')` had the size `[3, undefined]`. The oracle is the
 * `resize`, `zeros` and `ones` of the mathjs devDependency.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Sp = { storage(): string; size(): number[]; toArray(): unknown; resize: Fn };
const f = math as unknown as Record<string, Fn>;
const mj = mathjs as unknown as Record<string, Fn>;

const DATA = [
  [1, 2],
  [0, 3],
];

function thrown(fn: () => unknown): Error | undefined {
  try {
    fn();
  } catch (e) {
    return e as Error;
  }
  return undefined;
}

describe('sparse resize fills new entries with the default value', () => {
  it.each([
    [[3, 3], 7],
    [[1, 3], 7],
    [[3, 1], 7],
    [[4, 2], 5],
    [[2, 4], 5],
    [[3, 3], undefined],
    [[0, 0], 7],
    [[5, 0], 7],
    [[2, 2], 7],
  ] as [number[], number | undefined][])(
    'resize(sparse, %j, %s) is the matrix of mathjs',
    (size, dflt) => {
      const args = dflt === undefined ? [size] : [size, dflt];
      const expected = mj.resize(mj.sparse(DATA), ...args) as Sp;
      const actual = f.resize(f.sparse(DATA), ...args) as Sp;
      expect(actual.storage()).toBe('sparse');
      expect(actual.size()).toEqual(expected.size());
      expect(actual.toArray()).toEqual(expected.toArray());
    }
  );

  it.each([
    ['ones', [2, 3]],
    ['ones', [3, 3]],
    ['ones', [0, 0]],
    ['zeros', [2, 3]],
  ] as [string, number[]][])('%s(%j, "sparse") is the matrix of mathjs', (name, size) => {
    const expected = mj[name](...size, 'sparse') as Sp;
    const actual = f[name](...size, 'sparse') as Sp;
    expect(actual.storage()).toBe('sparse');
    expect(actual.size()).toEqual(expected.size());
    expect(actual.toArray()).toEqual(expected.toArray());
  });

  it('a stored entry keeps its row order after a fill (the matrix is usable)', () => {
    const r = f.resize(f.sparse(DATA), [3, 3], 7) as Sp;
    expect(r.toArray()).toEqual([
      [1, 2, 7],
      [0, 3, 7],
      [7, 7, 7],
    ]);
    // A product reads the stored rows in order.
    const product = f.multiply(r, f.matrix([[1], [1], [1]])) as { toArray(): unknown };
    expect(product.toArray()).toEqual([[10], [10], [21]]);
  });
});

describe('sparse resize and the copy flag', () => {
  it('the resize function does not change its input', () => {
    const s = f.sparse(DATA) as Sp;
    const r = f.resize(s, [3, 3], 7) as Sp;
    expect(r).not.toBe(s);
    expect(s.size()).toEqual([2, 2]);
    expect(s.toArray()).toEqual(DATA);
  });

  it('the method with copy returns a new matrix and leaves this one as it is', () => {
    const s = f.sparse(DATA) as Sp;
    const r = s.resize([3, 3], 7, true) as Sp;
    expect(r).not.toBe(s);
    expect(s.size()).toEqual([2, 2]);
    expect(r.size()).toEqual([3, 3]);
  });

  it('the method without copy changes this matrix and returns it, as in mathjs', () => {
    const s = f.sparse(DATA) as Sp;
    const r = s.resize([3, 3], 7) as Sp;
    expect(r).toBe(s);
    expect(s.size()).toEqual([3, 3]);
    const expected = mj.sparse(DATA) as unknown as Sp;
    expect(expected.resize([3, 3], 7)).toBe(expected);
    expect(s.toArray()).toEqual(expected.toArray());
  });
});

describe('sparse resize needs two dimensions', () => {
  it.each([
    [
      'resize(sparse, [3])',
      () => f.resize(f.sparse(DATA), [3]),
      () => mj.resize(mj.sparse(DATA), [3]),
    ],
    [
      'resize(sparse, [2, 2, 2])',
      () => f.resize(f.sparse(DATA), [2, 2, 2]),
      () => mj.resize(mj.sparse(DATA), [2, 2, 2]),
    ],
    ['zeros(3, "sparse")', () => f.zeros(3, 'sparse'), () => mj.zeros(3, 'sparse')],
  ])('%s throws the mathjs Error', (_name, actual, expected) => {
    const e = thrown(expected);
    expect(e!.message).toBe('Only two dimensions matrix are supported');
    const a = thrown(actual);
    expect(a).toBeInstanceOf(Error);
    expect(a!.message).toBe(e!.message);
  });
});
