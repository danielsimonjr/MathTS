/**
 * A unary function keeps the container (the class of #1264 and #1278). `re`, `im`, `arg` and
 * `setDistinct` had an Array signature only, so a matrix converted to an Array (core typed
 * conversion) and the result was an Array; a 0 x 3 matrix became `[]`. mathjs 15.2.0 returns a
 * matrix: the same storage and size for `re`, `im` and `arg` (the rule of `conj` and `abs`), and a
 * 1-D dense matrix for `setDistinct`.
 */
import { describe, expect, it } from 'vitest';
import { arg, im, matrix, re, setDistinct, sparse, zeros } from '../src/index.js';

type Boxed = { size(): number[]; storage(): string; toArray(): unknown[] };
type Un = (x: unknown) => unknown;
const M = () =>
  matrix([
    [4, -1],
    [1, 3],
  ]);
const S = () =>
  sparse([
    [4, 0],
    [0, -3],
  ]);

describe.each([
  [
    're',
    re as Un,
    [
      [4, -1],
      [1, 3],
    ],
    [
      [4, 0],
      [0, -3],
    ],
  ],
  [
    'im',
    im as Un,
    [
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [0, 0],
    ],
  ],
  [
    'arg',
    arg as Un,
    [
      [0, Math.PI],
      [0, 0],
    ],
    [
      [0, 0],
      [0, Math.PI],
    ],
  ],
])('%s keeps the container', (_name, fn, denseWant, sparseWant) => {
  it('a dense matrix gives a dense matrix', () => {
    const r = fn(M()) as Boxed;
    expect(Array.isArray(r)).toBe(false);
    expect(r.storage()).toBe('dense');
    expect(r.toArray()).toEqual(denseWant);
  });
  it('a sparse matrix gives a sparse matrix', () => {
    const r = fn(S()) as Boxed;
    expect(r.storage()).toBe('sparse');
    expect(r.toArray()).toEqual(sparseWant);
  });
  it('a 0 x 3 matrix keeps its size', () => {
    expect((fn(zeros(0, 3)) as Boxed).size()).toEqual([0, 3]);
  });
  it('an Array stays an Array', () => {
    expect(Array.isArray(fn([[1, 2]]))).toBe(true);
  });
});

describe('setDistinct of a matrix is a 1-D dense matrix', () => {
  it('dense and sparse arguments', () => {
    for (const x of [
      matrix([
        [4, 1],
        [1, 3],
      ]),
      sparse([
        [4, 0],
        [0, 3],
      ]),
    ]) {
      const r = (setDistinct as Un)(x) as Boxed;
      expect(r.storage()).toBe('dense');
      expect(r.size()).toEqual([3]);
    }
    expect(
      (
        (setDistinct as Un)(
          matrix([
            [4, 1],
            [1, 3],
          ])
        ) as Boxed
      ).toArray()
    ).toEqual([1, 3, 4]);
  });
  it('a 0 x 3 matrix gives the empty vector [0] (mathjs [0])', () => {
    expect(((setDistinct as Un)(zeros(0, 3)) as Boxed).size()).toEqual([0]);
  });
  it('an Array stays an Array', () => {
    expect((setDistinct as Un)([1, 1, 2])).toEqual([1, 2]);
  });
});
