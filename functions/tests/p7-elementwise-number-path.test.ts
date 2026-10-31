/**
 * P7-5 pins: plain-array elementwise number walker (add/subtract/multiply).
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { add, subtract, multiply } from '../src/index.js';

describe('P7-5 elementwiseNumber', () => {
  it('add 1-D bit-exact', () => {
    const a = [1, 2, -0, 4];
    const b = [5, -1, 0, 2];
    const out = add(a, b) as number[];
    expect(out[0]).toBe(6);
    expect(out[1]).toBe(1);
    expect(out[2]).toBe(0);
    expect(out[3]).toBe(6);
  });

  it('subtract scalar broadcast', () => {
    expect(subtract([3, 5, 7], 2)).toEqual([1, 3, 5]);
    expect(subtract(10, [1, 2, 3])).toEqual([9, 8, 7]);
  });

  it('multiply scalar broadcast', () => {
    expect(multiply([2, 3], 4)).toEqual([8, 12]);
  });

  it('length mismatch throws', () => {
    expect(() => add([1, 2], [1, 2, 3])).toThrow('Dimension mismatch');
  });

  it('mixed Complex falls back', () => {
    const a = [1, new Complex(1, 0)];
    const b = [2, new Complex(0, 1)];
    expect(() => add(a, b)).not.toThrow();
  });
});
