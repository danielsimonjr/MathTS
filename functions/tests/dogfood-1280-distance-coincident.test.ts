/**
 * distance2D, distance3D and distanceND after the #1280 range gate. A sum of squares below
 * SQUARES_SAFE_MIN takes the scaling path (Math.hypot, scaledDistance). Points that coincide have
 * every difference 0: their distance is exactly 0 and needs no scaling, so they keep the plain
 * path. The proxy for the cost is a count of the calls of the slow kernels, not a wall clock.
 */
import { describe, expect, it } from 'vitest';
import { distance2D, distance3D, distanceND } from '../src/index.js';

/** Runs `fn` with a counter on `Math.hypot`; returns the number of calls. */
function hypotCalls(fn: () => void): number {
  const real = Math.hypot;
  let calls = 0;
  Math.hypot = (...args: number[]): number => {
    calls++;
    return real(...args);
  };
  try {
    fn();
  } finally {
    Math.hypot = real;
  }
  return calls;
}

describe('coincident points keep the plain path', () => {
  it('distance2D and distance3D give 0 without Math.hypot', () => {
    let d2 = -1;
    let d3 = -1;
    const calls = hypotCalls(() => {
      d2 = distance2D([1.5, -2.5], [1.5, -2.5]);
      d3 = distance3D([1.5, -2.5, 3], [1.5, -2.5, 3]);
    });
    expect(d2).toBe(0);
    expect(d3).toBe(0);
    expect(calls).toBe(0);
  });

  it('distanceND gives 0 without copying the points', () => {
    const a = Array.from({ length: 1000 }, (_, i) => i * 0.5);
    const b = a.slice();
    let copies = 0;
    const real = a.slice;
    a.slice = (...args: [number?, number?]): number[] => {
      copies++;
      return real.apply(a, args);
    };
    expect(distanceND(a, b)).toBe(0);
    expect(copies).toBe(0);
  });

  it('distanceND of two inputs that are no arrays returns 0, as before #1280', () => {
    // The nonfinite-inputs test lists distanceND as a function that takes point arrays.
    expect(distanceND(5 as unknown as number[], 6 as unknown as number[])).toBe(0);
  });
});

describe('points that do not coincide keep every digit', () => {
  const rel = (got: number, want: number): number => Math.abs(got - want) / Math.abs(want);
  it('subnormal squares', () => {
    const t = 2 ** -535;
    expect(rel(distance2D([0, 0], [3 * t, 4 * t]), 5 * t)).toBeLessThan(2 * Number.EPSILON);
    expect(rel(distance3D([0, 0, 0], [t, 2 * t, 2 * t]), 3 * t)).toBeLessThan(2 * Number.EPSILON);
    expect(rel(distanceND([0, 0, 0, 0], [t, t, t, t]), 2 * t)).toBeLessThan(2 * Number.EPSILON);
  });
  it('a difference that is 0 in one coordinate only', () => {
    const t = 2 ** -535;
    expect(rel(distanceND([1, 2, 3], [1, 2, 3 + t * 2 ** 500]), t * 2 ** 500)).toBeLessThan(1e-15);
  });
});
