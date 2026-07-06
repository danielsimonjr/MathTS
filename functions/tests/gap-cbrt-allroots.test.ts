import { describe, it, expect } from 'vitest';
import { cbrt } from '../src/index.js';
import { isComplex } from '@danielsimonjr/mathts-core';

/**
 * `cbrt(number, allRoots)` — the real-number two-argument form, wired 2026-07-05.
 * Previously only `cbrt(Complex, boolean)` existed and `cbrt(8, true)` threw
 * "Too many arguments (expected 1, actual 2)"; the source comment wrongly
 * assumed typed-function would synthesize `number, boolean` via a
 * number→Complex conversion, but the MathTS instance does not. Behavior pinned
 * to mathjs 15: the two-arg form routes through the complex cube-root path, so
 * `cbrt(8, true)` returns all three cube roots [2, -1±i√3] and `cbrt(8, false)`
 * the principal root (2). The one-arg `cbrt(8)` real path is unchanged.
 */
const toArr = (r: unknown): unknown[] => {
  const m = r as { toArray?: () => unknown[]; valueOf?: () => unknown[] };
  if (typeof m?.toArray === 'function') return m.toArray();
  if (Array.isArray(r)) return r;
  return (m?.valueOf?.() as unknown[]) ?? [r];
};
const re = (c: unknown): number => (c as { re: number }).re;
const im = (c: unknown): number => (c as { im: number }).im;

describe('cbrt(number, allRoots) — real-number two-arg form (mathjs parity)', () => {
  it('cbrt(8) one-arg stays the real principal root', () => {
    expect(cbrt(8)).toBe(2);
  });

  it('cbrt(8, true) returns all three cube roots', () => {
    const roots = toArr(cbrt(8, true));
    expect(roots).toHaveLength(3);
    // principal root is 2 (real)
    expect(re(roots[0])).toBeCloseTo(2, 10);
    expect(im(roots[0])).toBeCloseTo(0, 10);
    // the other two: 2·e^(±2πi/3) = -1 ± i√3
    expect(re(roots[1])).toBeCloseTo(-1, 10);
    expect(Math.abs(im(roots[1]))).toBeCloseTo(Math.sqrt(3), 10);
    expect(re(roots[2])).toBeCloseTo(-1, 10);
    expect(Math.abs(im(roots[2]))).toBeCloseTo(Math.sqrt(3), 10);
    // the two complex roots are conjugates
    expect(im(roots[1])).toBeCloseTo(-im(roots[2]), 10);
  });

  it('cbrt(27, true) roots have modulus 3', () => {
    const roots = toArr(cbrt(27, true));
    for (const r of roots) {
      expect(Math.hypot(re(r), im(r))).toBeCloseTo(3, 10);
    }
  });

  it('cbrt(8, false) returns the principal root (value 2)', () => {
    const principal = cbrt(8, false);
    // routes through the complex path → Complex(2, 0)
    expect(isComplex(principal) ? re(principal) : (principal as number)).toBeCloseTo(2, 10);
  });

  it('every returned root cubes back to the input (oracle: r^3 = 8)', () => {
    const roots = toArr(cbrt(8, true)) as Array<{ re: number; im: number }>;
    for (const r of roots) {
      // (a+bi)^3 real part = a^3 - 3ab^2
      const a = r.re,
        b = r.im;
      const cubeRe = a * a * a - 3 * a * b * b;
      const cubeIm = 3 * a * a * b - b * b * b;
      expect(cubeRe).toBeCloseTo(8, 8);
      expect(cubeIm).toBeCloseTo(0, 8);
    }
  });
});
