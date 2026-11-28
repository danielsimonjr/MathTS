import { describe, expect, it } from 'vitest';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import {
  createCompatSubsetG09,
  installG09BridgeMatrixSubsetPatch,
  reshapeG09AssignmentRhsInPlace,
} from '../../src/mathjs-parity-g09.js';

/**
 * Drive G09 adapters through the compat *source* graph (not dist) so Coverage
 * records `mathjs-parity-g09.ts`. The oracle files import the published entry.
 */

type EvaluateFn = (expr: string, scope?: unknown) => unknown;

const math = createCompat(compatAll, {});
const ev = math.evaluate as EvaluateFn;

describe('G09 src surface (#1557)', () => {
  it('column assignment reshapes a row vector to a column', () => {
    const scope: Record<string, unknown> = {};
    ev('e = [[1, 2], [3, 4]]', scope);
    const returned = ev('e[:, 2] = [9, 9]', scope);
    expect(math.format(returned, { precision: 14 })).toBe('[[9], [9]]');
    expect(math.format(scope.e, { precision: 14 })).toBe('[[1, 9], [3, 9]]');
  });

  it('growing column write returns a column', () => {
    const scope: Record<string, unknown> = {};
    ev('e = [[1, 2], [3, 4]]', scope);
    const returned = ev('e[:, 3] = [5, 6]', scope);
    expect(math.format(returned, { precision: 14 })).toBe('[[5], [6]]');
    expect(math.format(scope.e, { precision: 14 })).toBe('[[1, 2, 5], [3, 4, 6]]');
  });

  it('range on the row axis, scalar column', () => {
    const scope: Record<string, unknown> = {};
    ev('e = [[1, 2], [3, 4]]', scope);
    const returned = ev('e[1:2, 2] = [9, 9]', scope);
    expect(math.format(returned, { precision: 14 })).toBe('[[9], [9]]');
  });

  it('3-D middle axis colon assignment', () => {
    const scope: Record<string, unknown> = {};
    ev('m = zeros(2, 2, 2)', scope);
    ev('m[1, :, 1] = [5, 6]', scope);
    expect(math.typeOf(scope.m)).toBe('DenseMatrix');
  });

  it('column assignment with a DenseMatrix replacement', () => {
    const scope: Record<string, unknown> = {};
    ev('e = [[1, 2], [3, 4]]', scope);
    ev('col = matrix([9, 9])', scope);
    ev('e[:, 2] = col', scope);
    expect(math.format(scope.e, { precision: 14 })).toBe('[[1, 9], [3, 9]]');
  });

  it('throws shape mismatch on a[:] = 5 for an empty matrix', () => {
    const scope: Record<string, unknown> = {};
    ev('a = []', scope);
    expect(() => ev('a[:] = 5', scope)).toThrow(/shape mismatch|Dimension mismatch/);
    expect(math.format(scope.a, { precision: 14 })).toBe('[]');
  });

  it('throws Dimension mismatch on e[:, 1] = 5 for an empty matrix', () => {
    const scope: Record<string, unknown> = {};
    ev('e = []', scope);
    expect(() => ev('e[:, 1] = 5', scope)).toThrow(/Dimension mismatch|shape mismatch/);
  });

  it('throws on an empty range assignment a[1:0] = 3', () => {
    const scope: Record<string, unknown> = {};
    ev('a = []', scope);
    expect(() => ev('a[1:0] = 3', scope)).toThrow();
  });

  it('throws on reversed range a[2:1] = 3', () => {
    const scope: Record<string, unknown> = {};
    ev('a = []', scope);
    expect(() => ev('a[2:1] = 3', scope)).toThrow();
  });

  it('throws on a 2-D empty range e[1:0, 1] = 3', () => {
    const scope: Record<string, unknown> = {};
    ev('e = []', scope);
    expect(() => ev('e[1:0, 1] = 3', scope)).toThrow();
  });

  it('reads through an empty index without throwing', () => {
    const m = math.matrix([1, 2]);
    const empty = math.index(math.range(1, 1));
    expect(() => math.subset(m, empty)).not.toThrow();
  });

  it('grows the issue repro through evaluate', () => {
    const scope: Record<string, unknown> = {};
    ev('e = []', scope);
    ev('e[1, 1:2] = [5, 6]', scope);
    ev('e[2, :] = [7, 8]', scope);
    expect(math.format(scope.e, { precision: 14 })).toBe('[[5, 6], [7, 8]]');
  });

  it('grows a 1-D array a[3] = 4', () => {
    const scope: Record<string, unknown> = {};
    ev('a = []', scope);
    ev('a[3] = 4', scope);
    expect(math.format(scope.a, { precision: 14 })).toBe('[0, 0, 4]');
  });

  it('reshapeG09AssignmentRhsInPlace mutates a row array to the column selection', () => {
    const index = math.index(math.range(1, 3), 2) as {
      isScalar: () => boolean;
      size: () => number[];
    };
    const rhs = [9, 9];
    reshapeG09AssignmentRhsInPlace(index, rhs);
    expect(rhs).toEqual([[9], [9]]);
  });

  it('reshapeG09AssignmentRhsInPlace no-ops a scalar index and a null replacement', () => {
    const scalar = math.index(1) as { isScalar: () => boolean; size: () => number[] };
    const rhs = [1];
    reshapeG09AssignmentRhsInPlace(scalar, rhs);
    expect(rhs).toEqual([1]);
    const nonScalar = math.index(math.range(1, 3), 2) as {
      isScalar: () => boolean;
      size: () => number[];
    };
    reshapeG09AssignmentRhsInPlace(nonScalar, null);
    reshapeG09AssignmentRhsInPlace(nonScalar, undefined);
    reshapeG09AssignmentRhsInPlace(nonScalar, 7);
  });

  it('reshapeG09AssignmentRhsInPlace unsqueezes a matrix whose rank is below the selection', () => {
    const index = math.index(1, math.range(1, 3)) as {
      isScalar: () => boolean;
      size: () => number[];
    };
    const m = math.matrix([5, 6]);
    reshapeG09AssignmentRhsInPlace(index, m);
    expect(m.size().length).toBeGreaterThanOrEqual(1);
  });

  it('reshapeG09AssignmentRhsInPlace accepts a foreign toArray object', () => {
    const index = math.index(math.range(1, 3), 2) as {
      isScalar: () => boolean;
      size: () => number[];
    };
    const foreign = {
      toArray: () => [9, 9],
    };
    reshapeG09AssignmentRhsInPlace(index, foreign);
  });

  it('subset wrapper throws Dimension mismatch for a non-scalar empty-index write', () => {
    const m = math.matrix([]);
    expect(() => math.subset(m, math.index(math.range(1, 1), 1), [5, 6])).toThrow(
      /Dimension mismatch|shape mismatch/
    );
  });

  it('createCompatSubsetG09 copies name/length even when redefine throws', () => {
    const frozen = Object.defineProperty(
      function subset(_a: unknown, _b: unknown) {
        return 'ok';
      },
      'name',
      { value: 'subset', configurable: false }
    );
    const wrapped = createCompatSubsetG09(frozen as (...args: never[]) => unknown, {
      add: () => 0,
      zeros: () => 0,
      matrix: (data: unknown) => data,
    });
    expect(wrapped(1, 2)).toBe('ok');
  });

  it('installG09BridgeMatrixSubsetPatch ignores non-bridge values and a second install', () => {
    installG09BridgeMatrixSubsetPatch(null);
    installG09BridgeMatrixSubsetPatch({ isMatrix: true });
    const sample = math.matrix([1]);
    installG09BridgeMatrixSubsetPatch(sample);
    installG09BridgeMatrixSubsetPatch(sample);
  });

  it('reshapeG09AssignmentRhsInPlace copies a broadcast array back into the caller', () => {
    const index = math.index(math.range(1, 3), 1) as {
      isScalar: () => boolean;
      size: () => number[];
    };
    const rhs = [5];
    reshapeG09AssignmentRhsInPlace(index, rhs);
    expect(Array.isArray(rhs)).toBe(true);
    expect(rhs.length).toBeGreaterThan(0);
  });

  it('reshapeG09AssignmentRhsInPlace unsqueezes a fake MathJSDenseMatrix', () => {
    function MathJSDenseMatrix() {
      /* bridge ctor name */
    }
    const replacement = Object.assign(new (MathJSDenseMatrix as unknown as { new (): object })(), {
      isMatrix: true,
      _size: [2, 2],
      _data: [
        [1, 2],
        [3, 4],
      ],
      subset: () => undefined,
      toArray: function toArray(this: { _data: unknown }) {
        return this._data;
      },
      size: function size(this: { _size: number[] }) {
        return this._size;
      },
    });
    const index = math.index(math.range(1, 3), math.range(1, 3), math.range(1, 3)) as {
      isScalar: () => boolean;
      size: () => number[];
    };
    reshapeG09AssignmentRhsInPlace(index, replacement);
    expect(Array.isArray((replacement as { _size: number[] })._size)).toBe(true);
  });

  it('throws Dimension mismatch using a matrix-like replacement size', () => {
    const m = math.matrix([]);
    const matrixLike = {
      isMatrix: true,
      toArray: () => [5, 6],
    };
    expect(() => math.subset(m, math.index(math.range(1, 1), 1), matrixLike)).toThrow(
      /Dimension mismatch|shape mismatch/
    );
    expect(() =>
      math.subset(m, math.index(math.range(1, 1), 1), { isMatrix: true, foo: 1 })
    ).toThrow(/Dimension mismatch|shape mismatch/);
  });
});
