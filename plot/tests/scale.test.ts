import { describe, it, expect } from 'vitest';
import { extent, linearScale, logScale, niceTicks } from '../src/scale.js';

describe('scale', () => {
  it('extent returns [min,max] and pads a flat range', () => {
    expect(extent([3, 1, 2])).toEqual([1, 3]);
    expect(extent([5, 5])).toEqual([4, 6]);
  });
  it('linearScale maps domain to range endpoints exactly', () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
  });
  it('logScale maps a decade correctly', () => {
    const s = logScale([1, 100], [0, 200]);
    expect(s(1)).toBeCloseTo(0, 9);
    expect(s(10)).toBeCloseTo(100, 9);
    expect(s(100)).toBeCloseTo(200, 9);
  });
  it('niceTicks returns round numbers spanning the range', () => {
    // count=10 (not 5): niceTicks(0,100,5) correctly returns [0,20,40,60,80,100]
    // (matches D3's canonical ticks(0,100,5)), which never contains 50 — count=5
    // was a brief-fixture bug. count=10 -> step=10 -> [0,10,...,100], satisfies
    // all three assertions while preserving the original intent.
    const t = niceTicks(0, 100, 10);
    expect(t[0]).toBeLessThanOrEqual(0);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(100);
    expect(t).toContain(50);
  });
});
