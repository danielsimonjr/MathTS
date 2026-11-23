/**
 * Entry guards for the data arguments of the pool methods (#1142).
 *
 * The pool chunks its data and transfers `chunk.buffer`. A value that is not a typed array has
 * no buffer, so the worker library threw `DataCloneError` in a later tick and the process ended.
 * A typed array of another element type sent its bytes, which the worker read as Float64 or
 * Int32. The guards turn each data argument into the array type that the method reads, or throw
 * one TypeError that names the method.
 *
 * The accept and reject set is the one of `assertArrayLike` in core. This package has core as a
 * devDependency only, so the predicate is a copy, and the parity test below compares it with
 * `pairwiseSum`, which calls `assertArrayLike`.
 */
import { describe, it, expect } from 'vitest';
import { pairwiseSum } from '@danielsimonjr/mathts-core';
import { assertArrayData, toArrayData, toFloat64Data, toInt32Data } from '../src/data-guards.js';

/** The message of the TypeError that `call` throws, or `null` when it does not throw. */
function messageOf(call: () => unknown): string | null {
  try {
    call();
    return null;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return error.message;
  }
}

/** The inputs of the plan: each one is accepted or rejected by `assertArrayLike`. */
const INPUTS: readonly [string, unknown][] = [
  ['1', 1],
  ['null', null],
  ["'ab'", 'ab'],
  ['{}', {}],
  ['{ length: 2 }', { length: 2 }],
  ['{ length: -1 }', { length: -1 }],
  ['{ length: NaN }', { length: Number.NaN }],
  ['{ length: 1.5 }', { length: 1.5 }],
  ['{ length: Infinity }', { length: Infinity }],
  ['[1]', [1]],
  ['new Float64Array(1)', new Float64Array(1)],
  ['new Int32Array(1)', new Int32Array(1)],
  ['undefined', undefined],
  ['true', true],
  ['() => 1', () => 1],
];

describe('toFloat64Data: parity with core assertArrayLike (pairwiseSum)', () => {
  for (const [label, value] of INPUTS) {
    it(`${label}: the same accept or reject, and the same message`, () => {
      const core = messageOf(() => pairwiseSum(value as never));
      const guard = messageOf(() => toFloat64Data('pairwiseSum', value));
      expect(guard).toBe(core);
    });
  }
});

describe('toFloat64Data', () => {
  it('returns a Float64Array as it is, with no copy', () => {
    const data = new Float64Array([1, 2, 3]);
    expect(toFloat64Data('sum', data)).toBe(data);
  });

  it('copies a number[] and another typed array into a Float64Array', () => {
    const fromArray = toFloat64Data('sum', [1, 2, 3]);
    expect(fromArray).toBeInstanceOf(Float64Array);
    expect(Array.from(fromArray)).toEqual([1, 2, 3]);
    const fromInt = toFloat64Data('sum', new Int32Array([4, 5]));
    expect(fromInt).toBeInstanceOf(Float64Array);
    expect(Array.from(fromInt)).toEqual([4, 5]);
    const fromFloat32 = toFloat64Data('sum', new Float32Array([0.5, -2]));
    expect(Array.from(fromFloat32)).toEqual([0.5, -2]);
  });

  it('does not change or detach its input', () => {
    const data = [1, 2, 3];
    const typed = new Int32Array([7, 8]);
    toFloat64Data('sum', data);
    toFloat64Data('sum', typed);
    expect(data).toEqual([1, 2, 3]);
    expect(Array.from(typed)).toEqual([7, 8]);
  });

  it('names the method and the type in the message', () => {
    expect(messageOf(() => toFloat64Data('sum', 1))).toBe(
      'sum: expects an array of numbers, got a number'
    );
    expect(messageOf(() => toFloat64Data('dot', null))).toBe(
      'dot: expects an array of numbers, got a null'
    );
    expect(messageOf(() => toFloat64Data('norm', 'ab'))).toBe(
      'norm: expects an array of numbers, got a string'
    );
    expect(messageOf(() => toFloat64Data('prod', {}))).toBe(
      'prod: expects an array of numbers, got a Object'
    );
  });

  it('keeps the native TypeError for a BigInt typed array', () => {
    expect(() => toFloat64Data('sum', new BigInt64Array(1))).toThrow(TypeError);
  });
});

describe('toInt32Data', () => {
  it('returns an Int32Array as it is, with no copy', () => {
    const data = new Int32Array([1, 2]);
    expect(toInt32Data('bitNot', data)).toBe(data);
  });

  it('copies a number[] into an Int32Array', () => {
    const out = toInt32Data('bitNot', [1, 2]);
    expect(out).toBeInstanceOf(Int32Array);
    expect(Array.from(out)).toEqual([1, 2]);
  });

  it('rejects a value that is not array-like', () => {
    expect(messageOf(() => toInt32Data('bitNot', 1))).toBe(
      'bitNot: expects an array of numbers, got a number'
    );
    expect(messageOf(() => toInt32Data('bitAnd', null))).toBe(
      'bitAnd: expects an array of numbers, got a null'
    );
  });
});

describe('toArrayData and assertArrayData', () => {
  it('returns an Array as it is, with no copy', () => {
    const data = [1, 2, 3];
    expect(toArrayData('map', data)).toBe(data);
  });

  it('copies a typed array into a plain Array', () => {
    const out = toArrayData('map', new Float64Array([1, 2]));
    expect(Array.isArray(out)).toBe(true);
    expect(out).toEqual([1, 2]);
  });

  it('names the method and the type in the message', () => {
    expect(messageOf(() => toArrayData('map', 1))).toBe('map: expects an array, got a number');
    expect(messageOf(() => toArrayData('sort', null))).toBe('sort: expects an array, got a null');
    expect(messageOf(() => toArrayData('filter', 'ab'))).toBe(
      'filter: expects an array, got a string'
    );
  });

  it('assertArrayData checks without a copy', () => {
    const typed = new Float64Array([1, 2]);
    expect(() => assertArrayData('count', typed)).not.toThrow();
    expect(() => assertArrayData('count', [1])).not.toThrow();
    expect(messageOf(() => assertArrayData('count', 1))).toBe(
      'count: expects an array, got a number'
    );
  });
});
