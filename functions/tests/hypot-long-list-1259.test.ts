/**
 * #1259 follow-up: a long list does not go through a `Math.hypot` spread (the spread throws
 * RangeError past the engine argument limit), and a BigNumber mixed with two or more numbers
 * keeps a BigNumber result.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { hypot, gradientDescent } from '../src/index.js';
import { hypotList } from '../src/utils/hypot-list.js';

const N = 600_000;

describe('long-list hypot (#1259)', () => {
  it('hypotList of a long list has no spread and keeps the IEEE rule', () => {
    expect(hypotList(new Array<number>(N).fill(1))).toBe(Math.sqrt(N));
    const withNaN = new Array<number>(N).fill(1);
    withNaN[7] = NaN;
    expect(hypotList(withNaN)).toBeNaN();
    withNaN[9] = -Infinity;
    expect(hypotList(withNaN)).toBe(Infinity);
    expect(hypotList([3, 4])).toBe(Math.hypot(3, 4));
  });

  it('gradientDescent takes the gradient norm of a long gradient', () => {
    const x0 = new Array<number>(N).fill(0);
    const r = gradientDescent(() => 0, x0, { grad: (x) => x.map(() => 0), maxIter: 1 });
    expect(r.iterations).toBe(0);
  });
});

describe('typed hypot, BigNumber with numbers (#1259)', () => {
  it('a BigNumber with two or more numbers gives a BigNumber', () => {
    const r = hypot(BigNumber.fromNumber(3), 4, 0) as unknown;
    expect(r).toBeInstanceOf(BigNumber);
    expect((r as BigNumber).toString()).toBe('5');
    const s = hypot(2, BigNumber.fromNumber(3), 6) as unknown;
    expect(s).toBeInstanceOf(BigNumber);
    expect((s as BigNumber).toString()).toBe('7');
  });

  it('numbers only still give a number', () => {
    expect(hypot(2, 3, 6)).toBe(7);
  });
});
