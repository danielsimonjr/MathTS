import { describe, it, expect } from 'vitest';
import { interval } from '../src/index.js';

describe('interval arithmetic', () => {
  it('add [1,2]+[3,4] = [4,6]', () => {
    const r = interval(1, 2).add(interval(3, 4));
    expect(r.lo).toBeCloseTo(4, 10);
    expect(r.hi).toBeCloseTo(6, 10);
    expect(r.lo).toBeLessThanOrEqual(4); // outward rounded
    expect(r.hi).toBeGreaterThanOrEqual(6);
  });
  it('mul mixed signs [-1,2]*[2,3] = [-3,6]', () => {
    const r = interval(-1, 2).mul(interval(2, 3));
    expect(r.lo).toBeCloseTo(-3, 10);
    expect(r.hi).toBeCloseTo(6, 10);
  });
  it('sqrt([1,4]) = [1,2]', () => {
    const r = interval(1, 4).sqrt();
    expect(r.lo).toBeCloseTo(1, 10);
    expect(r.hi).toBeCloseTo(2, 10);
  });
  it('div by an interval containing 0 throws', () => {
    expect(() => interval(1, 2).div(interval(-1, 1))).toThrow();
  });
  it('contains + width + mid', () => {
    const a = interval(2, 6);
    expect(a.contains(4)).toBe(true);
    expect(a.contains(7)).toBe(false);
    expect(a.width()).toBeCloseTo(4, 10);
    expect(a.mid()).toBeCloseTo(4, 10);
  });
  it('containment: true product of interior points is inside', () => {
    const r = interval(1, 2).mul(interval(3, 4)); // [3,8]
    expect(r.lo).toBeLessThanOrEqual(1.4 * 3.1);
    expect(r.hi).toBeGreaterThanOrEqual(1.9 * 3.9);
  });
});
