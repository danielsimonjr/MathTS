/**
 * Oracle tests for clone batch G (M13 max/min, M14 axis lookup, M15 eig/SVD prep).
 * Snapshots behaviour before consolidation; must stay green after refactor.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';
import { idx } from '../src/named-index';
import { tensorEig } from '../src/operations/eig';
import { tensorSvd } from '../src/operations/svd';

/** Independent NaN-aware extremum fold (matches Tensor max/min semantics). */
function oracleExtremum(
  values: number[],
  init: number,
  pick: (a: number, b: number) => number
): number {
  let acc = init;
  for (const v of values) {
    acc = Number.isNaN(v) ? v : Number.isNaN(acc) ? acc : pick(acc, v);
  }
  return acc;
}

describe('clone batch G — M13 max/min oracle', () => {
  it('NaN as the first reduced element wins for max and min', () => {
    const t = Tensor.fromNested([[NaN, 1, 2]], [1, 3]);
    const window = [NaN, 1, 2];
    expect(t.max().data[0]).toBe(oracleExtremum(window, -Infinity, Math.max));
    expect(t.min().data[0]).toBe(oracleExtremum(window, Infinity, Math.min));
    expect(Number.isNaN(t.max().data[0])).toBe(true);
    expect(Number.isNaN(t.min().data[0])).toBe(true);
  });

  it('all-NaN reduction is NaN for max and min', () => {
    const t = Tensor.fromNested(
      [
        [NaN, NaN],
        [NaN, NaN],
      ],
      [2, 2]
    );
    expect(Number.isNaN(t.max().data[0])).toBe(true);
    expect(Number.isNaN(t.min().data[0])).toBe(true);
  });

  it('keepDims false vs true on max/min along axis 0', () => {
    const t = Tensor.fromNested(
      [
        [1, 9],
        [4, 2],
      ],
      [2, 2]
    );
    expect(t.max(0).shape).toEqual([2]);
    expect(t.max(0).toNested()).toEqual([4, 9]);
    expect(t.min(0).toNested()).toEqual([1, 2]);
    expect(t.max(0, { keepDims: true }).shape).toEqual([1, 2]);
    expect(t.max(0, { keepDims: true }).toNested()).toEqual([[4, 9]]);
    expect(t.min(0, { keepDims: true }).toNested()).toEqual([[1, 2]]);
  });

  it('reducing an axis of length 1 leaves the sole element', () => {
    const t = Tensor.fromNested([[7]], [1, 1]);
    expect(t.max(0).data[0]).toBe(7);
    expect(t.min(1).data[0]).toBe(7);
  });

  it('empty tensor max is -Infinity and min is Infinity', () => {
    const empty = new Tensor([0], new Float64Array(0));
    expect(empty.max().data[0]).toBe(-Infinity);
    expect(empty.min().data[0]).toBe(Infinity);
  });

  it('reducing a 0-size axis fills with the identity', () => {
    const t = new Tensor([2, 0], new Float64Array(0));
    expect([...t.max(1).shape]).toEqual([2]);
    expect(t.max(1).data[0]).toBe(-Infinity);
    expect(t.max(1).data[1]).toBe(-Infinity);
    expect(t.min(1).data[0]).toBe(Infinity);
    expect(t.min(1).data[1]).toBe(Infinity);
  });

  it('max prefers +0 over -0; min prefers -0 over +0', () => {
    const negThenPos = new Tensor([2], new Float64Array([-0, 0]));
    expect(Object.is(negThenPos.max().data[0], 0)).toBe(true);
    expect(Object.is(negThenPos.min().data[0], -0)).toBe(true);
    const posThenNeg = new Tensor([2], new Float64Array([0, -0]));
    expect(Object.is(posThenNeg.max().data[0], 0)).toBe(true);
    expect(Object.is(posThenNeg.min().data[0], -0)).toBe(true);
  });
});

describe('clone batch G — M14 axis lookup oracle', () => {
  it('axisOf throws exact messages when axisLabels are missing', () => {
    const t = new Tensor([2, 3], new Float64Array(6));
    expect(() => t.axisOf(idx(2, 'i'))).toThrow('Tensor.axisOf: this tensor has no axisLabels');
  });

  it('axisOf throws exact message when index is unknown', () => {
    const i = idx(2, 'i');
    const j = idx(3, 'j');
    const k = idx(4, 'k');
    const t = new Tensor([2, 3], new Float64Array(6), [i, j]);
    expect(() => t.axisOf(k)).toThrow(
      `Tensor.axisOf: index ${k.toString()} not found in axisLabels`
    );
  });

  it('replaceIndex throws exact messages', () => {
    const i = idx(2, 'i');
    const j = idx(3, 'j');
    const k = idx(5, 'k');
    const bare = new Tensor([2, 3], new Float64Array(6));
    expect(() => bare.replaceIndex(i, j)).toThrow(
      'Tensor.replaceIndex: this tensor has no axisLabels'
    );

    const labelled = new Tensor([2, 3], new Float64Array(6), [i, j]);
    expect(() => labelled.replaceIndex(k, idx(6, 'l'))).toThrow(
      `Tensor.replaceIndex: index ${k.toString()} not found in axisLabels`
    );
  });

  it('replaceIndex preserves shape and data contents', () => {
    const i = idx(2, 'i');
    const j = idx(3, 'j');
    const k = idx(3, 'k');
    const data = new Float64Array([1, 2, 3, 4, 5, 6]);
    const t = new Tensor([2, 3], data, [i, j]);
    const u = t.replaceIndex(j, k);
    expect(u.shape).toEqual([...t.shape]);
    expect(Array.from(u.data)).toEqual(Array.from(t.data));
    expect(t.axisLabels![1].matches(j)).toBe(true);
    expect(u.axisLabels![1].matches(k)).toBe(true);
  });
});

describe('clone batch G — M15 eig/SVD matrix prep oracle', () => {
  it('tensorEig throws on duplicate rowAxes with exact message', () => {
    const t = Tensor.fromNested(
      [
        [1, 0],
        [0, 1],
      ],
      [2, 2]
    );
    expect(() => tensorEig(t, [0, 0])).toThrow('tensorEig: rowAxes contains duplicate axes');
  });

  it('duplicate out-of-range rowAxes is RangeError (invalid), not duplicate', () => {
    const t = Tensor.fromNested(
      [
        [1, 0],
        [0, 1],
      ],
      [2, 2]
    );
    expect(() => tensorEig(t, [5, 5])).toThrow(RangeError);
    expect(() => tensorEig(t, [5, 5])).toThrow(
      'tensorEig: rowAxes contains invalid axis 5 for tensor of rank 2'
    );
    expect(() => tensorEig(t, [-1, -1])).toThrow(RangeError);
    expect(() => tensorEig(t, [-1, -1])).toThrow(
      'tensorEig: rowAxes contains invalid axis -1 for tensor of rank 2'
    );
    expect(() => tensorSvd(t, [5, 5])).toThrow(RangeError);
    expect(() => tensorSvd(t, [5, 5])).toThrow(
      'tensorSvd: rowAxes contains invalid axis 5 for tensor of rank 2'
    );
  });

  it('tensorEig rejects non-square reshape; tensorSvd accepts the same partition', () => {
    const t = Tensor.fromNested(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [2, 3]
    );
    expect(() => tensorEig(t, [0])).toThrow('tensorEig: reshaped matrix must be square (got 2×3)');
    expect(() => tensorSvd(t, [0])).not.toThrow();
    const { U, S, V } = tensorSvd(t, [0]);
    expect(U.shape).toEqual([2, 2]);
    expect(S.shape[0]).toBeGreaterThan(0);
    expect(V.shape[0]).toBe(S.shape[0]);
  });

  it('invalid row axis uses function-specific RangeError text', () => {
    const t = Tensor.fromNested([1, 2, 3], [3]);
    expect(() => tensorEig(t, [3])).toThrow(
      'tensorEig: rowAxes contains invalid axis 3 for tensor of rank 1'
    );
    expect(() => tensorSvd(t, [3])).toThrow(
      'tensorSvd: rowAxes contains invalid axis 3 for tensor of rank 1'
    );
  });

  it('empty rowAxes error strings differ between eig and SVD', () => {
    const t = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    expect(() => tensorEig(t, [])).toThrow(
      'tensorEig: rowAxes is empty — at least one axis must be assigned'
    );
    expect(() => tensorSvd(t, [])).toThrow(
      'tensorSvd: rowAxes is empty — at least one axis must be assigned to U'
    );
  });

  it('rowAxes covering all axes: eig vs SVD suffix on the no-col-axis error', () => {
    const t = Tensor.fromNested(
      [
        [1, 2],
        [3, 4],
      ],
      [2, 2]
    );
    expect(() => tensorEig(t, [0, 1])).toThrow(
      'tensorEig: rowAxes covers all axes — at least one axis must remain'
    );
    expect(() => tensorSvd(t, [0, 1])).toThrow(
      'tensorSvd: rowAxes covers all axes — at least one axis must remain for V'
    );
  });
});
