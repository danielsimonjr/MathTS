import { describe, it, expect } from 'vitest';
import {
  sturmSequence,
  sturmRootCount,
  descartesSignChanges,
  isolateRealRoots,
  realRoots,
} from '../src/cas/real-roots.js';

const p = [1, -3, 0, 1]; // x^3 - 3x + 1

describe('real roots', () => {
  it('Sturm counts', () => {
    expect(sturmRootCount(p, -2, 2)).toBe(3);
    expect(sturmRootCount(p, 0, 1)).toBe(1);
    expect(sturmSequence(p).length).toBeGreaterThan(1);
  });
  it('Descartes bound', () => {
    expect(descartesSignChanges(p)).toBe(2);
  });
  it('isolation gives one root per interval', () => {
    const iv = isolateRealRoots(p);
    expect(iv.length).toBe(3);
    for (const [a, b] of iv) expect(sturmRootCount(p, a, b)).toBe(1);
  });
  it('approximates the three roots', () => {
    const r = realRoots(p);
    const expected = [-1.8793852415718169, 0.3472963553338607, 1.532088886237956];
    expect(r.length).toBe(3);
    r.forEach((x, i) => expect(Math.abs(x - expected[i])).toBeLessThan(1e-10));
  });
  it('no real roots for x^2 + 1', () => {
    expect(realRoots([1, 0, 1])).toEqual([]);
  });
  it('finds a double root once', () => {
    // (x - 1)^2 = x^2 - 2x + 1
    const r = realRoots([1, -2, 1]);
    expect(r.length).toBe(1);
    // Float Sturm evaluation near a double root is accurate to about sqrt(eps).
    expect(Math.abs(r[0] - 1)).toBeLessThan(1e-6);
  });
  it('rejects the zero polynomial', () => {
    expect(() => realRoots([0, 0])).toThrow(RangeError);
  });
});

describe('real roots: coefficient order and robustness', () => {
  it('ascending convention: [-4,0,1] = x^2-4 and [-6,11,-6,1] has roots 1,2,3', () => {
    const r = realRoots([-4, 0, 1]);
    expect(r[0]).toBeCloseTo(-2, 8);
    expect(r[1]).toBeCloseTo(2, 8);
    const c = realRoots([-6, 11, -6, 1]);
    expect(c.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 2, 3]);
  });
  it('[1,0,-4] is 1-4x^2 (roots +-1/2) and a constant has none', () => {
    const r = realRoots([1, 0, -4]);
    expect(r[0]).toBeCloseTo(-0.5, 8);
    expect(r[1]).toBeCloseTo(0.5, 8);
    expect(realRoots([1, 0, 0])).toEqual([]);
  });
  it('constant-term zero gives root 0', () => {
    const r = realRoots([0, 1, -2]);
    expect(r[0]).toBeCloseTo(0, 8);
    expect(r[1]).toBeCloseTo(0.5, 8);
  });
  it('huge-magnitude roots terminate (1 - 1e-12 x^2)', () => {
    const r = realRoots([1, 0, -1e-12]);
    expect(r.length).toBe(2);
    expect(Math.abs(r[1] - 1e6) / 1e6).toBeLessThan(1e-9);
    expect(Math.abs(r[0] + 1e6) / 1e6).toBeLessThan(1e-9);
  });
});
