import { describe, it, expect } from 'vitest';
import { mulberry32, boxMuller } from '../../src/numeric/rng.js';
import { rowMajorStrides } from '../../src/numeric/strides.js';

/** First 8 outputs of makeMulberry32(42) from tensor/src/operations/random.ts (pre-move oracle). */
const MULBERRY32_42_FIRST_8 = [
  0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
  0.17481389874592423, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129,
];

describe('mulberry32', () => {
  it('matches the pre-move tensor oracle for seed 42', () => {
    const rng = mulberry32(42);
    const got: number[] = [];
    for (let i = 0; i < 8; i++) got.push(rng());
    expect(got).toEqual(MULBERRY32_42_FIRST_8);
  });

  it('produces independent streams for separate instances with the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const fresh = mulberry32(42);
    for (let i = 0; i < 20; i++) a();
    expect(b()).toBe(fresh());
  });

  it('coerces seed with | 0 and yields finite values in [0, 1)', () => {
    for (const seed of [0, -1]) {
      const rng = mulberry32(seed);
      const x = rng();
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('boxMuller', () => {
  it('returns finite normals for typical uniforms', () => {
    const [z0, z1] = boxMuller(0.3, 0.7);
    expect(Number.isFinite(z0)).toBe(true);
    expect(Number.isFinite(z1)).toBe(true);
  });

  it('does not return NaN when u1 is 0 (epsilon clamp)', () => {
    const [z0, z1] = boxMuller(0, 0.5);
    expect(Number.isNaN(z0)).toBe(false);
    expect(Number.isNaN(z1)).toBe(false);
  });
});

describe('rowMajorStrides', () => {
  it('handles rank 0, rank 1, and rank 3', () => {
    expect(rowMajorStrides([])).toEqual([]);
    expect(rowMajorStrides([4])).toEqual([1]);
    expect(rowMajorStrides([2, 3, 4])).toEqual([12, 4, 1]);
  });

  it('matches tensor behavior for a zero-sized axis', () => {
    expect(rowMajorStrides([0, 5])).toEqual([5, 1]);
  });
});
