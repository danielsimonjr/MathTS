/**
 * Issue #1046: a typed array with number elements converts to Float64Array, so a Float64Array
 * signature accepts every kind of number typed array. A Float64Array keeps its own signature, and a bigint typed
 * array does not convert.
 */
import { describe, it, expect } from 'vitest';
import { mathTyped } from '../src/index.js';

const probe = mathTyped('probe1046', {
  Float64Array: (a: Float64Array) => ['Float64Array', a.constructor.name, Array.from(a)],
  Array: () => ['Array'],
});

describe('#1046 NumericTypedArray converts to Float64Array', () => {
  const kinds = [
    Float32Array,
    Int32Array,
    Uint32Array,
    Int16Array,
    Uint16Array,
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
  ];
  for (const K of kinds) {
    it(`${K.name} reaches the Float64Array signature with the same values`, () => {
      expect(probe(new K([1, 2, 250]))).toEqual([
        'Float64Array',
        'Float64Array',
        Array.from(new K([1, 2, 250])),
      ]);
    });
  }

  it('a Float64Array is passed as is', () => {
    const f = new Float64Array([0.1]);
    const fn = mathTyped('probe1046b', { Float64Array: (a: Float64Array) => a });
    expect(fn(f)).toBe(f);
  });

  it('a BigInt64Array, a DataView and a plain object do not convert', () => {
    expect(() => probe(new BigInt64Array([1n]))).toThrow(TypeError);
    expect(() => probe(new DataView(new ArrayBuffer(8)))).toThrow(TypeError);
    expect(() => probe({ length: 1, 0: 1 })).toThrow(TypeError);
  });
});
