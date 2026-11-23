import { describe, expect, it } from 'vitest';
import { hermiteH } from '../src/index.js';

describe('high-order Hermite polynomials (#1381)', () => {
  // Signs cross-checked with the full scaled recurrence before taking the phase shortcut.
  it.each([
    [100_000_000, 0.3, Infinity],
    [100_000_001, 0.3, Infinity],
    [100_000_001, -0.3, -Infinity],
    [100_000_000, 100, Infinity],
    [100_000_001, -100, -Infinity],
    [100_000_000, 15_000, Infinity],
    [10_000_001, 5e-18, Infinity],
    [10_000_000, 2200, -Infinity],
  ])('computes H_%i(%s) with the correct sign', (n, x, sign) => {
    expect(hermiteH(n, x)).toBe(sign);
  });

  it('keeps zeros, nonfinite inputs and the signs at the origin', () => {
    expect(hermiteH(100_000_001, 0)).toBe(0);
    expect(hermiteH(100_000_002, 0)).toBe(-Infinity);
    expect(hermiteH(100_000_000, NaN)).toBeNaN();
  });

  it('bounds recurrence work only when the phase sign is undecidable', () => {
    const n = 100_000_000;
    const nearTurning = 0.995 * Math.sqrt(2 * n + 1);
    expect(() => hermiteH(n, nearTurning)).toThrow(/uncertified overflow/);
    const nAtCap = 10_000_000;
    const uncertain = 0.995 * Math.sqrt(2 * nAtCap + 1);
    expect(() => hermiteH(nAtCap, Float64Array.of(uncertain, uncertain))).toThrow(RangeError);

    const xs = new Float64Array(64).fill(0.3);
    expect(hermiteH(n, xs)).toEqual(new Float64Array(64).fill(Infinity));
  });
});
