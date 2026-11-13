import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { closedFormRoots, snapRoot } from '../src/cas/closed-form-roots.js';

const complexParts = (r: number | Complex): [number, number] =>
  typeof r === 'number' ? [r, 0] : [r.re, r.im];

describe('snapRoot: a root snaps to an integer only when the integer is a root', () => {
  it('snaps the rounding noise of a root to the integer root', () => {
    expect(snapRoot([-1, 1], 1.0000000000000002)).toBe(1);
    expect(snapRoot([-6, 11, -6, 1], 2.9999999999999996)).toBe(3);
  });

  it('keeps a root that is near an integer but is not one', () => {
    expect(snapRoot([-1.000000001, 1], 1.000000001)).toBe(1.000000001);
    expect(snapRoot([-1e-10, 1], 1e-10)).toBe(1e-10);
  });

  it('keeps two distinct roots apart when one of them is an integer', () => {
    // x*(x - 1e-10): the root 1e-10 is close to the root 0 and is not 0
    expect(snapRoot([0, -1e-10, 1], 1e-10)).toBe(1e-10);
    expect(snapRoot([0, -1e-10, 1], 0)).toBe(0);
  });

  it('turns -0 into 0', () => {
    expect(Object.is(snapRoot([0, 1], -0), 0)).toBe(true);
  });
});

describe('closedFormRoots: degree 1 to 3, every tolerance relative', () => {
  it('degree 1', () => {
    expect(closedFormRoots([-6, 2])).toEqual([3]);
    expect(closedFormRoots([-1e-10, 1])).toEqual([1e-10]);
    expect(closedFormRoots([-1.000000001, 1])).toEqual([1.000000001]);
    expect(closedFormRoots([-1, 3])).toEqual([1 / 3]);
  });

  it('degree 2: a large and a small constant', () => {
    expect(closedFormRoots([-1e12, 0, 1])).toEqual([-1e6, 1e6]);
    expect(closedFormRoots([-1e20, 0, 1])).toEqual([-1e10, 1e10]);
    expect(closedFormRoots([-1e300, 0, 1])).toEqual([-1e150, 1e150]);
    expect(closedFormRoots([-1e-18, 0, 1])).toEqual([-1e-9, 1e-9]);
    expect(closedFormRoots([-1e-20, 0, 1])).toEqual([-1e-10, 1e-10]);
  });

  it('degree 2: two real roots, a double root and a conjugate pair', () => {
    expect(closedFormRoots([1, -4, 3])).toEqual([1 / 3, 1]);
    expect(closedFormRoots([2, -3, 1])).toEqual([1, 2]);
    expect(closedFormRoots([1, -2, 1])).toEqual([1]);
    const pair = closedFormRoots([1, 0, 1]).map(complexParts);
    expect(pair).toEqual([
      [0, 1],
      [0, -1],
    ]);
  });

  it('degree 2: a root of size 1e-10 next to a root of size 1', () => {
    // -b + sqrt(d) cancels here; the stable form keeps the small root exact
    const [small, large] = closedFormRoots([1e-10, -1 - 1e-10, 1]) as number[];
    expect(small).toBeCloseTo(1e-10, 24);
    expect(large).toBeCloseTo(1, 15);
  });

  it('degree 2: a tiny imaginary pair is not a real pair', () => {
    const roots = closedFormRoots([1e-20, 0, 1]).map(complexParts);
    expect(roots[0][0]).toBe(0);
    expect(roots[0][1]).toBeCloseTo(1e-10, 24);
    expect(roots[1][1]).toBeCloseTo(-1e-10, 24);
  });

  it('degree 3: an integer cubic gives the integer roots', () => {
    expect(closedFormRoots([-6, 11, -6, 1])).toEqual([1, 2, 3]);
    expect(closedFormRoots([0, 0, 0, 1])).toEqual([0]);
    expect(closedFormRoots([0, 0, -1, 1])).toEqual([0, 1]);
  });

  it('degree 3: one real root and a conjugate pair, positive imaginary part first', () => {
    const roots = closedFormRoots([-8, 0, 0, 1]);
    expect(roots[0]).toBe(2);
    const [a, b] = roots.slice(1).map(complexParts);
    expect(a[0]).toBeCloseTo(-1, 14);
    expect(a[1]).toBeCloseTo(Math.sqrt(3), 14);
    expect(b[1]).toBeCloseTo(-Math.sqrt(3), 14);
  });

  it('degree 3: a root of any size', () => {
    const large = closedFormRoots([-1e18, 0, 0, 1]);
    expect(large[0]).toBeCloseTo(1e6, 8);
    expect(large).toHaveLength(3);
    const small = closedFormRoots([-1e-30, 0, 0, 1]);
    expect(small[0]).toBeCloseTo(1e-10, 24);
    expect(small).toHaveLength(3);
  });

  it('refuses a degree outside 1 to 3', () => {
    expect(() => closedFormRoots([1])).toThrow(RangeError);
    expect(() => closedFormRoots([1, 0, 0, 0, 1])).toThrow(/degree 1 to 3/);
  });
});
